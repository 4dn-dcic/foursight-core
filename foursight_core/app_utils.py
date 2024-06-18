import ast
import boto3
from chalice import Response
import copy
import datetime
from dateutil import tz
from http.cookies import SimpleCookie
import inspect
from itertools import chain
import jinja2
import json
import jwt
import logging
import os
from os.path import dirname
import pkg_resources
import platform
import pytz
import requests
import socket
import sys
import time
import types
from typing import Optional
from dcicutils.env_utils import (
    EnvUtils,
    full_env_name,
    get_foursight_bucket,
    get_foursight_bucket_prefix,
    infer_foursight_from_env,
    short_env_name,
    public_env_name
)
from dcicutils.exceptions import InvalidParameterError
from dcicutils import ff_utils
from dcicutils.function_cache_decorator import function_cache
from dcicutils.lang_utils import disjoined_list
from dcicutils.misc_utils import get_error_message, ignored
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import (get_identity_name, get_identity_secrets)
from dcicutils.redis_tools import RedisSessionToken, RedisException, SESSION_TOKEN_COOKIE
from .app import app
from .boto_sqs import boto_sqs_client
from .check_utils import CheckHandler
from .deploy import Deploy
from .environment import Environment
from .fs_connection import FSConnection
from .s3_connection import S3Connection
from .react.api.auth import Auth
from .react.api.jwt_utils import jwt_decode
from .react.api.react_api import ReactApi
from .react.api.datetime_utils import (
    convert_time_t_to_utc_datetime_string,
    convert_datetime_to_utc_datetime_string
)
from .routes import Routes
from .route_prefixes import CHALICE_LOCAL
from .sqs_utils import SQS
from .stage import Stage


logging.basicConfig()
logger = logging.getLogger(__name__)


# The ReactApi is included in here to for the React version, which runs side-by-side
# with the regular version. This and a React check/call in auth0_callback are the only real
# changes here for the React version; all React specific code is in the react sub-directory.
# Also, not directly related to React but done in conjunction with it, we moved all of the
# Chalice route definitions from foursight-cgap and foursight into foursight-core here,
# specifically, into routes.py and (for React routes) react/api/react_routes.py.
class AppUtilsCore(ReactApi, Routes):
    """
    This class contains all the functionality needed to implement AppUtils, but is not AppUtils itself,
    so that a class named AppUtils is easier to define in libraries that import foursight-core.
    """

    CHECK_SETUP_FILE_NAME = "check_setup.json"

    # Define in subclass.
    APP_PACKAGE_NAME = None

    def get_app_version(self):
        try:
            return pkg_resources.get_distribution(self.APP_PACKAGE_NAME).version
        except Exception:  # does not work in unit tests
            return 'Error detecting version'

    # NOTE (2022-08-24): No longer call from the top-level here (not polite);
    # rather call from (AppUtils) sub-classes in foursight-cgap and foursight.
    # apply_identity_globally()

    # These must be overwritten in inherited classes
    # replace with 'foursight', 'foursight-cgap' etc
    prefix = 'placeholder_prefix'

    # replace with e.g. 'https://cgap.hms.harvard.edu/static/img/favicon-fs.ico'
    FAVICON = 'placeholder_favicon'

    # replace with e.g. 'https://search-foursight-fourfront-ylxn33a5qytswm63z52uytgkm4.us-east-1.es.amazonaws.com'
    host = 'placeholder_host'

    AUTH0_DOMAIN_FALLBACK = 'hms-dbmi.auth0.com'
    OAUTH_TOKEN_URL = f'https://{AUTH0_DOMAIN_FALLBACK}/oauth/token'

    # replaced with e.g. 'chalicelib_cgap' or 'chalicelib_fourfront' in
    # foursight-cgap/chalicelib_cgap/app_utils.py or foursight/chalicelib_fourfront/app_utils.py.
    package_name = 'foursight_core'

    # optionally change this one
    html_main_title = 'Foursight'

    # Stuff below can be used directly by inherited classes
    TRIM_ERR_OUTPUT = 'Output too large to provide on main page - see check result directly'
    LAMBDA_MAX_BODY_SIZE = 5500000  # 6Mb is the "real" threshold

    def __init__(self):
        # Tuck a reference to this (singleton) instance into
        # a "core" field for convenient access by the routing code.
        app.core = self
        self.init_load_time = self.get_load_time()
        self.environment = Environment(self.prefix)
        self.stage = Stage(self.prefix)
        self.sqs = SQS(self.prefix)
        self.check_setup_file = self._locate_check_setup_file()
        logger.info(f"Using check_setup file: {self.check_setup_file}")
        self.check_handler = CheckHandler(self.prefix, self.package_name, self.check_setup_file, self.get_default_env())
        self.CheckResult = self.check_handler.CheckResult
        self.ActionResult = self.check_handler.ActionResult
        self.jin_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(self.get_template_path()),
            # TODO: AutoEscape is deprecated as of Jinja2 3.0. I think this autoescape option can simply be removed
            #       as of that version (maybe even before but it's less clear where that line is). -kmp 23-Feb-2023
            #       For details, see https://jinja.palletsprojects.com/en/3.1.x/changes/
            #       and https://github.com/pallets/jinja/issues/1203
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )
        self.auth0_domain = None
        self.auth0_client_id = None
        self.user_records = {}
        # self.user_record = None
        # self.user_record_error = None
        # self.user_record_error_email = None
        super(AppUtilsCore, self).__init__()

    @classmethod
    def get_default_env(cls) -> str:
        return os.environ.get("ENV_NAME", cls.DEFAULT_ENV)

    @staticmethod
    def note_non_fatal_error_for_ui_info(error_object, calling_function):
        if isinstance(calling_function, types.FunctionType):
            calling_function = calling_function.__name__
        logger.warning(f"Non-fatal error in function ({calling_function})."
                       f" Missing information via this function used only for Foursight UI display."
                       f" Underlying error: {get_error_message(error_object)}")

    @classmethod
    def set_timeout(cls, timeout):
        """Set timeout as environment variable. Decorator instances will pick up this value"""
        os.environ['CHECK_TIMEOUT'] = str(timeout)

    @classmethod
    def get_template_path(cls):
        template_dir = dirname(__file__)
        return os.path.join(template_dir, 'templates')

    def init_environments(self, env='all', envs=None):
        """
        Generate environment information from the envs bucket in s3.
        Returns a dictionary keyed by environment name with value of a sub-dict
        with the fields needed to initiate a connection.

        :param env: allows you to specify a single env to be initialized
        :param envs: allows you to specify multiple envs to be initialized
        """
        logger.warning(f'In init_environments with args {env} {envs}')
        stage_name = self.stage.get_stage()
        return self.environment.get_environment_and_bucket_info_in_batch(stage=stage_name, env=env, envs=envs)

    def init_connection(self, environ, _environments=None):
        """
        Initialize the fourfront/s3 connection using the FSConnection object
        and the given environment.
        Returns an FSConnection object or raises an error.
        """
        environments = self.init_environments(environ) if _environments is None else _environments
        if not environments:
            environ = self.get_default_env()
            environments = self.init_environments(environ) if _environments is None else _environments
        logger.warning("environments = %s" % str(environments))
        # if still not there, return an error
        if environ not in environments:
            error_res = {
                'status': 'error',
                'description': f'environment {environ} is not valid!',
                'environment': environ,
                'checks': {}
            }
            raise Exception(str(error_res))
        connection = FSConnection(environ, environments[environ], host=self.host)
        return connection

    def init_response(self, environ):
        """
        Generalized function to init response given an environment
        """
        response = Response('Foursight response')
        try:
            connection = self.init_connection(environ)
        except Exception as e:
            connection = None
            response.body = str(e)
            response.status_code = 400
        return connection, response

    def is_running_locally(self, request_dict) -> bool:
        return request_dict.get('context', {}).get('identity', {}).get('sourceIp', '') == "127.0.0.1"

    def get_logged_in_user_info(self, environ: str, request_dict: dict) -> dict:
        email_address = ""
        email_verified = ""
        first_name = ""
        last_name = ""
        issuer = ""
        subject = ""
        audience = ""
        issued_time = ""
        expiration_time = ""
        jwt_decoded = ""
        try:
            jwt_decoded = self.get_decoded_jwt_token(environ, request_dict)
            if jwt_decoded:
                email_address = jwt_decoded.get("email")
                email_verified = jwt_decoded.get("email_verified")
                issuer = jwt_decoded.get("iss")
                if issuer:
                    name = jwt_decoded.get(issuer + "name")
                    if name:
                        first_name = name.get("name_first")
                        last_name = name.get("name_last")
                subject = jwt_decoded.get("sub")
                audience = jwt_decoded.get("aud")
                issued_time = convert_time_t_to_utc_datetime_string(jwt_decoded.get("iat"))
                expiration_time = convert_time_t_to_utc_datetime_string(jwt_decoded.get("exp"))
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'get_logged_in_user_info')
        return {"email_address": email_address,
                "email_verified": email_verified,
                "first_name": first_name,
                "last_name": last_name,
                "issuer": issuer,
                "subject": subject,
                "audience": audience,
                "issued_time": issued_time,
                "expiration_time": expiration_time,
                "jwt": jwt_decoded}

    # This is a bit of a hack, this whole user_records thing.
    # Will eventually be supplanted by and corrected in the React version.
    def get_user_record(self, environ: str, request_dict: dict) -> Optional[dict]:
        user_info = self.get_logged_in_user_info(environ, request_dict)
        if not user_info:
            return None
        user_record = self.user_records.get(user_info['email_address'])
        return user_record

    def set_user_record(self, email: str, record: Optional[dict], error: Optional[str], exception: Optional[str]):
        """
        Adds the given user by email to the user_records class member list or updates if already there,
        with the given record detail dictionary and/or error and/or exception strings.
        The given email should be non-empty; returns with no action if so.
        """
        if not email:
            return
        self.user_records[email] = user_record = self.user_records.get(email) or {"email": email}
        user_record["record"] = record
        user_record["error"] = error
        user_record["exception"] = exception

    @function_cache(key=lambda self, env_name, raise_exception = False: env_name, nocache=None)
    def get_portal_url(self, env_name: str, raise_exception: bool = False) -> Optional[str]:
        try:
            environment_and_bucket_info = (
                self.environment.get_environment_and_bucket_info(env_name, self.stage.get_stage()))
            return environment_and_bucket_info.get("fourfront")
        except Exception as e:
            if raise_exception:
                raise
            message = f"Error getting portal URL: {get_error_message(e)}"
            logger.error(message)
            return None

    def get_auth0_client_id(self, env_name: str) -> str:
        auth0_client_id = os.environ.get("CLIENT_ID")
        if not auth0_client_id:
            # TODO: Confirm that we do not actually need to do this.
            # Just in case. We should already have this value from the GAC.
            # But Will said get it from the portal (was hardcoded in the template),
            # so I had written code to do that; just call as fallback for now.
            auth0_client_id = self.get_auth0_client_id_from_portal(env_name)
        return auth0_client_id

    def get_auth0_client_id_from_portal(self, env_name: str) -> Optional[str]:
        logger.warning(f"Fetching Auth0 client ID from portal.")
        portal_url = self.get_portal_url(env_name)
        auth0_config_url = portal_url + "/auth0_config?format=json"
        auth0_client_id_fallback = "DPxEwsZRnKDpk0VfVAxrStRKukN14ILB"
        if not self.auth0_client_id:
            try:
                response = requests.get(auth0_config_url).json()
                self.auth0_client_id = response.get("auth0Client", auth0_client_id_fallback)
            except Exception as e:
                # TODO: Fallback behavior to old hardcoded value (previously in templates/header.html).
                logger.error(f"Error fetching Auth0 client ID from portal ({auth0_config_url}); using default value: {e}")
        logger.warning(f"Done fetching Auth0 client ID from portal ({auth0_config_url}): {self.auth0_client_id}")
        return self.auth0_client_id or auth0_client_id_fallback

    def get_auth0_domain(self, env_name: str) -> str:
        auth0_domain = os.environ.get("CLIENT_DOMAIN")
        if not auth0_domain:
            auth0_domain = self.get_auth0_domain_from_portal(env_name)
        return auth0_domain

    def get_auth0_domain_from_portal(self, env_name: str) -> Optional[str]:
        logger.warning(f"Fetching Auth0 Domain from portal.")
        portal_url = self.get_portal_url(env_name)
        auth0_config_url = portal_url + "/auth0_config?format=json"
        if not self.auth0_domain:
            try:
                response = requests.get(auth0_config_url).json()
                self.auth0_domain = response.get("auth0Domain", self.AUTH0_DOMAIN_FALLBACK)
            except Exception as e:
                # TODO: Fallback behavior to old hardcoded value (previously in templates/header.html).
                logger.error(
                    f"Error fetching Auth0 domain from portal ({auth0_config_url}); using default value: {e}")
        logger.warning(f"Done fetching Auth0 domain from portal ({auth0_config_url}): {self.auth0_domain}")
        return self.auth0_domain or self.AUTH0_DOMAIN_FALLBACK

    def get_auth0_secret(self, env_name: str) -> str:
        ignored(env_name)
        return os.environ.get("CLIENT_SECRET")

    def check_authorization(self, request_dict, env=None):
        """
        Manual authorization, since the builtin chalice @app.authorizer() was not
        working for me and was limited by a requirement that the authorization
        be in a token. Check the cookies of the request for c4_st using utils.

        Note as of February 2023 we've migrated away from JWT to a generic session
        token. When Redis is not enabled c4_st will still be a JWT.

        Take in a dictionary format of the request (app.current_request) so we
        can test this.
        """
        # first check the Authorization header
        dev_auth = request_dict.get('headers', {}).get('authorization')
        # grant admin if dev_auth equals secret value
        if dev_auth and dev_auth == os.environ.get('DEV_SECRET'):
            return True
        # If we're on localhost, automatically grant authorization
        # this looks bad but isn't because request authentication will
        # still fail if local keys are not configured
        #
        # Note: because this is disabled, unit testing on this method is as well - Will Nov 9 2022
        # if self.is_running_locally(request_dict):
        #     return True
        #
        # Commented out above as o longer special treatment for running locally;
        # previously related to support of a local "faux" login; removed. Should
        # just delete this entire block including this comment next time around.
        jwt_decoded = self.get_decoded_jwt_token(env, request_dict)
        if jwt_decoded:
            try:
                if env is None:
                    return False  # we have no env to check auth
                envs = self.init_environments(env)
                for env_info in envs.values():
                    connection = self.init_connection(env, envs)
                    user_res = ff_utils.get_metadata('users/' + jwt_decoded.get('email').lower(),
                                                     key=connection.ff_keys,
                                                     add_on='frame=object&datastore=database')
                    logger.warning("foursight_core.check_authorization: env_info ...")
                    logger.warning(env_info)
                    logger.warning("foursight_core.check_authorization: user_res ...")
                    logger.warning(user_res)
                    groups = user_res.get('groups')
                    if not groups:
                        logger.warning("foursight_core.check_authorization: No 'groups' element for user record! Returning False.")
                        self.set_user_record(email=jwt_decoded.get('email'), record=None, error="nogroups", exception=None)
                        # self.user_record = None
                        # self.user_record_error = "nogroups"
                        # self.user_record_error_email = jwt_decoded.get('email')
                        return False
                    if not (('admin' in user_res['groups'] or 'foursight' in user_res['groups']) and jwt_decoded.get('email_verified')):
                        logger.error("foursight_core.check_authorization: Returning False")
                        # if unauthorized for one, unauthorized for all
                        self.set_user_record(email=jwt_decoded.get('email'), record=None, error="noadmin", exception=None)
                        # self.user_record = None
                        # self.user_record_error = "noadmin"
                        # self.user_record_error_email = jwt_decoded.get('email')
                        return False
                    self.set_user_record(email=jwt_decoded.get('email'), record=user_res, error=None, exception=None)
                    # self.user_record = user_res
                    # self.user_record_error = None
                    # self.user_record_error_email = None
                logger.warning("foursight_core.check_authorization: Returning True")
                return True
            except Exception as e:
                logger.error("foursight_core.check_authorization: Exception on check_authorization")
                self.set_user_record(email=jwt_decoded.get('email'), record=None, error="exception", exception=str(e))
                # self.user_record = None
                # self.user_record_error = "exception"
                # self.user_record_error_email = jwt_decoded.get('email')
                logger.error(e)
        logger.error("foursight_core.check_authorization: Returning False ")
        return False

    def auth0_callback(self, request, env):
        """ Callback that implements the generation of JWT and returning that back
            to the user to make authenticated requests with.

            Note that when Redis is enabled the JWT is instead stored in Redis and
            a 32-byte session token is returned instead.
        """
        req_dict = request.to_dict()
        if self.is_react_authentication_callback(req_dict):
            return self.react_authentication_callback(req_dict, env)
        domain, context = self.get_domain_and_context(req_dict)
        # extract redir cookie
        cookies = req_dict.get('headers', {}).get('cookie')
        redir_url = context + 'view/' + env

#       for cookie in cookies.split(';'):
#           name, val = cookie.strip().split('=')
#           if name == 'redir':
#               redir_url = val
        try:
            simple_cookies = SimpleCookie()
            simple_cookies.load(cookies)
            simple_cookies = {k: v.value for k, v in simple_cookies.items()}
            redir_url_cookie = simple_cookies.get("redir")
            if redir_url_cookie:
                redir_url = redir_url_cookie
        except Exception as e:
            logger.error("Exception loading cookies: {cookies} - {get_error_message(e)}")

        resp_headers = {'Location': redir_url}
        params = req_dict.get('query_params')
        if not params:
            return self.forbidden_response()
        auth0_code = params.get('code', None)
        auth0_client = self.get_auth0_client_id(env)
        auth0_secret = self.get_auth0_secret(env)
        if not (domain and auth0_code and auth0_client and auth0_secret):
            return Response(status_code=301, body=json.dumps(resp_headers), headers=resp_headers)
        if self.is_running_locally(req_dict):
            redir_url = f"http://{domain}/callback/"
        else:
            redir_url = f"https://{domain}{context if context else '/'}callback/"
        payload = {
            'grant_type': 'authorization_code',
            'client_id': auth0_client,
            'client_secret': auth0_secret,
            'code': auth0_code,
            'redirect_uri': redir_url
        }
        json_payload = json.dumps(payload)
        headers = {'content-type': "application/json"}
        if self.auth0_domain:
            token_url = f'https://{self.auth0_domain}/oauth/token'
        else:
            token_url = self.OAUTH_TOKEN_URL
        res = requests.post(token_url, data=json_payload, headers=headers)
        id_token = res.json().get('id_token', None)
        expires_in = res.json().get('expires_in', None)

        # store redis token if turned on
        conn = self.init_connection(env)
        redis_handler = conn.get_redis_base()
        if redis_handler:
            # Get email from JWT.
            jwt_decoded = jwt_decode(id_token, self._auth0_config.get_client(), self._auth0_config.get_secret())
            email = jwt_decoded.get("email")
            redis_session_token = RedisSessionToken(
                namespace=Auth.get_redis_namespace(env), jwt=id_token, email=email
            )
            redis_session_token.store_session_token(redis_handler=redis_handler)
            # overwrite id_token in this case to be the session token
            id_token = redis_session_token.get_session_token()
            expires_in = (3 * 60 * 59)  # default session token expiration is 3 hours

        if id_token:
            if domain and not self.is_running_locally(req_dict):
                cookie_str = f'{SESSION_TOKEN_COOKIE}={id_token}; Domain={domain}; Path=/;'
            else:
                # N.B. When running on localhost cookies cannot be set unless we leave off the domain entirely.
                # https://stackoverflow.com/questions/1134290/cookies-on-localhost-with-explicit-domain
                cookie_str = f'{SESSION_TOKEN_COOKIE}={id_token}; Path=/;'
            if expires_in:  # in seconds
                expires = datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_in)
                cookie_str += (' Expires=' + expires.strftime("%a, %d %b %Y %H:%M:%S GMT") + ';')
            resp_headers['Set-Cookie'] = cookie_str
        return Response(status_code=302, body=json.dumps(resp_headers), headers=resp_headers)

    def get_jwt_token(self, request_dict) -> str:
        """
        Simple function to extract a jwt from a request that has already been
        dict-transformed
        """
        cookies = request_dict.get('headers', {}).get('cookie')
        cookie_dict = {}
        if cookies:
            for cookie in cookies.split(';'):
                cookie_split = cookie.strip().split('=')
                if len(cookie_split) == 2:
                    cookie_dict[cookie_split[0]] = cookie_split[1]
        token = cookie_dict.get(SESSION_TOKEN_COOKIE, None)
        return token

    def get_decoded_jwt_token(self, env_name: str, request_dict) -> Optional[dict]:
        """ This function not only decodes but verifies the signature on the token """
        try:
            jwt_token = self.get_jwt_token(request_dict)
            if not jwt_token:
                return None
            auth0_client_id = self.get_auth0_client_id(env_name)
            auth0_secret = self.get_auth0_secret(env_name)

            # if redis is enabled check for session token and extract JWT from there
            canonical_env_name = full_env_name(env_name)
            conn = self.init_connection(canonical_env_name)
            redis_handler = conn.get_redis_base()
            if redis_handler:
                redis_session_token = RedisSessionToken.from_redis(
                    redis_handler=redis_handler,
                    namespace=Auth.get_redis_namespace(canonical_env_name),
                    token=jwt_token  # this is NOT JWT but the session token itself
                )
                if (not redis_session_token or
                        not redis_session_token.validate_session_token(redis_handler=redis_handler)):
                    raise RedisException('Given session token either expired or invalid')
                # if we got here, session token is valid, now decode jwt like usual
                return redis_session_token.decode_jwt(
                    audience=auth0_client_id,
                    secret=auth0_secret,
                )

            # if redis not enabled this is standard JWT and can proceed as usual
            else:
                return jwt.decode(jwt_token, auth0_secret, audience=auth0_client_id, leeway=30,
                                  options={"verify_signature": True}, algorithms=["HS256"])
        except Exception as e:
            logger.warning(f"foursight_core: Exception decoding JWT token ({jwt_token}): {get_error_message(e)}")
            return None

    @classmethod
    def get_favicon(cls):
        """
        Returns favicon
        """
        return cls.FAVICON  # want full HTTPS, so hard-coded in

    def get_domain_and_context(self, request_dict):
        """
        Given a request that has already been dict-transformed, get the host
        and the url context for endpoints. Context will basically either be
        '/api/' or '/'
        """
        domain = request_dict.get('headers', {}).get('host')
        context = '/api/' if request_dict.get('context', {}).get('path', '').startswith('/api/') else '/'
        return domain, context

    @classmethod
    def forbidden_response(cls, context="/"):
        sample_page = context + 'view/<environment>'
        return Response(status_code=403,
                        body=f'Forbidden. Login on the {sample_page} page.')

    @classmethod
    def process_response(cls, response):
        """
        Does any final processing of a Foursight response before returning it. Right now, this includes:
        * Changing the response body if it is greater than 5.5 MB (Lambda body max is 6 MB)
        """
        if cls.get_size(response.body) > cls.LAMBDA_MAX_BODY_SIZE:  # should be much faster than json.dumps
            response.body = 'Body size exceeded 6 MB maximum.'
            response.status_code = 413
        return response

    @classmethod
    def query_params_to_literals(cls, params):
        """
        Simple function to loop through the query params and convert them to
        bools/ints/floats other literals as applicable
        """
        to_delete = []
        for key, value in params.items():
            if isinstance(value, str) and not value:
                # handles empty strings
                to_delete.append(key)
                continue
            try:
                as_literal = ast.literal_eval(value)
            except (ValueError, SyntaxError):
                as_literal = value
            params[key] = as_literal
        for key in to_delete:
            del params[key]
        return params

    @classmethod
    def get_size(cls, obj, seen=None):
        """ Recursively finds size of objects
            Taken directly from: https://goshippo.com/blog/measure-real-size-any-python-object/
        """
        size = sys.getsizeof(obj)
        if seen is None:
            seen = set()
        obj_id = id(obj)
        if obj_id in seen:
            return 0
        # Important mark as seen *before* entering recursion to gracefully handle
        # self-referential objects
        seen.add(obj_id)
        if isinstance(obj, dict):
            size += sum([cls.get_size(v, seen) for v in obj.values()])
            size += sum([cls.get_size(k, seen) for k in obj.keys()])
        elif hasattr(obj, '__dict__'):
            size += cls.get_size(obj.__dict__, seen)
        elif hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes, bytearray)):
            size += sum([cls.get_size(i, seen) for i in obj])
        return size

    @classmethod
    def trim_output(cls, output, max_size=100000):
        """ Uses the helper above with sys.getsizeof to determine the output size and remove it if it is too large.
            Instead of encoding as JSON as that is very slow.

        Old docstring below:

        AWS lambda has a maximum body response size of 6MB. Since results are currently delivered entirely
        in the body of the response, let's limit the size of the 'full_output', 'brief_output', and
        'admin_output' fields to 100 KB (see if this is a reasonable amount).
        Slice the dictionaries, lists, or string to achieve this.
        max_size input integer is in bites

        Takes in the non-json formatted version of the fields. For now, just use this for /view/.
        """
        # formatted = json.dumps(output, indent=4)
        # if len(formatted) > max_size:
        #     return ''.join([formatted[:max_size], '\n\n... Output truncated ...'])
        # else:
        #     return formatted
        size = cls.get_size(output)
        if size > max_size:
            return cls.TRIM_ERR_OUTPUT
        return output

    def sort_dictionary_by_case_insensitive_keys(self, dictionary: dict) -> dict:
        """
        Returns the given dictionary sorted by (case-insensitive) key values; yes,
        dictionaries are ordered as of Python 3.7. If the given value is not a
        dictionary it will be coerced to one.
        :param dictionary: Dictionary to sort.
        :return: Given dictionary sorted by key value.
        """
        if not dictionary or not isinstance(dictionary, dict):
            return {}
        return {key: dictionary[key] for key in sorted(dictionary.keys(), key=lambda key: key.lower())}

    def get_aws_account_number(self) -> Optional[dict]:
        try:
            caller_identity = boto3.client("sts").get_caller_identity()
            return caller_identity["Account"]
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'get_aws_account_number')
            return None

    def get_obfuscated_credentials_info(self, env_name: str) -> dict:
        try:
            session = boto3.session.Session()
            credentials = session.get_credentials()
            access_key_id = credentials.access_key
            region_name = session.region_name
            caller_identity = boto3.client("sts").get_caller_identity()
            user_arn = caller_identity["Arn"]
            account_number = caller_identity["Account"]
            auth0_client_id = self.get_auth0_client_id(env_name)
            credentials_info = {
                "AWS Account Number:": account_number,
                "AWS User ARN:": user_arn,
                "AWS Access Key ID:": access_key_id,
                "AWS Region Name:": region_name,
                "Auth0 Client ID:": auth0_client_id
            }
            return credentials_info
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'get_obfuscated_credentials_info')
            return {}

    def ping_elasticsearch(self, env_name: str) -> bool:
        logger.warning(f"foursight_core: Pinging ElasticSearch: {self.host}")
        try:
            response = self.init_connection(env_name).connections["es"].test_connection()
            logger.warning(f"foursight_core: Done pinging ElasticSearch: {self.host}")
            return response
        except Exception as e:
            logger.warning(f"Exception pinging ElasticSearch ({self.host}): {e}")
            return False

    def ping_portal(self, env_name: str) -> bool:
        portal_url = ""
        try:
            portal_url = self.get_portal_url(env_name)
            logger.warning(f"foursight_core: Pinging portal: {portal_url}")
            response = requests.get(portal_url + "/health?format=json", timeout=4)
            logger.warning(f"foursight_core: Done pinging portal: {portal_url}")
            return (response.status_code == 200)
        except Exception as e:
            logger.warning(f"foursight_core: Exception pinging portal ({portal_url}): {e}")
            return False

    def ping_sqs(self) -> bool:
        sqs_url = ""
        try:
            sqs_url = self.sqs.get_sqs_queue().url
            logger.warning(f"foursight_core: Pinging SQS: {sqs_url}")
            sqs_attributes = self.sqs.get_sqs_attributes(sqs_url)
            logger.warning(f"foursight_core: Done pinging SQS: {sqs_url}")
            return (sqs_attributes is not None)
        except Exception as e:
            logger.warning(f"Exception pinging SQS ({sqs_url}): {e}")
            return False

    def reload_lambda(self, lambda_name: str = None) -> bool:
        """
        Experimental.
        Reloads the lambda code for the given lambda name. We do this by making an innocuous change
        to it, namely, by adding/removing a trailing dot to its description. This causes the lambda
        to be reloaded, however this also changes its last modified date, which we would also like to
        to accurately get (get_lambda_last_modified), so we store its original value in a lambda tag,
        the updating of which does not update the modified time; so the code (get_lambda_last_modified)
        to get the last modified time of the lambda needs to look first at this tag and take that
        if it exists before looking at the real last modified time.
        """
        if not lambda_name or lambda_name.lower() == "current" or lambda_name.lower() == "default":
            lambda_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
            if not lambda_name:
                return False
        try:
            boto_lambda = boto3.client("lambda")
            lambda_info = boto_lambda.get_function(FunctionName=lambda_name)
            if lambda_info:
                lambda_arn = lambda_info["Configuration"]["FunctionArn"]
                lambda_tags = boto_lambda.list_tags(Resource=lambda_arn)["Tags"]
                lambda_last_modified_tag = lambda_tags.get("last_modified")
                if not lambda_last_modified_tag:
                    lambda_last_modified = lambda_info["Configuration"]["LastModified"]
                    boto_lambda.tag_resource(Resource=lambda_arn, Tags={"last_modified": lambda_last_modified})
                lambda_description = lambda_info["Configuration"]["Description"]
                if not lambda_description:
                    lambda_description = "Reload"
                else:
                    if lambda_description.endswith("."):
                        lambda_description = lambda_description[:-1]
                    else:
                        lambda_description = lambda_description + "."
                logger.warning(f"Reloading lambda: {lambda_name}")
                boto_lambda.update_function_configuration(FunctionName=lambda_name, Description=lambda_description)
                logger.warning(f"Reloaded lambda: {lambda_name}")
                return True
        except Exception as e:
            logger.warning(f"Error reloading lambda ({lambda_name}): {e}")
        return False

    @function_cache(nocache=None)
    def get_lambda_last_modified(self, lambda_name: str = None) -> Optional[str]:
        """
        Returns the last modified time for the given lambda name.
        See comments in reload_lambda on this.
        """
        if not lambda_name or lambda_name.lower() == "current" or lambda_name.lower() == "current":
            lambda_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
            if not lambda_name:
                return None
        try:
            boto_lambda = boto3.client("lambda")
            lambda_info = boto_lambda.get_function(FunctionName=lambda_name)
            if lambda_info:
                lambda_arn = lambda_info["Configuration"]["FunctionArn"]
                lambda_tags = boto_lambda.list_tags(Resource=lambda_arn)["Tags"]
                lambda_last_modified_tag = lambda_tags.get("last_modified")
                if lambda_last_modified_tag:
                    lambda_last_modified = convert_datetime_to_utc_datetime_string(lambda_last_modified_tag)
                else:
                    lambda_last_modified = lambda_info["Configuration"]["LastModified"]
                    lambda_last_modified = convert_datetime_to_utc_datetime_string(lambda_last_modified)
                return lambda_last_modified
        except Exception as e:
            logger.warning(f"Error getting lambda ({lambda_name}) last modified time: {e}")
        return None

    # ===== ROUTE RUNNING FUNCTIONS =====

    def view_run_check(self, environ, check, params, context="/"):
        """
        Called from the view endpoint (or manually, I guess), this queues the given
        check for the given environment and redirects to the view_foursight result
        for the new check.
        Params are kwargs that are read from the url query_params; they will be
        added to the kwargs used to run the check.

        Args:
            environ (str): Foursight environment name
            check (str): check function name
            params (dict): kwargs to use for check
            context (str): string context to use for Foursight routing

        Returns:
            chalice.Response: redirect to future check landing page
        """
        # convert string query params to literals
        params = self.query_params_to_literals(params)
        queued_uuid = self.queue_check(environ, check, params)
        # redirect to view page with a 302 so it isn't cached
        resp_headers = {'Location': '/'.join([context + 'view', environ, check, queued_uuid])}
        return Response(status_code=302, body=json.dumps(resp_headers),
                        headers=resp_headers)

    def view_run_action(self, environ, action, params, context="/"):
        """
        Called from the view endpoint (or manually, I guess), this runs the given
        action for the given environment and refreshes the foursight view.
        Params are kwargs that are read from the url query_params; they will be
        added to the kwargs used to run the check.

        Args:
            environ (str): Foursight environment name
            action (str): action function name
            params (dict): kwargs to use for check
            context (str): string context to use for Foursight routing

        Returns:
            chalice.Response: redirect to check view that called this action
        """
        # convert string query params to literals
        params = self.query_params_to_literals(params)
        queued_uuid = self.queue_action(environ, action, params)
        # redirect to calling check view page with a 302 so it isn't cached
        if 'check_name' in params and 'called_by' in params:
            check_detail = '/'.join([params['check_name'], params['called_by']])
            resp_headers = {'Location': '/'.join([context + 'view', environ, check_detail])}
        else:
            # no check so cannot redirect
            act_path = '/'.join([context + 'checks', action, queued_uuid])
            return Response(
                body={
                    'status': 'success',
                    'details': f'Action is queued. When finished, view at: {act_path}',
                    'environment': environ
                },
                status_code=200
            )
        return Response(status_code=302, body=json.dumps(resp_headers),
                        headers=resp_headers)

    def get_unique_annotated_environment_names(self):
        unique_environment_names = self.environment.list_unique_environment_names()
        unique_annotated_environment_names = [
            {"name": env,
             "short_name": short_env_name(env),
             "full_name": full_env_name(env),
             "public_name": public_env_name(env) if public_env_name(env) else short_env_name(env),
             "foursight_name": infer_foursight_from_env(envname=env),
             "portal_url": self.get_portal_url(env)}
            for env in unique_environment_names]
        return sorted(unique_annotated_environment_names, key=lambda key: key["public_name"])

    def view_foursight(self, request, environ, is_admin=False, domain="", context="/"):
        """
        View a template of all checks from the given environment(s).
        Environ may be 'all' or a specific FS environments separated by commas.
        With 'all', this function can be somewhat slow.
        Domain is the current FS domain, needed for Auth0 redirect.
        Context is the current context, usually "/api/" or "/"
        Returns a response with html content.
        Non-protected route
        """
        html_resp = Response('Foursight viewing suite')
        html_resp.headers = {'Content-Type': 'text/html'}
        requested_envs = [e.strip() for e in environ.split(',')]
        environments = self.init_environments(envs=requested_envs)  # cached at start of page load
        total_envs = []
        servers = []
        view_envs = environments.keys() if environ == 'all' else [e.strip() for e in environ.split(',')]
        for this_environ in view_envs:
            try:
                if not is_admin:  # no view permissions for non-admins on CGAP
                    continue
                connection = self.init_connection(this_environ, _environments=environments)
            except Exception:
                connection = None
            if connection:
                servers.append(connection.ff_server)
                grouped_results = self.check_handler.get_grouped_check_results(connection)
                for group in grouped_results:
                    for title, result in group.items():
                        if title == '_name':
                            continue
                        elif title == '_statuses':
                            # convert counts to strings for jinja
                            for stat, val in group[title].items():
                                group[title][stat] = str(val)
                            continue
                        else:
                            group[title] = self.process_view_result(connection, result, is_admin)
                total_envs.append({
                    'status': 'success',
                    'environment': this_environ,
                    'groups': grouped_results
                })
        # prioritize these environments
        env_order = ['data', 'staging', 'webdev', 'hotseat', 'cgap', 'cgap-mastertest']
        total_envs = sorted(total_envs,
                            key=lambda v: env_order.index(v['environment']) if v['environment'] in env_order else 9999)
        template = self.jin_env.get_template('view_groups.html')
        # get queue information
        queue_attr = self.sqs.get_sqs_attributes(self.sqs.get_sqs_queue().url)
        running_checks = queue_attr.get('ApproximateNumberOfMessagesNotVisible')
        queued_checks = queue_attr.get('ApproximateNumberOfMessages')
        first_env_favicon = self.get_favicon()
        request_dict = request.to_dict()
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            env_short=short_env_name(environ),
            env_full=full_env_name(environ),
            view_envs=total_envs,
            stage=self.stage.get_stage(),
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.get_user_record(environ, request_dict),
            # user_record=self.user_record,
            # user_record_error=self.user_record_error,
            # user_record_error_email=self.user_record_error_email,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            running_checks=running_checks,
            queued_checks=queued_checks,
            favicon=first_env_favicon,
            portal_url=self.get_portal_url(environ),
            main_title=self.html_main_title
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    def view_reload_lambda(self, request, environ, is_admin=False, domain="", context="/", lambda_name: str = None):
        self.reload_lambda(lambda_name)
        time.sleep(3)
        resp_headers = {'Location': f"{context}info/{environ}"}
        return Response(status_code=302, body=json.dumps(resp_headers), headers=resp_headers)

    # dmichaels/2020-08-01:
    # Added /info/{environ} for debugging/troubleshooting purposes.
    def view_info(self, request, environ, is_admin=False, domain="", context="/"):
        """
        Displays a /{environ}/info page containing sundry info about the running Foursight instance.
        Any sensitive data is obfuscated. This is a protected route.
        :param domain: Current FS domain, needed for Auth0 redirect.
        :param context: Current context, usually "/api/" or "/".
        :return: Response with html content.
        """

        html_resp = Response('Foursight viewing suite')
        html_resp.headers = {'Content-Type': 'text/html'}
        template = self.jin_env.get_template('info.html')
        # env_name = os.environ.get("ENV_NAME")
        stage_name = self.stage.get_stage()
        environment_names = {
            "Environment Name:": environ,
            "Environment Name (Full):": full_env_name(environ),
            "Environment Name (Short):": short_env_name(environ),
            "Environment Name (Public):": public_env_name(envname=environ),
            "Environment Name (Foursight):": infer_foursight_from_env(envname=environ),
            "Environment Name List:": sorted(self.environment.list_environment_names()),
            "Environment Name List (Unique):": sorted(self.environment.list_unique_environment_names())
        }
        bucket_names = {
            "Environment Bucket Name:": self.environment.get_env_bucket_name(),
            "Foursight Bucket Name:": get_foursight_bucket(envname=environ, stage=stage_name),
            "Foursight Bucket Prefix:": get_foursight_bucket_prefix()
        }
        gac_name = get_identity_name()
        gac_values = self.sort_dictionary_by_case_insensitive_keys(obfuscate_dict(get_identity_secrets()))
        environment_and_bucket_info = self.sort_dictionary_by_case_insensitive_keys(obfuscate_dict(
                                        self.environment.get_environment_and_bucket_info(environ, stage_name)))
        declared_data = self.sort_dictionary_by_case_insensitive_keys(EnvUtils.declared_data())
        dcicutils_version = pkg_resources.get_distribution('dcicutils').version
        foursight_core_version = pkg_resources.get_distribution('foursight-core').version
        versions = {
            # TODO/dmichaels/2022-08-04: Get the "Foursight-CGAP" value some other way,
            # as the package might not be "Foursight-CGAP" (might be for example just "Foursight").
            f"{self.html_main_title}:": self.get_app_version(),
            "Foursight-Core:": foursight_core_version,
            "DCIC-Utils:": dcicutils_version,
            "Python:": platform.python_version()
        }
        resources = {
            "Foursight Server:": socket.gethostname(),
            "Portal Server:": self.get_portal_url(environ),
            "ElasticSearch Server:": self.host,
            "RDS Server:": os.environ["RDS_HOSTNAME"],
            "SQS Server:": self.sqs.get_sqs_queue().url,
        }
        aws_credentials = self.get_obfuscated_credentials_info(environ)
        aws_account_number = aws_credentials.get("AWS Account Number:")
        os_environ = self.sort_dictionary_by_case_insensitive_keys(obfuscate_dict(dict(os.environ)))
        request_dict = request.to_dict()

        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            env_short=short_env_name(environ),
            env_full=full_env_name(environ),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            stage=stage_name,
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.get_user_record(environ, request_dict),
            # user_record=self.user_record,
            # user_record_error=self.user_record_error,
            # user_record_error_email=self.user_record_error_email,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_credentials=aws_credentials,
            aws_account_number=aws_account_number,
            portal_url=self.get_portal_url(environ),
            main_title=self.html_main_title,
            favicon=self.get_favicon(),
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            running_checks='0',
            queued_checks='0',
            environment_names=environment_names,
            bucket_names=bucket_names,
            environment_and_bucket_info=environment_and_bucket_info,
            declared_data=declared_data,
            identity_name=gac_name,
            identity_secrets=gac_values,
            resources=resources,
            ping_portal=self.ping_portal(environ),
            ping_elasticsearch=self.ping_elasticsearch(environ),
            ping_sqs=self.ping_sqs(),
            versions=versions,
            os_environ=os_environ
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    def view_user(self, request, environ, is_admin=False, domain="", context="/", email=None):
        html_resp = Response('Foursight viewing suite')
        html_resp.headers = {'Content-Type': 'text/html'}
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        users = []
        connection = self.init_connection(environ)
        for this_email in email.split(","):
            try:
                this_user = ff_utils.get_metadata('users/' + this_email.lower(),
                                                  key=connection.ff_keys,
                                                  add_on='frame=object&datastore=database')
                users.append({"email": this_email, "record": this_user})
            except Exception as e:
                users.append({"email": this_email, "record": {"error": str(e)}})
        template = self.jin_env.get_template('user.html')
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            env_short=short_env_name(environ),
            env_full=full_env_name(environ),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            stage=stage_name,
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.get_user_record(environ, request_dict),
            # user_record=self.user_record,
            # user_record_error=self.user_record_error,
            # user_record_error_email=self.user_record_error_email,
            users=users,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            portal_url=self.get_portal_url(environ),
            main_title=self.html_main_title,
            favicon=self.get_favicon(),
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            running_checks='0',
            queued_checks='0'
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    def view_users(self, request, environ, is_admin=False, domain="", context="/"):
        html_resp = Response('Foursight viewing suite')
        html_resp.headers = {'Content-Type': 'text/html'}
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        users = []
        # TODO: Support paging.
        connection = self.init_connection(environ)
        user_records = ff_utils.get_metadata('users/', key=connection.ff_keys,
                                             add_on='frame=object&limit=10000&datastore=database')
        for user_record in user_records["@graph"]:
            last_modified = user_record.get("last_modified")
            if last_modified:
                last_modified = last_modified.get("date_modified")
            # TODO
            # roles = []
            # project_roles = user_record.get("project_roles")
            # if project_roles:
            #     role = role.get("date_modified")
            #     roles.append({
            #         "groups": groups,
            #         "project_roles": project_roles,
            #         "principals_view": principals_view,
            #         "principals_edit": principals_edit
            #     })
            users.append({
                "email_address": user_record.get("email"),
                "first_name": user_record.get("first_name"),
                "last_name": user_record.get("last_name"),
                "uuid": user_record.get("uuid"),
                "modified": convert_datetime_to_utc_datetime_string(last_modified)})
        users = sorted(users, key=lambda key: key["email_address"])
        template = self.jin_env.get_template('users.html')
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            env_short=short_env_name(environ),
            env_full=full_env_name(environ),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            stage=stage_name,
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.get_user_record(environ, request_dict),
            # user_record=self.user_record,
            # user_record_error=self.user_record_error,
            # user_record_error_email=self.user_record_error_email,
            users=users,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            portal_url=self.get_portal_url(environ),
            main_title=self.html_main_title,
            favicon=self.get_favicon(),
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            running_checks='0',
            queued_checks='0'
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    def view_foursight_check(self, request, environ, check, uuid, is_admin=False, domain="", context="/"):
        """
        View a formatted html response for a single check (environ, check, uuid)
        """
        html_resp = Response('Foursight viewing suite')
        html_resp.headers = {'Content-Type': 'text/html'}
        total_envs = []
        servers = []
        try:
            connection = self.init_connection(environ)
        except Exception:
            connection = None
        if connection:
            servers.append(connection.ff_server)
            res_check = self.CheckResult(connection, check)
            if res_check:
                data = res_check.get_result_by_uuid(uuid)
                if data is None:
                    # the check hasn't run. Return a placeholder view
                    data = {
                        'name': check,
                        'uuid': uuid,
                        'status': 'ERROR',  # in this case we just queued a check, so ERROR is ok
                        'summary': 'Check has not yet run',
                        'description': 'Check has not yet run'
                    }
                title = self.check_handler.get_check_title_from_setup(check)
                processed_result = self.process_view_result(connection, data, is_admin)
                total_envs.append({
                    'status': 'success',
                    'environment': environ,
                    'checks': {title: processed_result}
                })
        template = self.jin_env.get_template('view_checks.html')
        queue_attr = self.sqs.get_sqs_attributes(self.sqs.get_sqs_queue().url)
        running_checks = queue_attr.get('ApproximateNumberOfMessagesNotVisible')
        queued_checks = queue_attr.get('ApproximateNumberOfMessages')
        first_env_favicon = self.get_favicon()
        request_dict = request.to_dict()
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            env_short=short_env_name(environ),
            env_full=full_env_name(environ),
            view_envs=total_envs,
            stage=self.stage.get_stage(),
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.get_user_record(environ, request_dict),
            # user_record=self.user_record,
            # user_record_error=self.user_record_error,
            # user_record_error_email=self.user_record_error_email,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            running_checks=running_checks,
            queued_checks=queued_checks,
            favicon=first_env_favicon,
            portal_url=self.get_portal_url(environ),
            main_title=self.html_main_title
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    @classmethod
    def get_load_time(cls):
        """
        Returns the current time in ET, formatted the same was process_view_result
        """
        ts_utc = datetime.datetime.utcnow().replace(microsecond=0)
        ts_utc = ts_utc.replace(tzinfo=tz.tzutc())
        # change timezone to EST (specific location needed for daylight savings)
        ts_local = ts_utc.astimezone(tz.gettz('America/New_York'))
        return ''.join([str(ts_local.date()), ' ', str(ts_local.time()), ' ', str(ts_local.tzname())])

    def process_view_result(self, connection, res, is_admin, stringify=True):
        """
        Do some processing on the content of one check result (res arg, a dict)
        Processes timestamp string, trims output fields, and adds action info.

        For action info, if the check has an action, try to find the associated
        action by looking for '<check name>/action_records<check uuid>' object in
        s3. The contents will be the path to the action. If found, display as
        the "associated action" and disabled further runs of the action from the
        check; also edit the check summary to reflect that action has finished.
        Otherwise, allow runs of the action.
        For now, always show latest action as well.
        """
        # first check to see if res is just a string, meaning
        # the check didn't execute properly
        if not isinstance(res, dict):
            error_res = {
                'status': 'ERROR',
                'content': True,
                'title': 'Check System Error',
                'description': res,
                'uuid': 'Did not successfully run'
            }
            return error_res
        # this can be removed once uuid has been around long enough
        ts_utc = res['uuid'] if 'uuid' in res else res['timestamp']
        ts_utc = datetime.datetime.strptime(ts_utc, "%Y-%m-%dT%H:%M:%S.%f").replace(microsecond=0)
        ts_utc = ts_utc.replace(tzinfo=tz.tzutc())
        # change timezone to EST (specific location needed for daylight savings)
        ts_local = ts_utc.astimezone(tz.gettz('America/New_York'))
        proc_ts = ''.join([str(ts_local.date()), ' at ', str(ts_local.time())])
        res['local_time'] = proc_ts
        if stringify:
            if res.get('brief_output'):
                res['brief_output'] = json.dumps(self.trim_output(res['brief_output']), indent=2)
            if res.get('full_output'):
                res['full_output'] = json.dumps(self.trim_output(res['full_output']), indent=2)
        # only return admin_output if an admin is logged in
        if res.get('admin_output') and is_admin:
            res['admin_output'] = json.dumps(self.trim_output(res['admin_output']), indent=2)
        else:
            res['admin_output'] = None

        # ### LOGIC FOR VIEWING ACTION ###
        # if this check has already run an action, display that. Otherwise, allow
        # action to be run.
        # For now also get the latest result for the checks action
        if res.get('action'):
            action = self.ActionResult(connection, res.get('action'))
            if action:
                action_record_key = '/'.join([res['name'], 'action_records', res['uuid']])
                assc_action_key = connection.connections['s3'].get_object(action_record_key)
                if assc_action_key:
                    assc_action_key = assc_action_key.decode()  # in bytes
                    assc_action = connection.get_object(assc_action_key)
                    # If assc_action_key is written but assc_action is None, then
                    # it most likely means the action is still running
                    if assc_action is not None:
                        res['assc_action_status'] = assc_action['status']
                        if stringify:
                            res['assc_action'] = json.dumps(assc_action, indent=4)
                        else:
                            res['assc_action'] = assc_action
                        # update check summary
                        if res.get('summary'):
                            res['summary'] = 'ACTION %s: %s' % (assc_action['status'], res['summary'])
                    else:
                        res['assc_action_status'] = 'PEND'
                        res['assc_action'] = 'Associated action has not finished.'
                        # update check summary
                        if res.get('summary'):
                            res['summary'] = 'ACTION PENDING: %s' % res['summary']
                    # don't allow the action to be run again from this check
                    del res['action']
                    if ('allow_action' in res) and (res['allow_action'] is not False):
                        # To alleviate confusion created by this resetting of allow_action to False below.
                        res['original_allow_action'] = res['allow_action']
                    res['allow_action'] = False
                elif res.get('allow_action') is True:
                    # if there is an action + allow action is set but the action has
                    # not yet run, display an icon status to signify this
                    res['assc_action_status'] = 'ready'

                # This used to try to get the latest result and only populate 'latest_action' if one exists.
                # Doing so makes the main page take 2-3x as long to load, so we won't be doing that anymore.
                res['action_history'] = res.get('action')  # = action name

            else:
                del res['action']
        return res

    def view_foursight_history(self, request, environ, check, start=0, limit=25, is_admin=False,
                               domain="", context="/"):
        """
        View a tabular format of the history of a given check or action (str name
        as the 'check' parameter) for the given environment. Results look like:
        status, kwargs.
        start controls where the first result is and limit controls how many
        results are retrieved (see get_foursight_history()).
        Returns html.
        """
        html_resp = Response('Foursight history view')
        html_resp.headers = {'Content-Type': 'text/html'}
        # server = None
        try:
            connection = self.init_connection(environ)
        except Exception:
            connection = None
        if connection:
            # server = connection.ff_server
            history, total = self.get_foursight_history(connection, check, start, limit)
            history_kwargs = list(set(chain.from_iterable([item[2] for item in history])))
        else:
            history, history_kwargs = [], []
        template = self.jin_env.get_template('history.html')
        check_title = self.check_handler.get_check_title_from_setup(check)
        page_title = ''.join(['History for ', check_title, ' (', environ, ')'])
        queue_attr = self.sqs.get_sqs_attributes(self.sqs.get_sqs_queue().url)
        running_checks = queue_attr.get('ApproximateNumberOfMessagesNotVisible')
        queued_checks = queue_attr.get('ApproximateNumberOfMessages')
        favicon = self.get_favicon()
        request_dict = request.to_dict()
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            env_short=short_env_name(environ),
            env_full=full_env_name(environ),
            check=check,
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            history=history,
            history_kwargs=history_kwargs,
            res_start=start,
            res_limit=limit,
            res_actual=len(history),
            page_title=page_title,
            stage=self.stage.get_stage(),
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.get_user_record(environ, request_dict),
            # user_record=self.user_record,
            # user_record_error=self.user_record_error,
            # user_record_error_email=self.user_record_error_email,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            running_checks=running_checks,
            queued_checks=queued_checks,
            favicon=favicon,
            portal_url=self.get_portal_url(environ),
            main_title=self.html_main_title
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    def get_foursight_history(self, connection, check, start, limit, sort=None) -> [list, int]:
        """
        Get a brief form of the historical results for a check, including
        UUID, status, kwargs. Limit the number of results recieved to 500, unless
        otherwise specified ('limit' arg). 'start' arg determines where the start
        of the results grabbed is, with idx = 0 being the most recent one.

        'check' may be a check or an action (string name)
        """
        # limit 'limit' param to 500
        limit = 500 if limit > 500 else limit
        result_obj = self.check_handler.init_check_or_action_res(connection, check)
        if not result_obj:
            return [], 0
        result, total = result_obj.get_result_history(start, limit, sort)
        return result, total

    def run_get_check(self, environ, check, uuid=None):
        """
        Loads a specific check or action result given an environment, check or
        action name, and uuid (all strings).
        If uuid is not provided, get the primary_result.
        """
        connection, response = self.init_response(environ)
        if not connection:
            return response
        res_obj = self.check_handler.init_check_or_action_res(connection, check)
        if not res_obj:
            response.body = {
                'status': 'error',
                'description': 'Not a valid check or action.'
            }
            response.status_code = 400
        else:
            if uuid:
                data = res_obj.get_result_by_uuid(uuid)
            else:
                data = res_obj.get_primary_result()
            response.body = {
                'status': 'success',
                'data': data
            }
            response.status_code = 200
        return self.process_response(response)

    def run_put_check(self, environ, check, put_data):
        """
        Abstraction of put_check functionality to allow for testing outside of chalice
        framework. Returns a response object
        """
        connection, response = self.init_response(environ)
        if not connection:
            return response
        if not isinstance(put_data, dict):
            response.body = {
                'status': 'error',
                'endpoint': 'put_check',
                'check': check,
                'description': ' '.join(['PUT request is malformed:', str(put_data)]),
                'environment': environ
            }
            response.status_code = 400
            return response
        put_uuid = put_data.get('uuid', datetime.datetime.utcnow().isoformat())
        putCheck = self.CheckResult(connection, check, init_uuid=put_uuid)
        # set valid fields from the PUT body. should this be dynamic?
        # if status is not included, it will be set to ERROR
        for field in ['title', 'status', 'summary', 'description', 'brief_output', 'full_output', 'admin_output']:
            put_content = put_data.get(field)
            prev_content = getattr(putCheck, field, None)
            if put_content:
                # append attribute data for _output fields if there are pre-existing
                # values originating from an existing put_uuid
                if prev_content and field in ['full_output', 'brief_output', 'admin_output']:
                    # will be list, dict, or string. make sure they are same type
                    if isinstance(prev_content, dict) and isinstance(put_content, dict):
                        prev_content.update(put_content)
                    elif isinstance(prev_content, list) and isinstance(put_content, list):
                        prev_content.extend(put_content)
                    elif isinstance(prev_content, str) and isinstance(put_content, str):
                        prev_content = prev_content + put_content
                    else:
                        # cannot append, just update with new
                        prev_content = put_content
                    setattr(putCheck, field, prev_content)
                else:
                    setattr(putCheck, field, put_content)
        # set 'primary' kwarg so that the result is stored as 'latest'
        putCheck.kwargs = {'primary': True, 'uuid': put_uuid}
        stored = putCheck.store_result()
        response.body = {
            'status': 'success',
            'endpoint': 'put_check',
            'check': check,
            'updated_content': stored,
            'environment': environ
        }
        response.status_code = 200
        return self.process_response(response)

# Commented out based on feedback PR-33 from Will ...
# As it is incompatible with EnvUtils at this time.
# Can create a ticket to make it compatible in the future.
#
#   def run_put_environment(self, environ, env_data):
#       """
#       Abstraction of the functionality of put_environment without the current_request
#       to allow for testing.
#       """
#       proc_environ = environ.split('-')[-1] if environ.startswith('fourfront-') else environ
#       if isinstance(env_data, dict) and {'fourfront', 'es'} <= set(env_data):
#           ff_address = env_data['fourfront'] if env_data['fourfront'].endswith('/') else env_data['fourfront'] + '/'
#           es_address = env_data['es'] if env_data['es'].endswith('/') else env_data['es'] + '/'
#           ff_env = env_data['ff_env'] if 'ff_env' in env_data else ''.join(['fourfront-', proc_environ])
#           env_entry = {
#               'fourfront': ff_address,
#               'es': es_address,
#               'ff_env': ff_env
#           }
#           s3_connection = S3Connection(self.prefix + '-envs')
#           s3_connection.put_object(proc_environ, json.dumps(env_entry))
#           stage = self.stage.get_stage()
#           s3_bucket = ''.join([self.prefix + '-', stage, '-', proc_environ])
#           bucket_res = s3_connection.create_bucket(s3_bucket)
#           if not bucket_res:
#               response = Response(
#                   body={
#                       'status': 'error',
#                       'description': f'Could not create bucket: {s3_bucket}',
#                       'environment': proc_environ
#                   },
#                   status_code=500
#               )
#           else:
#               # if not testing, queue checks with 'put_env' condition for the new env
#               if 'test' not in self.stage.get_queue_name():
#                   for sched in self.check_handler.get_schedule_names():
#                       self.queue_scheduled_checks(environ, sched, conditions=['put_env'])
#               response = Response(
#                   body={
#                       'status': 'success',
#                       'description': ' '.join(['Succesfully made:', proc_environ]),
#                       'environment': proc_environ
#                   },
#                   status_code=200
#               )
#       else:
#           response = Response(
#               body={
#                   'status': 'error',
#                   'description': 'Environment creation failed',
#                   'body': env_data,
#                   'environment': proc_environ
#               },
#               status_code=400
#           )
#       return self.process_response(response)

    def run_get_environment(self, environ):
        """
        Return config information about a given environment, or throw an error
        if it is not valid.
        """
        environments = self.init_environments()
        if environ in environments:
            response = Response(
                body={
                    'status': 'success',
                    'details': environments[environ],
                    'environment': environ
                },
                status_code=200
            )
        else:
            env_names = list(environments.keys())
            response = Response(
                body={
                    'status': 'error',
                    'description': f'Invalid environment provided. Should be one of {disjoined_list(env_names)}.',
                    'environment': environ
                },
                status_code=400
            )
        return self.process_response(response)

# Commented out based on feedback PR-33 from Will ...
# As it is incompatible with EnvUtils at this time.
# Can create a ticket to make it compatible in the future.
#
#   @classmethod
#   def run_delete_environment(cls, environ, bucket=None):
#       """
#       Removes the environ entry from the Foursight envs bucket. This effectively de-schedules all checks
#       but does not remove any data.
#       """
#       if not bucket:
#           bucket = cls.prefix + '-envs'
#       s3_connection = S3Connection(bucket)
#       s3_resp = s3_connection.delete_keys([environ])
#       keys_deleted = s3_resp['Deleted']
#       if not keys_deleted:
#           response = Response(
#               body={
#                   'status': 'error',
#                   'description': 'Unable to comply with request',
#                   'environment': environ
#               },
#               status_code=400
#           )
#       else:
#           our_key = keys_deleted[0]  # since we only passed one key to be deleted, response will be a length 1 list
#           if our_key['Key'] != environ:
#               response = Response(
#                   body={
#                       'status': 'error',
#                       'description': 'An error occurred during environment deletion, please check S3 directly',
#                       'environment': environ
#                   },
#                   status_code=400
#               )
#           else:  # we were successful
#               response = Response(
#                   body={
#                       'status': 'success',
#                       'details': f'Successfully deleted environment {environ}',
#                       'environment': environ
#                   },
#                   status_code=200
#               )
#       return cls.process_response(response)

    # ===== QUEUE / CHECK RUNNER FUNCTIONS =====

    def queue_scheduled_checks(self, sched_environ, schedule_name, conditions=None):
        """
        Given a str environment and schedule name, add the check info to the
        existing queue (or creates a new one if there is none). Then initiates 4
        check runners that are linked to the queue that are self-propogating.

        If sched_environ == 'all', then loop through all in Environment.list_environments()

        Run with schedule_name = None to skip adding the check group to the queue
        and just initiate the check runners.

        Can optionally provide a list of conditions that will be used as used to
        filter the checks to schedule based on the 'conditions' list in check_setup

        Args:
            sched_environ (str): Foursight environment name to schedule on
            schedule_name (str): schedule name from check_setup / app
            conditions (list): optional list of one or more conditions to filter by

        Returns:
            dict: runner input of queued messages, used for testing
        """
        logger.warning(f"queue_scheduled_checks: sched_environ={sched_environ} schedule_name={schedule_name} conditions={conditions}")
        queue = self.sqs.get_sqs_queue()
        logger.warning(f"queue_scheduled_checks: queue={queue}")
        if schedule_name is not None:
            logger.warning(f"queue_scheduled_checks: have schedule_name")
            logger.warning(f"queue_scheduled_checks: environment.is_valid_environment_name(sched_environ, or_all=True)={self.environment.is_valid_environment_name(sched_environ, or_all=True)}")
            if not self.environment.is_valid_environment_name(sched_environ, or_all=True):
                logger.warning(f'-RUN-> {sched_environ} is not a valid environment. Cannot queue.')
                return
            sched_environs = self.environment.get_selected_environment_names(sched_environ)
            logger.warning(f"queue_scheduled_checks: sched_environs={sched_environs}")
            check_schedule = self.check_handler.get_check_schedule(schedule_name, conditions)
            logger.warning(f"queue_scheduled_checks: sched_environs={check_schedule}")
            if not check_schedule:
                logger.warning(f'-RUN-> {schedule_name} is not a valid schedule. Cannot queue.')
                return
            if not sched_environs:
                logger.warning(f'-RUN-> No scheduled environs detected! {sched_environs}, {check_schedule}')
                return
            for environ in sched_environs:
                logger.warning(f'-RUN-> Sending messages for {environ}')
                # add the run info from 'all' as well as this specific environ
                check_vals = copy.copy(check_schedule.get('all', []))
                check_vals.extend(self.get_env_schedule(check_schedule, environ))
                logger.warning(f"queue_scheduled_checks: calling send_sqs_messages({environ}) ... check_values:")
                logger.warning(check_vals)
                self.sqs.send_sqs_messages(queue, environ, check_vals)
                logger.warning(f"queue_scheduled_checks: after calling send_sqs_messages({environ})")
        runner_input = {'sqs_url': queue.url}
        for n in range(4):  # number of parallel runners to kick off
            logger.warning(f"queue_scheduled_checks: calling invoke_check_runner({runner_input})")
            self.sqs.invoke_check_runner(runner_input)
            logger.warning(f"queue_scheduled_checks: after calling invoke_check_runner({runner_input})")
        logger.warning(f"queue_scheduled_checks: returning({runner_input})")
        return runner_input  # for testing purposes

    @classmethod
    def get_env_schedule(cls, check_schedule, environ):
        """
        Gets schedules from the check_schedule table for the given environ, which may be a short, full, or public name.

        In the new environment configuration, there are multiple aliases that refer to the same environment.
        This function ensures that when writing a check schedule you can refer to any of the aliases.
        """
        return (check_schedule.get(public_env_name(environ))
                or check_schedule.get(full_env_name(environ))
                or check_schedule.get(short_env_name(environ))
                or [])

    def queue_check(self, environ, check,
                    params: Optional[dict] = None, deps: Optional[list] = None, uuid: Optional[str] = None):
        """
        Queue a single check, given by check function name, with given parameters
        and dependencies (both optional). Also optionally pass in a uuid, which
        will be used for the run if provided

        Args:
            environ (str): Foursight environment name
            check (str): check function name
            params (dict): kwargs to use for check. Defaults to {}
            deps (list): list of dependencies for the check. Defaults to []
            uuid (str): optional uuid to pass to the run. Defaults to None

        Returns:
            str: uuid of the queued check (from send_single_to_queue)
        """
        check_str = self.check_handler.get_check_strings(check)
        if not check_str:
            error_res = {
                'status': 'error',
                'description': f'could not find check {check}',
                'environment': environ,
                'checks': {}
            }
            raise Exception(str(error_res))
        to_send = [check_str, params or {}, deps or []]
        return self.send_single_to_queue(environ, to_send, uuid)

    def queue_action(self, environ, action,
                     params: Optional[dict] = None, deps: Optional[list] = None, uuid: Optional[str] = None):
        """
        Queue a single action, given by action function name, with given parameters
        and dependencies (both optional). Also optionally pass in a uuid, which
        will be used for the run if provided

        Args:
            environ (str): Foursight environment name
            action (str): action function name
            params (dict): kwargs to use for action. Defaults to {}
            deps (list): list of dependencies for the action. Defaults to []
            uuid (str): optional uuid to pass to the run. Defaults to None

        Returns:
            str: uuid of the queued action (from send_single_to_queue)
        """
        action_str = self.check_handler.get_action_strings(action)
        if not action_str:
            error_res = {
                'status': 'error',
                'description': f'could not find action {action}',
                'environment': environ,
                'checks': {}
            }
            raise Exception(str(error_res))
        to_send = [action_str, params or {}, deps or []]
        return self.send_single_to_queue(environ, to_send, uuid)

    def send_single_to_queue(self, environ, to_send, uuid, invoke_runner=True):
        """
        Send a single formatted check/action to SQS for given environ. Pass
        the given uuid to send_sqs_messages. Invoke a single check runner lambda

        Args:
            environ (str): Foursight environment name
            to_send (list): check/action entry in form [check_str, params, deps]
            uuid (str): uuid to pass to run. If None, generate a new uuid
            invoke_runner (bool): If True, invoke a check_runner lambda

        Returns:
            str: uuid of the queued run (from send_single_to_queue)
        """
        queue = self.sqs.get_sqs_queue()
        queued_uuid = self.sqs.send_sqs_messages(queue, environ, [to_send], uuid=uuid)
        # kick off a single check runner lambda
        if invoke_runner is True:
            self.sqs.invoke_check_runner({'sqs_url': queue.url})
        return queued_uuid

    def run_check_runner(self, runner_input, propogate=True):
        """
        Run logic for a check runner. Used to run checks and actions.

        runner_input should be a dict containing one
        key: sqs_url that corresponds to the aws url for the queue.
        This function attempts to recieve one message from the standard SQS queue
        using long polling, checks the run dependencies for that check/action, and then
        will run the check.

        If the run was a check and the 'queue_action' parameter is set, along with
        check.action and check.allow_action, will attempt to queue the associated
        action.

        If dependencies are not met, the check is not run and
        the run info is put back in the queue. Otherwise, the message is deleted
        from the queue.

        If there are no messages left (should always be true when nothing is
        recieved from sqs with long polling), then exit and do not propogate another
        check runner. Otherwise, initiate another check_runner to continue the process.

        Args:
            runner_input (dict): body of SQS message
            propogate (bool): if True (default), invoke another check runner lambda

        Returns:
            dict: run result if something was run, else None
        """
        # FYI the runner_input argument is a dict that looks something like this (2023-06-16):
        # {'sqs_url': 'https://sqs.us-east-1.amazonaws.com/466564410312/foursight-cgap-prod-check_queue'}
        # and the propogate arguments is a bootstrap.LambdaContext that instance.
        sqs_url = runner_input.get('sqs_url')
        if not sqs_url:
            return
        client = boto_sqs_client()
        response = client.receive_message(
            QueueUrl=sqs_url,
            AttributeNames=['MessageGroupId'],
            MaxNumberOfMessages=1,
            VisibilityTimeout=300,
            WaitTimeSeconds=10
        )
        message = response.get('Messages', [{}])[0]

        # TODO/2022-12-01/dmichaels: Issue with check not running because not detecting that
        # dependency has already run; for example with expset_opf_unique_files_in_experiments
        # depending on expset_opfsets_unique_titles; seems not checking the result in S3 of the
        # depdendency correctly. This is what seems to be returned here if the check has a dependency, e.g.:
        #
        #   [ "data",
        #     "2022-12-02T12:00:17.345942",
        #     "audit_checks/expset_opf_unique_files_in_experiments",
        #     {"primary": true},
        #     ["expset_opfsets_unique_titles"]
        #   ]
        #
        # Where the first item (data) is the environment; the second item (2022-12-02T12:00:17.345942)
        # is the UUID for the DEPENDENCY (expset_opfsets_unique_titles), which is the fifth item;
        # the third item (audit_checks/expset_opf_unique_files_in_experiments) is the main check;
        # the fourth item is the kwargs for the main check; and the fifth item (as mentioned)
        # is the dependency/ies upon which the main check is dependent. Not YET clear if/why/how
        # the UUID is for the dependency (how did this make it into the SQS message) and/or what
        # this might look like if multiple dependencies.
        #
        # If the check does NOT have a dependency, we see, for example:
        #
        #   [ "data",
        #     "2022-12-02T12:35:34.786686",
        #     "system_checks/elastic_search_space",
        #     {"primary": true},
        #     [] ]
        #
        # In this case the second item (2022-12-02T12:35:34.786686) is the UUID for the main check,
        # which is the third item (system_checks/elastic_search_space).

        body = message.get('Body')
        receipt = message.get('ReceiptHandle')
        if not body or not receipt:
            # if no messages recieved in 10 seconds of long polling, terminate
            return None
        check_list = json.loads(body)
        if not isinstance(check_list, list) or len(check_list) != 5:
            # if not a valid check str, remove the item from the SQS
            self.sqs.delete_message_and_propogate(runner_input, receipt, propogate=propogate)
            return None
        [run_env, run_uuid, run_name, run_kwargs, run_deps] = check_list
        # find information from s3 about completed checks in this run
        # actual id stored in s3 has key: <run_uuid>/<run_name>
        if run_deps and isinstance(run_deps, list):
            logger.warning(f'-RUN-> Dependency ({run_deps}) checking for: {run_name}')

            # 2022-12-05/dmichaels: New code for looking up dependency results.
            deps_w_uuid = ['/'.join([dep, run_uuid]) for dep in run_deps]
            ndeps_already_run = 0
            for dep_w_uuid in deps_w_uuid:
                logger.warning(f'-RUN-> Dependency ({dep_w_uuid}) check for: {run_name}')
                already_run = self.collect_run_info(dep_w_uuid, run_env, no_trailing_slash=True)
                if already_run:
                    logger.warning(f'-RUN-> Dependency ({dep_w_uuid}) already ran for: {run_name}')
                    ndeps_already_run += 1
                else:
                    logger.warning(f'-RUN-> Dependency ({dep_w_uuid}) has not already run for: {run_name}')
            finished_dependencies = (ndeps_already_run == len(deps_w_uuid))
            if finished_dependencies:
                logger.warning(f'-RUN-> Dependency ({run_deps}) check passed for: {run_name}')
            else:
                logger.warning(f'-RUN-> Dependency ({run_deps}) check did NOT pass for: {run_name}')

            # 2022-12-05/dmichaels
            #
            # Replaced this code with above block. Leaving this code
            # commented out here for a bit until we are sure this is solid.
            #
            # 2022-12-02/dmichaels: This seems wrong; if we search for an S3 key
            # using just the UUID as the prefix it won't find the check run result there
            # because it's in a sub-key, e.g. item_counts_by_type/2022-12-02T14:05:32.979264
            # rather than just 2022-12-02T14:05:32.979264, using the we want to check if
            # the dependencies have run.
            #
            # already_run = self.collect_run_info(run_uuid, run_env)
            #
            # 2022-12-02/dmichaels: This seems backwards; should be:
            # deps_w_uuid = ['/'.join([dep, run_uuid]) for dep in run_deps]
            # I.e. rather than e.g. 2022-12-02T14:05:32.979264/item_counts_by_type
            # we want item_counts_by_type/2022-12-02T14:05:32.979264.
            # Also this code seems to imply that the UUID for all dependencies
            # are the same (have not actually seen examples of multiple dependencies).
            #
            # deps_w_uuid = ['/'.join([run_uuid, dep]) for dep in run_deps]
            # finished_dependencies = set(deps_w_uuid).issubset(already_run)

            if not finished_dependencies:
                logger.warning(f'-RUN-> Not ready (due to dependency: {run_deps}) for: {run_name}')
        else:
            finished_dependencies = True
        connection = self.init_connection(run_env)
        if finished_dependencies:
            # add the run uuid as the uuid to kwargs so that checks will coordinate
            if 'uuid' not in run_kwargs:
                run_kwargs['uuid'] = run_uuid
            run_kwargs['_run_info'] = {'run_id': run_uuid, 'receipt': receipt, 'sqs_url': sqs_url}
            # if this is an action, ensure we have not already written an action record
            if 'check_name' in run_kwargs and 'called_by' in run_kwargs:
                rec_key = '/'.join([run_kwargs['check_name'], 'action_records', run_kwargs['called_by']])
                found_rec = connection.get_object(rec_key)
                if found_rec is not None:
                    # the action record has been written. Abort and propogate
                    logger.warning(f'-RUN-> Found existing action record: {rec_key}. Skipping')
                    self.sqs.delete_message_and_propogate(runner_input, receipt, propogate=propogate)
                    return None
                else:
                    # make a action record before running the action
                    # action name is the second part of run_name
                    act_name = run_name.split('/')[-1]
                    rec_body = ''.join([act_name, '/', run_uuid, '.json'])
                    # This was changed per Will's suggestion in code review. -kmp 7-Jun-2022
                    # connection.put_object(rec_key, rec_body)
                    connection.connections['s3'].put_object(rec_key, rec_body)
                    logger.warning(f'-RUN-> Wrote action record: {rec_key}')
            run_result = self.check_handler.run_check_or_action(connection, run_name, run_kwargs)
            logger.warning('-RUN-> RESULT:  %s (uuid)' % str(run_result.get('uuid')))
            # invoke action if running a check and kwargs['queue_action'] matches stage
            stage = self.stage.get_stage()
            # TODO: Factor out this (et.al.) for better testing.
            if run_result['type'] == 'check' and run_result['kwargs']['queue_action'] == stage:
                # must also have check.action and check.allow_action set
                if run_result['allow_action'] and run_result['action'] and not run_result.get('prevent_action'):
                    action_params = {'check_name': run_result['name'],
                                     'called_by': run_result['kwargs']['uuid']}
                    try:
                        self.queue_action(run_env, run_result['action'],
                                          params=action_params, uuid=run_uuid)
                    except Exception as exc:
                        logger.warning('-RUN-> Could not queue action %s on stage %s with kwargs: %s. Error: %s'
                              % (run_result['action'], stage, action_params, str(exc)))
                    else:
                        logger.warning('-RUN-> Queued action %s on stage %s with kwargs: %s'
                              % (run_result['action'], stage, action_params))
            logger.warning(f'-RUN-> Finished: {run_name}')
            self.sqs.delete_message_and_propogate(runner_input, receipt, propogate=propogate)
            return run_result
        else:
            logger.warning(f'-RUN-> Recovered: {run_name}')
            self.sqs.recover_message_and_propogate(runner_input, receipt, propogate=propogate)
            return None

    @classmethod
    def collect_run_info(cls, run_uuid, env, no_trailing_slash=False):
        """
        Returns a set of run checks under this run uuid
        """
        bucket = get_foursight_bucket(envname=env, stage=Stage(cls.prefix).get_stage())
        s3_connection = S3Connection(bucket)
        run_prefix = ''.join([run_uuid, '/']) if not no_trailing_slash else run_uuid
        complete = s3_connection.list_all_keys_w_prefix(run_prefix, no_trailing_slash=no_trailing_slash)
        # eliminate duplicates
        return set(complete)

    def _locate_check_setup_file(self) -> Optional[str]:
        return self._locate_config_file(AppUtilsCore.CHECK_SETUP_FILE_NAME)

    def _locate_config_file(self, file_name: str) -> Optional[str]:
        """
        Returns the full path to the given named file (e.g. check_setup.json),
        looking for the first NON-EMPTY file within these directories, in the following order;
        if not found then returns None.

        - If the CHALICE_LOCAL environment variable is set to "true", then the chalicelib_local
          directory PARALLEL to the appropriate chalicelib package directory, i.e. either
          chalicelib_cgap or chalicelib_fourfront, depending on our class package_name member,
          which is overridden accordingly in foursight-cgap/chalicelib_cgap/app_utils.py
          or foursight/chalicelib_fourfront/app_utils.py.

        - If the FOURSIGHT_CHECK_SETUP_DIR environment variable is set, then the directory
          specified by this value. This is set in the 4dn-cloud-infra repo app.py file, to the
          local directory there, which ends up actually being the vendor sub-direcotry there.

        - The appropriate chalicelib package directory, i.e. either chalicelib_cgap or
          chalicelib_fourfront, depending on our class package_name member, which is
          overridden accordingly in foursight-cgap/chalicelib_cgap/app_utils.py
          or foursight/chalicelib_fourfront/app_utils.py.

        - The base directory of this foursight_core package.
        """

        def _get_chalicelib_dir():
            """
            Returns the package (file system) directory path name for the package associated
            with this instance of AppUtilsCore, i.e. associated with self.package_name.
            This is (should be) set to either chalicelib_cgap or chalicelib_fourfront
            depending on if we running with foursight-cgap or foursight packages.
            """
            try:
                chalicelib_package = __import__(self.package_name)
                return os.path.dirname(inspect.getfile(chalicelib_package))
            except Exception as e:
                logger.error(f"Cannot determine chalicelib directory: {get_error_message(e)}")
                return ""

        def is_non_empty_file(file: str) -> bool:
            """
            Returns true iff the given file is a JSON file which is non-empty.
            Where non-empty means the file exists, is of non-zero length, and
            contains a non-empty JSON object or array.
            """
            try:
                if os.path.exists(file):
                    if os.stat(file).st_size > 0:
                        return True
            except Exception:
                pass
            return False

        config_file = None
        chalicelib_dir = None
        if CHALICE_LOCAL:
            if not chalicelib_dir:
                chalicelib_dir = _get_chalicelib_dir()
            config_dir = os.path.normpath(os.path.join(chalicelib_dir, "../chalicelib_local"))
            config_file = os.path.join(config_dir, file_name)
            if not is_non_empty_file(config_file):
                config_file = None
        if not config_file:
            env_based_dir = os.environ.get("FOURSIGHT_CHECK_SETUP_DIR", "")
            if env_based_dir:
                config_file = os.path.join(env_based_dir, file_name)
                if not is_non_empty_file(config_file):
                    config_file = None
        if not config_file:
            if not chalicelib_dir:
                chalicelib_dir = _get_chalicelib_dir()
            config_file = os.path.join(chalicelib_dir, file_name)
            if not is_non_empty_file(config_file):
                config_file = None
        if not config_file:
            foursight_core_dir = os.path.dirname(__file__)
            config_file = os.path.join(foursight_core_dir, file_name)
            if not is_non_empty_file(config_file):
                config_file = None
        return config_file

    _singleton = None

    @staticmethod
    def singleton(specific_class=None):
        # A little wonky having a singleton with an argument but this is sort of the way it
        # was in 4dn-cloud-infra/app-{cgap,fourfront}.py; and we know the only place we create
        # this is from there and also from foursight-cgap/chalicelib/app.py and foursight/app.py
        # with the appropriate locally derived (from this AppUtilsCore) AppUtils.
        if not AppUtilsCore._singleton:
            AppUtilsCore._singleton = specific_class() if specific_class else AppUtilsCore()
        return AppUtilsCore._singleton


class AppUtils(AppUtilsCore):  # for compatibility with older imports
    """
    Class AppUtils is the most high-level class that's used directy by Chalice object app.
    This class mostly contains the functionality defined in app_utils in original foursight,
    but the details are now inherited from AppUtilsCore, which is the recommended class to
    import if you're making an AppUtils in some other library.
    """
    pass


# These were previously in foursight/chalicelib_foursight/check_schedules.py
# and foursight-cgap/chalicelib_cgap/check_schedules.py.
def _compute_valid_deploy_stages():
    # TODO: Will wants to know why "test" is here. -kmp 17-Aug-2021
    return list(Deploy.CONFIG_BASE['stages'].keys()) + ['test']


class InvalidDeployStage(InvalidParameterError):

    @classmethod
    def compute_valid_options(cls):
        return _compute_valid_deploy_stages()


def set_stage(stage):
    if stage not in _compute_valid_deploy_stages():
        raise InvalidDeployStage(parameter='stage', value=stage)
    os.environ['chalice_stage'] = stage


def set_timeout(timeout):
    app.core.set_timeout(timeout)
