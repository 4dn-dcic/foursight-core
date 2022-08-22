from chalice import Response
import jinja2
import json
import os
from os.path import dirname
import jwt
import boto3
import datetime
import ast
import copy
import pkg_resources
import platform
import pytz
import requests
import socket
import sys
import time
import types
import logging
from itertools import chain
from dateutil import tz
from dcicutils import ff_utils
from dcicutils.env_utils import (
    EnvUtils,
    get_foursight_bucket,
    get_foursight_bucket_prefix,
    infer_foursight_from_env,
    full_env_name,
    short_env_name,
)
from dcicutils.lang_utils import disjoined_list
from dcicutils.misc_utils import get_error_message
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import (get_identity_name, get_identity_secrets)
from typing import Optional
from .identity import apply_identity_globally
from .s3_connection import S3Connection
from .fs_connection import FSConnection
from .check_utils import CheckHandler
from .sqs_utils import SQS
from .stage import Stage
from .environment import Environment


logging.basicConfig()
logger = logging.getLogger(__name__)


class AppUtilsCore:
    """
    This class contains all the functionality needed to implement AppUtils, but is not AppUtils itself,
    so that a class named AppUtils is easier to define in libraries that import foursight-core.
    """

    # Define in subclass.
    APP_PACKAGE_NAME = None

    def get_app_version(self):
        return pkg_resources.get_distribution(self.APP_PACKAGE_NAME).version

    # dmichaels/2022-07-20/C4-826: Apply identity globally.
    apply_identity_globally()

    # These must be overwritten in inherited classes
    # replace with 'foursight', 'foursight-cgap' etc
    prefix = 'placeholder_prefix'

    # replace with e.g. 'https://cgap.hms.harvard.edu/static/img/favicon-fs.ico'
    FAVICON = 'placeholder_favicon'

    # replace with e.g. 'https://search-foursight-fourfront-ylxn33a5qytswm63z52uytgkm4.us-east-1.es.amazonaws.com'
    host = 'placeholder_host'

    OAUTH_TOKEN_URL = "https://hms-dbmi.auth0.com/oauth/token"

    # replace with e.g. 'chalicelib'
    package_name = 'foursight_core'

    # repeat the same line to use __file__ relative to the inherited class
    check_setup_dir = dirname(__file__)

    # optionally change this one
    html_main_title = 'Foursight'

    # Stuff below can be used directly by inherited classes
    TRIM_ERR_OUTPUT = 'Output too large to provide on main page - see check result directly'
    LAMBDA_MAX_BODY_SIZE = 5500000  # 6Mb is the "real" threshold

    def __init__(self):
        self.init_load_time = self.get_load_time()
        self.environment = Environment(self.prefix)
        self.stage = Stage(self.prefix)
        self.sqs = SQS(self.prefix)
        self.check_handler = CheckHandler(self.prefix, self.package_name, self.check_setup_dir)
        self.CheckResult = self.check_handler.CheckResult
        self.ActionResult = self.check_handler.ActionResult
        self.jin_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(self.get_template_path()),
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )
        self.portal_url = None
        self.auth0_client_id = None
        self.user_record = None
        self.lambda_last_modified = None

    @staticmethod
    def note_non_fatal_error_for_ui_info(error_object, calling_function):
        if isinstance(calling_function, types.FunctionType):
            calling_function = calling_function.__name__
        logger.warn(f"Non-fatal error in function ({calling_function})."
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
        stage_name = self.stage.get_stage()
        return self.environment.get_environment_and_bucket_info_in_batch(stage=stage_name, env=env, envs=envs)

    def init_connection(self, environ, _environments=None):
        """
        Initialize the fourfront/s3 connection using the FSConnection object
        and the given environment.
        Returns an FSConnection object or raises an error.
        """
        environments = self.init_environments(environ) if _environments is None else _environments
        print("environments = %s" % str(environments))
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

    def get_logged_in_user_info(self, environ: str, request_dict: dict) -> str:
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
                issued_time = self.convert_time_t_to_useastern_datetime(jwt_decoded.get("iat"))
                expiration_time = self.convert_time_t_to_useastern_datetime(jwt_decoded.get("exp"))
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

    def get_portal_url(self, env_name: str) -> str:
        if not self.portal_url:
            try:
                environment_and_bucket_info = \
                    self.environment.get_environment_and_bucket_info(env_name, self.stage.get_stage())
                self.portal_url = environment_and_bucket_info.get("fourfront")
                return self.portal_url
            except Exception as e:
                logger.error(f"Error determining portal URL: {e}")
                raise e

    def get_auth0_client_id(self, env_name: str) -> str:
        auth0_client_id = os.environ.get("CLIENT_ID")
        if not auth0_client_id:
            # TODO: Confirm that we do not actually need to do this.
            # Just in case. We should already have this value from the GAC.
            # But Will said get it from the portal (was hardcoded in the template),
            # so I had written code to do that; just call as fallback for now.
            auth0_client_id = self.get_auth0_client_id_from_portal(env_name)
        return auth0_client_id

    def get_auth0_client_id_from_portal(self, env_name: str) -> str:
        logger.warn(f"Fetching Auth0 client ID from portal.")
        portal_url = self.get_portal_url(env_name)
        auth0_config_url = portal_url + "/auth0_config?format=json"
        if not self.auth0_client_id:
            try:
                response = requests.get(auth0_config_url).json()
                self.auth0_client_id = response.get("auth0Client")
            except Exception as e:
                # TODO: Fallback behavior to old hardcoded value (previously in templates/header.html).
                self.auth0_client_id = "DPxEwsZRnKDpk0VfVAxrStRKukN14ILB"
                logger.error(f"Error fetching Auth0 client ID from portal ({auth0_config_url}); using default value: {e}")
        logger.warn(f"Done fetching Auth0 client ID from portal ({auth0_config_url}): {self.auth0_client_id}")
        return self.auth0_client_id

    def get_auth0_secret(self, env_name: str) -> str:
        return os.environ.get("CLIENT_SECRET")

    def check_authorization(self, request_dict, env=None):
        """
        Manual authorization, since the builtin chalice @app.authorizer() was not
        working for me and was limited by a requirement that the authorization
        be in a token. Check the cookies of the request for jwtToken using utils

        Take in a dictionary format of the request (app.current_request) so we
        can test this.
        """
        # first check the Authorization header
        dev_auth = request_dict.get('headers', {}).get('authorization')
        # grant admin if dev_auth equals secret value
        if dev_auth and dev_auth == os.environ.get('DEV_SECRET'):
            return True
        # if we're on localhost, automatically grant authorization
        # this looks bad but isn't because request authentication will
        # still fail if local keys are not configured
        if self.is_running_locally(request_dict):
            return True
        jwt_decoded = self.get_decoded_jwt_token(env, request_dict)
        if jwt_decoded:
            try:
                if env is None:
                    return False  # we have no env to check auth
                for env_info in self.init_environments(env).values():
                    user_res = ff_utils.get_metadata('users/' + jwt_decoded.get('email').lower(),
                                                     ff_env=env_info['ff_env'], add_on='frame=object')
                    logger.warn("foursight_core.check_authorization: env_info ...")
                    logger.warn(env_info)
                    logger.warn("foursight_core.check_authorization: user_res ...")
                    logger.warn(user_res)
                    #
                    # The following tries to referent 'groups' in the JSON returned by the get_metadata call above,
                    # but there is no such element. The JSON we get looks like this:
                    # {
                    #     "email": "david_michaels@hms.harvard.edu",
                    #     "status": "current",
                    #     "timezone": "US/Eastern",
                    #     "last_name": "Michaels",
                    #     "first_name": "David",
                    #     "date_created": "2022-05-09T19:29:04.053460+00:00",
                    #     "subscriptions": [],
                    #     "schema_version": "1",
                    #     "was_unauthorized": true,
                    #     "@id": "/users/04bf103b-5a61-4ff9-96ac-e8d104f8b7ee/",
                    #     "@type": [
                    #         "User",
                    #         "Item"
                    #     ],
                    #     "uuid": "04bf103b-5a61-4ff9-96ac-e8d104f8b7ee",
                    #     "principals_allowed": {
                    #         "view": [
                    #             "group.admin",
                    #             "group.read-only-admin",
                    #             "remoteuser.EMBED",
                    #             "remoteuser.INDEXER",
                    #             "userid.04bf103b-5a61-4ff9-96ac-e8d104f8b7ee"
                    #         ],
                    #         "edit": [
                    #             "group.admin",
                    #             "userid.04bf103b-5a61-4ff9-96ac-e8d104f8b7ee"
                    #         ]
                    #     },
                    #     "display_title": "David Michaels",
                    #     "external_references": [],
                    #     "title": "David Michaels",
                    #     "contact_email": "david_michaels@hms.harvard.edu"
                    # }
                    #
                    # Looks like we want to check principals_allowed/{view,edit} for 'group.admin' ...
                    # For now only check the 'groups' element if present otherwise ignore that part of the check below.
                    #
                    # And BTW here is another sample record from the same source:
                    # {
                    #       "lab": "/labs/4dn-dcic-lab/",
                    #       "tags": [
                    #            "skip_oh_synchronization"
                    #        ],
                    #        "email": "kent_pitman@hms.harvard.edu",
                    #        "groups": [
                    #            "admin"
                    #        ],
                    #        "status": "current",
                    #        "timezone": "US/Eastern",
                    #        "job_title": "Software Developer",
                    #        "last_name": "Pitman",
                    #        "first_name": "Kent",
                    #        "submits_for": [
                    #            "/labs/4dn-dcic-lab/"
                    #        ],
                    #        "date_created": "2020-01-06T21:24:22.260908+00:00",
                    #        "submitted_by": "/users/1a12362f-4eb6-4a9c-8173-776667226988/",
                    #        "last_modified": {
                    #            "modified_by": "/users/986b362f-4eb6-4a9c-8173-3ab267307e3a/",
                    #            "date_modified": "2021-03-04T21:20:45.428320+00:00"
                    #        },
                    #        "subscriptions": [
                    #            {
                    #                "url": "?submitted_by.uuid=1a12362f-4eb6-4a9c-8173-776667226&sort=-date_created",
                    #                "title": "My submissions"
                    #            },
                    #            {
                    #                "url": "?lab.uuid=828cd4fe-ebb0-4b36-a94a-d2e3a36cc989&sort=-date_created",
                    #                "title": "Submissions for my lab"
                    #            }
                    #        ],
                    #        "schema_version": "1",
                    #        "viewing_groups": [
                    #            "4DN"
                    #        ],
                    #        "@id": "/users/1a12362f-4eb6-4a9c-8173-776667226962/",
                    #        "@type": [
                    #            "User",
                    #            "Item"
                    #        ],
                    #        "uuid": "1a12362f-4eb6-4a9c-8173-776667226962",
                    #        "principals_allowed": {
                    #            "view": [
                    #                "group.admin",
                    #                "group.read-only-admin",
                    #                "remoteuser.EMBED",
                    #                "remoteuser.INDEXER",
                    #                "userid.1a12362f-4eb6-4a9c-8173-776667226962"
                    #            ],
                    #            "edit": [
                    #                "group.admin",
                    #                "userid.1a12362f-4eb6-4a9c-8173-776667226962"
                    #             ]
                    #        },
                    #        "display_title": "Kent Pitman",
                    #        "external_references": [],
                    #        "title": "Kent Pitman",
                    #        "contact_email": "kent_pitman@hms.harvard.edu"
                    # }
                    #
                    # if not ('admin' in user_res.get('groups') and payload.get('email_verified')):
                    #
                    groups = user_res.get('groups')
                    if not groups:
                        logger.warn("foursight_core.check_authorization: No 'groups' element for user record!")
                    if not ((not groups or 'admin' in groups) and jwt_decoded.get('email_verified')):
                        logger.error("foursight_core.check_authorization: Returning False")
                        # if unauthorized for one, unauthorized for all
                        return False
                    self.user_record = user_res
                logger.warn("foursight_core.check_authorization: Returning True")
                return True
            except Exception as e:
                logger.error("foursight_core.check_authorization: Exception on check_authorization")
                logger.error(e)
        logger.error("foursight_core.check_authorization: Returning False ")
        return False

    def auth0_callback(self, request, env):
        req_dict = request.to_dict()
        domain, context = self.get_domain_and_context(req_dict)
        # extract redir cookie
        cookies = req_dict.get('headers', {}).get('cookie')
        redir_url = context + 'view/' + env
        for cookie in cookies.split(';'):
            name, val = cookie.strip().split('=')
            if name == 'redir':
                redir_url = val
        resp_headers = {'Location': redir_url}
        params = req_dict.get('query_params')
        if not params:
            return self.forbidden_response()
        auth0_code = params.get('code', None)
        auth0_client = self.get_auth0_client_id(env)
        auth0_secret = self.get_auth0_secret(env)
        if not (domain and auth0_code and auth0_client and auth0_secret):
            return Response(status_code=301, body=json.dumps(resp_headers), headers=resp_headers)
        payload = {
            'grant_type': 'authorization_code',
            'client_id': auth0_client,
            'client_secret': auth0_secret,
            'code': auth0_code,
            'redirect_uri': ''.join(['https://', domain, context, 'callback/'])
        }
        json_payload = json.dumps(payload)
        headers = {'content-type': "application/json"}
        res = requests.post(self.OAUTH_TOKEN_URL, data=json_payload, headers=headers)
        id_token = res.json().get('id_token', None)
        if id_token:
            cookie_str = ''.join(['jwtToken=', id_token, '; Domain=', domain, '; Path=/;'])
            expires_in = res.json().get('expires_in', None)
            if expires_in:
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
        token = cookie_dict.get('jwtToken', None)
        return token

    def get_decoded_jwt_token(self, env_name: str, request_dict) -> dict:
        jwt_token = self.get_jwt_token(request_dict)
        if not jwt_token:
            return None
        auth0_client_id = self.get_auth0_client_id(env_name)
        auth0_secret = self.get_auth0_secret(env_name)
        # leeway accounts for clock drift between us and auth0
        return jwt.decode(jwt_token, auth0_secret, audience=auth0_client_id, leeway=30)

    @classmethod
    def get_favicon(cls):
        """
        Returns faviron
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
            if not value:
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

    def sorted_dict(self, dictionary: dict) -> dict:
        """
        Returns the given dictionary sorted by key values (yes, dictionaries are ordered as of Python 3.7).
        If the given value is not a dictionary it will be coerced to one.
        :param dictionary: Dictionary to sort.
        :return: Given dictionary sorted by key value.
        """
        dictionary = dict(dictionary)
        return {key: dictionary[key] for key in sorted(dictionary.keys(), key=lambda key: key.lower())}

    def get_aws_account_number(self) -> dict:
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

    def convert_utc_datetime_to_useastern_datetime(self, t) -> str:
        """
        Converts the given UTC datetime object or string into a US/Eastern datetime string
        and returns its value in a form that looks like 2022-08-22 13:25:34 EDT.
        If the argument is a string it is ASSUMED to have a value which looks
        like 2022-08-22T14:24:49.000+0000; this is the datetime string format
        we get from AWS via boto3 (e.g. for a lambda last-modified value).

        :param t: UTC datetime object or string value.
        :return: US/Eastern datetime string (e.g.: 2022-08-22 13:25:34 EDT).
        """
        try:
            if isinstance(t, str):
                t = datetime.datetime.strptime(t, "%Y-%m-%dT%H:%M:%S.%f%z")
            t = t.replace(tzinfo=pytz.UTC).astimezone(pytz.timezone("US/Eastern"))
            return t.strftime("%Y-%m-%d %H:%M:%S %Z")
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'convert_utc_datetime_to_useastern_datetime')
            return ""

    def convert_time_t_to_useastern_datetime(self, time_t: int) -> str:
        """
        Converts the given "epoch" time (seconds since 1970-01-01T00:00:00Z)
        integer value to a US/Eastern datetime string and returns its value
        in a form that looks like 2022-08-22 13:25:34 EDT.

        :param time_t: Epoch time value (i.e. seconds since 1970-01-01T00:00:00Z)
        :return: US/Eastern datetime string (e.g.: 2022-08-22 13:25:34 EDT).
        """
        try:
            if not isinstance(time_t, int):
                return ""
            t = datetime.datetime.fromtimestamp(time_t, tz=pytz.UTC)
            return self.convert_utc_datetime_to_useastern_datetime(t)
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'convert_time_t_to_useastern_datetime')
            return ""

    def ping_elasticsearch(self, env_name: str) -> bool:
        logger.warn(f"foursight_core: Pinging ElasticSearch: {self.host}")
        try:
            response = self.init_connection(env_name).connections["es"].test_connection()
            logger.warn(f"foursight_core: Done pinging ElasticSearch: {self.host}")
            return response
        except Exception as e:
            logger.warn(f"Exception pinging ElasticSearch ({self.host}): {e}")
            return False

    def ping_portal(self, env_name: str) -> bool:
        portal_url = ""
        try:
            portal_url = self.get_portal_url(env_name)
            logger.warn(f"foursight_core: Pinging portal: {portal_url}")
            response = requests.get(portal_url, timeout=4)
            logger.warn(f"foursight_core: Done pinging portal: {portal_url}")
            return (response.status_code == 200)
        except Exception as e:
            logger.warn(f"foursight_core: Exception pinging portal ({portal_url}): {e}")
            return False

    def ping_sqs(self) -> bool:
        sqs_url = ""
        try:
            sqs_url = self.sqs.get_sqs_queue().url
            logger.warn(f"foursight_core: Pinging SQS: {sqs_url}")
            sqs_attributes = self.sqs.get_sqs_attributes(sqs_url)
            logger.warn(f"foursight_core: Done pinging SQS: {sqs_url}")
            return (sqs_attributes is not None)
        except Exception as e:
            logger.warn(f"Exception pinging SQS ({sqs_url}): {e}")
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
        if not lambda_name or lambda_name.lower() == "current":
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
                logger.warn(f"Reloading lambda: {lambda_name}")
                boto_lambda.update_function_configuration(FunctionName=lambda_name, Description=lambda_description)
                logger.warn(f"Reloaded lambda: {lambda_name}")
        except Exception as e:
            logger.warn(f"Error reloading lambda ({lambda_name}): {e}")
        return False

    def get_lambda_last_modified(self, lambda_name: str = None) -> str:
        """
        Returns the last modified time for the given lambda name.
        See comments in reload_lambda on this.
        """
        lambda_current = False
        if not lambda_name or lambda_name.lower() == "current":
            lambda_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
            if not lambda_name:
                return None
            lambda_current = True
        if lambda_current:
            if self.lambda_last_modified:
                return self.lambda_last_modified
        try:
            boto_lambda = boto3.client("lambda")
            lambda_info = boto_lambda.get_function(FunctionName=lambda_name)
            if lambda_info:
                lambda_arn = lambda_info["Configuration"]["FunctionArn"]
                lambda_tags = boto_lambda.list_tags(Resource=lambda_arn)["Tags"]
                lambda_last_modified_tag = lambda_tags.get("last_modified")
                if lambda_last_modified_tag:
                    lambda_last_modified = self.convert_utc_datetime_to_useastern_datetime(lambda_last_modified_tag)
                else:
                    lambda_last_modified = lambda_info["Configuration"]["LastModified"]
                    lambda_last_modified = self.convert_utc_datetime_to_useastern_datetime(lambda_last_modified)
                if lambda_current:
                    self.lambda_last_modified = lambda_last_modified
                return lambda_last_modified
        except Exception as e:
            logger.warn(f"Error getting lambda ({lambda_name}) last modified time: {e}")
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
             "short": short_env_name(env),
             "full": full_env_name(env),
             "inferred": infer_foursight_from_env(envname=env)} for env in unique_environment_names]
        return sorted(unique_annotated_environment_names, key=lambda key: key["full"])

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
            view_envs=total_envs,
            stage=self.stage.get_stage(),
            load_time=self.get_load_time(),
            init_load_time=self.init_load_time,
            lambda_deployed_time=self.get_lambda_last_modified(),
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            running_checks=running_checks,
            queued_checks=queued_checks,
            favicon=first_env_favicon,
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
            "Environment Name (Inferred):": infer_foursight_from_env(envname=environ),
            "Environment Name List:": sorted(self.environment.list_environment_names()),
            "Environment Name List (Unique):": sorted(self.environment.list_unique_environment_names())
        }
        bucket_names = {
            "Environment Bucket Name:": self.environment.get_env_bucket_name(),
            "Foursight Bucket Name:": get_foursight_bucket(envname=environ, stage=stage_name),
            "Foursight Bucket Prefix:": get_foursight_bucket_prefix()
        }
        gac_name = get_identity_name()
        gac_values = self.sorted_dict(obfuscate_dict(get_identity_secrets()))
        environment_and_bucket_info = self.sorted_dict(obfuscate_dict(
                                        self.environment.get_environment_and_bucket_info(environ, stage_name)))
        declared_data = self.sorted_dict(EnvUtils.declared_data())
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
        os_environ = self.sorted_dict(obfuscate_dict(dict(os.environ)))
        request_dict = request.to_dict()

        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            stage=stage_name,
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            user_record=self.user_record,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_credentials=aws_credentials,
            aws_account_number=aws_account_number,
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
        for this_email in email.split(","):
            try:
                this_user = ff_utils.get_metadata('users/' + this_email.lower(),
                                                  ff_env=full_env_name(environ), add_on='frame=object')
                users.append({"email": this_email, "record": this_user})
            except Exception as e:
                users.append({"email": this_email, "record": {"error": str(e)}})
        template = self.jin_env.get_template('user.html')
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            stage=stage_name,
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            users=users,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
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
        user_records = ff_utils.get_metadata('users/', ff_env=full_env_name(environ), add_on='frame=object&limit=10000')
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
                "modified": self.convert_utc_datetime_to_useastern_datetime(last_modified)})
        users = sorted(users, key=lambda key: key["email_address"])
        template = self.jin_env.get_template('users.html')
        html_resp.body = template.render(
            request=request,
            version=self.get_app_version(),
            package=self.APP_PACKAGE_NAME,
            env=environ,
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            stage=stage_name,
            is_admin=is_admin,
            is_running_locally=self.is_running_locally(request_dict),
            logged_in_as=self.get_logged_in_user_info(environ, request_dict),
            users=users,
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
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
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            running_checks=running_checks,
            queued_checks=queued_checks,
            favicon=first_env_favicon,
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

    def process_view_result(self, connection, res, is_admin):
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
                        res['assc_action'] = json.dumps(assc_action, indent=4)
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
            history = self.get_foursight_history(connection, check, start, limit)
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
            auth0_client_id=self.get_auth0_client_id(environ),
            aws_account_number=self.get_aws_account_number(),
            domain=domain,
            context=context,
            environments=self.get_unique_annotated_environment_names(),
            running_checks=running_checks,
            queued_checks=queued_checks,
            favicon=favicon,
            main_title=self.html_main_title
        )
        html_resp.status_code = 200
        return self.process_response(html_resp)

    def get_foursight_history(self, connection, check, start, limit):
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
            return []
        return result_obj.get_result_history(start, limit)

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

    def run_put_environment(self, environ, env_data):
        """
        Abstraction of the functionality of put_environment without the current_request
        to allow for testing.
        """
        proc_environ = environ.split('-')[-1] if environ.startswith('fourfront-') else environ
        if isinstance(env_data, dict) and {'fourfront', 'es'} <= set(env_data):
            ff_address = env_data['fourfront'] if env_data['fourfront'].endswith('/') else env_data['fourfront'] + '/'
            es_address = env_data['es'] if env_data['es'].endswith('/') else env_data['es'] + '/'
            ff_env = env_data['ff_env'] if 'ff_env' in env_data else ''.join(['fourfront-', proc_environ])
            env_entry = {
                'fourfront': ff_address,
                'es': es_address,
                'ff_env': ff_env
            }
            s3_connection = S3Connection(self.prefix + '-envs')
            s3_connection.put_object(proc_environ, json.dumps(env_entry))
            stage = self.stage.get_stage()
            s3_bucket = ''.join([self.prefix + '-', stage, '-', proc_environ])
            bucket_res = s3_connection.create_bucket(s3_bucket)
            if not bucket_res:
                response = Response(
                    body={
                        'status': 'error',
                        'description': f'Could not create bucket: {s3_bucket}',
                        'environment': proc_environ
                    },
                    status_code=500
                )
            else:
                # if not testing, queue checks with 'put_env' condition for the new env
                if 'test' not in self.stage.get_queue_name():
                    for sched in self.check_handler.get_schedule_names():
                        self.queue_scheduled_checks(environ, sched, conditions=['put_env'])
                response = Response(
                    body={
                        'status': 'success',
                        'description': ' '.join(['Succesfully made:', proc_environ]),
                        'environment': proc_environ
                    },
                    status_code=200
                )
        else:
            response = Response(
                body={
                    'status': 'error',
                    'description': 'Environment creation failed',
                    'body': env_data,
                    'environment': proc_environ
                },
                status_code=400
            )
        return self.process_response(response)

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

    @classmethod
    def run_delete_environment(cls, environ, bucket=None):
        """
        Removes the environ entry from the Foursight envs bucket. This effectively de-schedules all checks
        but does not remove any data.
        """
        if not bucket:
            bucket = cls.prefix + '-envs'
        s3_connection = S3Connection(bucket)
        s3_resp = s3_connection.delete_keys([environ])
        keys_deleted = s3_resp['Deleted']
        if not keys_deleted:
            response = Response(
                body={
                    'status': 'error',
                    'description': 'Unable to comply with request',
                    'environment': environ
                },
                status_code=400
            )
        else:
            our_key = keys_deleted[0]  # since we only passed one key to be deleted, response will be a length 1 list
            if our_key['Key'] != environ:
                response = Response(
                    body={
                        'status': 'error',
                        'description': 'An error occurred during environment deletion, please check S3 directly',
                        'environment': environ
                    },
                    status_code=400
                )
            else:  # we were successful
                response = Response(
                    body={
                        'status': 'success',
                        'details': f'Successfully deleted environment {environ}',
                        'environment': environ
                    },
                    status_code=200
                )
        return cls.process_response(response)

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
        queue = self.sqs.get_sqs_queue()
        if schedule_name is not None:
            if not self.environment.is_valid_environment_name(sched_environ, or_all=True):
                print(f'-RUN-> {sched_environ} is not a valid environment. Cannot queue.')
                return
            sched_environs = self.environment.get_selected_environment_names(sched_environ)
            check_schedule = self.check_handler.get_check_schedule(schedule_name, conditions)
            if not check_schedule:
                print(f'-RUN-> {schedule_name} is not a valid schedule. Cannot queue.')
                return
            for environ in sched_environs:
                # add the run info from 'all' as well as this specific environ
                check_vals = copy.copy(check_schedule.get('all', []))
                check_vals.extend(check_schedule.get(environ, []))
                self.sqs.send_sqs_messages(queue, environ, check_vals)
        runner_input = {'sqs_url': queue.url}
        for n in range(4):  # number of parallel runners to kick off
            self.sqs.invoke_check_runner(runner_input)
        return runner_input  # for testing purposes

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
        sqs_url = runner_input.get('sqs_url')
        if not sqs_url:
            return
        client = boto3.client('sqs')
        response = client.receive_message(
            QueueUrl=sqs_url,
            AttributeNames=['MessageGroupId'],
            MaxNumberOfMessages=1,
            VisibilityTimeout=300,
            WaitTimeSeconds=10
        )
        message = response.get('Messages', [{}])[0]
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
            already_run = self.collect_run_info(run_uuid)
            deps_w_uuid = ['/'.join([run_uuid, dep]) for dep in run_deps]
            finished_dependencies = set(deps_w_uuid).issubset(already_run)
            if not finished_dependencies:
                print(f'-RUN-> Not ready for: {run_name}')
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
                    print(f'-RUN-> Found existing action record: {rec_key}. Skipping')
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
                    print(f'-RUN-> Wrote action record: {rec_key}')
            run_result = self.check_handler.run_check_or_action(connection, run_name, run_kwargs)
            print('-RUN-> RESULT:  %s (uuid)' % str(run_result.get('uuid')))
            # invoke action if running a check and kwargs['queue_action'] matches stage
            stage = self.stage.get_stage()
            if run_result['type'] == 'check' and run_result['kwargs']['queue_action'] == stage:
                # must also have check.action and check.allow_action set
                if run_result['allow_action'] and run_result['action']:
                    action_params = {'check_name': run_result['name'],
                                     'called_by': run_result['kwargs']['uuid']}
                    try:
                        self.queue_action(run_env, run_result['action'],
                                          params=action_params, uuid=run_uuid)
                    except Exception as exc:
                        print('-RUN-> Could not queue action %s on stage %s with kwargs: %s. Error: %s'
                              % (run_result['action'], stage, action_params, str(exc)))
                    else:
                        print('-RUN-> Queued action %s on stage %s with kwargs: %s'
                              % (run_result['action'], stage, action_params))
            print(f'-RUN-> Finished: {run_name}')
            self.sqs.delete_message_and_propogate(runner_input, receipt, propogate=propogate)
            return run_result
        else:
            print(f'-RUN-> Recovered: {run_name}')
            self.sqs.recover_message_and_propogate(runner_input, receipt, propogate=propogate)
            return None

    @classmethod
    def collect_run_info(cls, run_uuid):
        """
        Returns a set of run checks under this run uuid
        """
        s3_connection = S3Connection(cls.prefix + '-runs')
        run_prefix = ''.join([run_uuid, '/'])
        complete = s3_connection.list_all_keys_w_prefix(run_prefix)
        # eliminate duplicates
        return set(complete)


class AppUtils(AppUtilsCore):  # for compatibility with older imports
    """
    Class AppUtils is the most high-level class that's used directy by Chalice object app.
    This class mostly contains the functionality defined in app_utils in original foursight,
    but the details are now inherited from AppUtilsCore, which is the recommended class to
    import if you're making an AppUtils in some other library.
    """
    pass
