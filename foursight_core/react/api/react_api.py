from chalice import Response, __version__ as chalice_version
import copy
import datetime
import json
import os
import pkg_resources
import platform
import requests
import socket
import time
from typing import Union
import urllib.parse
from itertools import chain
from dcicutils.env_utils import EnvUtils, get_foursight_bucket, get_foursight_bucket_prefix, full_env_name
from dcicutils import ff_utils
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import get_identity_name, get_identity_secrets
from ...app import app
from ...decorators import Decorators
from ...route_prefixes import ROUTE_PREFIX
from .auth import Auth
from .auth0_config import Auth0Config
from .aws_s3 import AwsS3
from .checks import Checks
from .cookie_utils import create_delete_cookie_string, create_set_cookie_string, read_cookie
from .datetime_utils import convert_datetime_to_time_t, convert_utc_datetime_to_useastern_datetime_string
from .encoding_utils import base64_decode_to_json
from .envs import Envs
from .gac import Gac
from .misc_utils import (
    get_request_arg,
    is_running_locally,
    sort_dictionary_by_case_insensitive_keys
)
from .react_routes import ReactRoutes
from .react_ui import ReactUi


class ReactApi(ReactRoutes):

    CONTENT_TYPE = "Content-Type"
    JSON_CONTENT_TYPE = "application/json"
    STANDARD_HEADERS = {CONTENT_TYPE: JSON_CONTENT_TYPE}

    _cached_header = {}

    def __init__(self):
        super(ReactApi, self).__init__()
        self._envs = Envs(app.core.get_unique_annotated_environment_names())
        self._auth0_config = Auth0Config(app.core.get_portal_url(self._envs.get_default_env()))
        self._auth = Auth(self._auth0_config.get_client(), self._auth0_config.get_secret(), self._envs)
        self._checks = Checks(app.core.check_handler.CHECK_SETUP, self._envs)
        self._react_ui = ReactUi(self)

    @staticmethod
    def create_response(http_status: int = 200,
                        body: Union[dict, list] = {},
                        headers: dict = {},
                        content_type: str = JSON_CONTENT_TYPE) -> Response:
        if not headers:
            headers = ReactApi.STANDARD_HEADERS
        if content_type:
            if id(headers) == id(ReactApi.STANDARD_HEADERS):
                headers = {**headers}
            headers[ReactApi.CONTENT_TYPE] = content_type
        return Response(status_code=http_status, body=body, headers=headers)

    @staticmethod
    def create_success_response(body: Union[dict, list] = {}, content_type: str = JSON_CONTENT_TYPE) -> Response:
        return ReactApi.create_response(http_status=200, body=body, content_type=content_type)

    @staticmethod
    def create_redirect_response(location: str, body: dict = {}, headers: dict = {}) -> Response:
        if not headers:
            headers = {}
        if location:
            headers["Location"] = location
        return ReactApi.create_response(http_status=302, body=body, headers=headers)

    @staticmethod
    def create_not_implemented_response(request: dict) -> Response:
        method = request.get("method")
        context = request.get("context")
        path = context.get("path") if isinstance(context, dict) else None
        body = {"error": "Not implemented.", "method": method, "path": path}
        return ReactApi.create_response(http_status=501, body=body)

    @staticmethod
    def create_forbidden_response() -> Response:
        """
        Note that this is different from the unauthenticated and/or unauthorized response
        if the user is not logged in or does not have access to the given environment.
        This is for other forbidden case, e.g. access to static files we restrict access to.
        """
        return ReactApi.create_response(http_status=403, body={"status": "Forbidden."})

    @staticmethod
    def create_error_response(message: str) -> Response:
        return ReactApi.create_response(http_status=500, body={"error": message})

    def _get_redirect_url(self, request: dict, env: str, domain: str, context: str) -> str:
        redirect_url = read_cookie(request, "reactredir")
        if not redirect_url:
            if is_running_locally(request):
                scheme = "http"
                # Using ROUTE_PREFIX here instead of context because may be just "/" for the local
                # deploy case because we get here via the /callback endpoint (during authentication).
                # Due to confusion between local deploy not implicitly using /api as context so setting
                # it explicitly; this is just so we are dealing with the same paths for either case.
                context = ROUTE_PREFIX
            else:
                scheme = "https"
            if not env:
                env = self._envs.get_default_env()
            if not context:
                context = "/"
            elif not context.endswith("/"):
                context = context + "/"
            redirect_url = f"{scheme}://{domain}{context}react/{env}/login"
        else:
            # Not certain if by design but the React library (universal-cookie) used to
            # write cookies URL-encodes them; rolling with it for now and URL-decoding here.
            redirect_url = urllib.parse.unquote(redirect_url)
        return redirect_url

    def _get_authentication_callback_url(self, request: dict) -> str:
        """
        Returns the URL for our authentication callback endpoint.
        Note this callback endpoint is (still) defined in the legacy Foursight routes.py.
        """
        domain, context = self.get_domain_and_context(request)
        headers = request.get("headers", {})
        scheme = headers.get("x-forwarded-proto", "http")
        if is_running_locally(request):
            context = "/"
        return f"{scheme}://{domain}{context}callback/?react"

    def is_react_authentication_callback(self, request: dict) -> bool:
        """
        Returns True iff the given Auth0 authentication/login callback request, i.e. from
        the /callback route which is defined in the main routes.py for both React and non-React
        Auth0 authentication/login, is for a React authentication/login. This is communicated
        via "react" URL parameter in the callback URL, which is setup on the React UI side;
        note this was PREVIOUSLY done there via a "react" string in Auth0 "scope", but changed
        so we can get the Auth0 config (e.g. domain) for the POST to Auth0 using our Auth0Config.
        See: react/src/pages/LoginPage/createAuth0Lock.
        """
        return get_request_arg(request, "react") is not None

    def react_authentication_callback(self, request: dict, env: str) -> Response:

        auth0_code = get_request_arg(request, "code")
        auth0_domain = self._auth0_config.get_domain()
        auth0_client = self._auth0_config.get_client()
        auth0_secret = self._auth0_config.get_secret()
        if not (auth0_code and auth0_domain and auth0_client and auth0_secret):
            return self.create_forbidden_response()

        # Not actually sure what this auth0_redirect_uri is needed
        # for, but needed it does seem to be, for this Auth0 POST;
        # it evidently needs to be (this) authentication callback URL.
        auth0_redirect_uri = self._get_authentication_callback_url(request)
        auth0_payload = {
            'grant_type': 'authorization_code',
            'client_id': auth0_client,
            'client_secret': auth0_secret,
            'code': auth0_code,
            'redirect_uri': auth0_redirect_uri
        }
        auth0_post_url = f"https://{auth0_domain}/oauth/token"

        auth0_payload_json = json.dumps(auth0_payload)
        auth0_headers = ReactApi.STANDARD_HEADERS
        auth0_response = requests.post(auth0_post_url, data=auth0_payload_json, headers=auth0_headers)
        auth0_response_json = auth0_response.json()
        jwt = auth0_response_json.get("id_token")

        if not jwt:
            return self.create_forbidden_response()

        jwt_expires_in = auth0_response_json.get("expires_in")
        jwt_expires_at = convert_datetime_to_time_t(datetime.datetime.utcnow() +
                                                    datetime.timedelta(seconds=jwt_expires_in))
        domain, context = self.get_domain_and_context(request)
        authtoken = self._auth.create_authtoken(jwt, jwt_expires_at, env, domain)
        authtoken_cookie = create_set_cookie_string(request, name="authtoken",
                                                    value=authtoken,
                                                    domain=domain,
                                                    expires=jwt_expires_at, http_only=False)
        redirect_url = self._get_redirect_url(request, env, domain, context)
        return self.create_redirect_response(location=redirect_url, headers={"Set-Cookie": authtoken_cookie})

    def react_authorize(self, request: dict, env: str) -> dict:
        """
        Exposed for call from "route" decorator for endpoint authentication protection.
        """
        return self._auth.authorize(request, env)

    def react_serve_static_file(self, env: str, paths: list) -> Response:
        return self._react_ui.serve_static_file(env, paths)

    # ----------------------------------------------------------------------------------------------
    # Below are the implementation functions corresponding directly to the routes in react_routes.
    # ----------------------------------------------------------------------------------------------

    def reactapi_auth0_config(self, request: dict, env: str):
        """
        Called from react_routes for endpoint: /reactapi/{environ}/auth0_config
        Note that this in an UNPROTECTED route.
        """
        auth0_config = self._auth0_config.get_config_data()
        # Note we add the callback for the UI to setup its Auth0 login for.
        auth0_config["callback"] = self._get_authentication_callback_url(request)
        return self.create_success_response(body=self._auth0_config.get_config_data())

    def reactapi_logout(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/logout
        Note that this in an UNPROTECTED route.
        """
        authorize_response = self.react_authorize(request, env)
        if not authorize_response or not authorize_response["authorized"]:
            body = {"status": "Already logged out."}
        else:
            body = {"status": "Logged out."}
        domain, context = app.core.get_domain_and_context(request)
        authtoken_cookie_deletion = create_delete_cookie_string(request=request, name="authtoken", domain=domain)
        redirect_url = self._get_redirect_url(request, env, domain, context)
        headers = {"Set-Cookie": authtoken_cookie_deletion}
        return self.create_redirect_response(location=redirect_url, body=body, headers=headers)

    def reactapi_header(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/header
        Note that this in an UNPROTECTED route.
        """
        # Note that this route is not protected but/and we return the results from authorize.
        auth = self._auth.authorize(request, env)
        data = ReactApi._cached_header.get(env)
        if not data:
            data = self._reactapi_header_nocache(request, env)
            ReactApi._cached_header[env] = data
        data = copy.deepcopy(data)
        data["auth"] = auth
        # 2022-10-18
        # No longer sharing known-envs widely; send only if authenticated;
        # if not authenticated then act as-if the default-env is the only known-env,
        # and in this case also include (as an FYI for the UI) the real number of known-envs.
        if auth["authenticated"]:
            data["auth"]["known_envs"] = self._envs.get_known_envs_with_gac_names()
        else:
            known_envs_default = self._envs.find_known_env(self._envs.get_default_env())
            known_envs_actual_count = self._envs.get_known_envs_count()
            data["auth"]["known_envs"] = [known_envs_default]
            data["auth"]["known_envs_actual_count"] = known_envs_actual_count
        data["timestamp"] = convert_utc_datetime_to_useastern_datetime_string(datetime.datetime.utcnow())
        response = self.create_success_response()
        response.body = data
        return response

    def _reactapi_header_nocache(self, request: dict, env: str) -> Response:
        """
        No-cache version of above reactapi_header function.
        """
        domain, context = app.core.get_domain_and_context(request)
        stage_name = app.core.stage.get_stage()
        default_env = self._envs.get_default_env()
        aws_credentials = self._auth.get_aws_credentials(env if env else default_env)
        response = {
            "app": {
                "title": app.core.html_main_title,
                "package": app.core.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": app.core.get_app_version(),
                "domain": domain,
                "context": context,
                "local": is_running_locally(request),
                "credentials": {
                    "aws_account_number": aws_credentials["aws_account_number"],
                    "aws_account_name": aws_credentials["aws_account_name"]
                },
                "launched": app.core.init_load_time,
                "deployed": app.core.get_lambda_last_modified()
            },
            "versions": {
                "foursight": app.core.get_app_version(),
                "foursight_core": pkg_resources.get_distribution('foursight-core').version,
                "dcicutils": pkg_resources.get_distribution('dcicutils').version,
                "python": platform.python_version(),
                "chalice": chalice_version
            },
        }
        return response

    def reactapi_info(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/info
        """
        domain, context = app.core.get_domain_and_context(request)
        stage_name = app.core.stage.get_stage()
        default_env = self._envs.get_default_env()
        if not self._envs.is_known_env(env):
            env_unknown = True
        else:
            env_unknown = False
        if not env_unknown:
            try:
                environment_and_bucket_info = sort_dictionary_by_case_insensitive_keys(
                    obfuscate_dict(app.core.environment.get_environment_and_bucket_info(env, stage_name))),
                portal_url = app.core.get_portal_url(env)
            except Exception as e:
                environment_and_bucket_info = None
                portal_url = None
        else:
            environment_and_bucket_info = None
            portal_url = None
        # Get known envs with GAC name for each.
        response = self.create_success_response()
        response.body = {
            "app": {
                "title": app.core.html_main_title,
                "package": app.core.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": app.core.get_app_version(),
                "domain": domain,
                "context": context,
                "local": is_running_locally(request),
                "credentials": self._auth.get_aws_credentials(env if env else default_env),
                "launched": app.core.init_load_time,
                "deployed": app.core.get_lambda_last_modified()
            },
            "versions": {
                "foursight": app.core.get_app_version(),
                "foursight_core": pkg_resources.get_distribution('foursight-core').version,
                "dcicutils": pkg_resources.get_distribution('dcicutils').version,
                "python": platform.python_version(),
                "chalice": chalice_version
            },
            "server": {
                "foursight": socket.gethostname(),
                "portal": portal_url,
                "es": app.core.host,
                "rds": os.environ["RDS_HOSTNAME"],
                # TODO: cache this (slow).
                "sqs": app.core.sqs.get_sqs_queue().url,
            },
            # TODO: cache this (slow).
            "buckets": {
                "env": app.core.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=env if env else default_env, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": environment_and_bucket_info,
                "ecosystem": sort_dictionary_by_case_insensitive_keys(EnvUtils.declared_data()),
            },
            "page": {
                "path": request.get("context").get("path"),
                "endpoint": request.get("path"),
                "loaded": app.core.get_load_time()
            },
            # TODD: Move these out to another API.
            "checks": {
                "running": 0,
                "queued": 0
            },
            "known_envs": self._envs.get_known_envs_with_gac_names(),
            # TODO: cache this (slow).
            "gac": {
                "name": get_identity_name(),
                "values": sort_dictionary_by_case_insensitive_keys(obfuscate_dict(get_identity_secrets())),
             },
            "environ": sort_dictionary_by_case_insensitive_keys(obfuscate_dict(dict(os.environ)))

            ,"xyzzy": self._envs.is_same_env.cache_info()
        }
        return response

    def reactapi_users(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/users
        Returns info on all users. TODO: No paging supported yet!
        """
        users = []
        # TODO: Support paging.
        # TODO: Consider adding ability to search for both normal users and
        #       admin/foursight users (who would have access to foursight);
        #       and more advanced, the ability to grant foursight access.
        user_records = ff_utils.get_metadata('users/', ff_env=full_env_name(env), add_on='frame=object&limit=10000')
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
                "modified": convert_utc_datetime_to_useastern_datetime_string(last_modified)})
        response = self.create_success_response()
        response.body = sorted(users, key=lambda key: key["email_address"])
        return response

    def reactapi_get_user(self, request: dict, env: str, email: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/user/{email}
        Returns info on the specified user (email).
        """
        users = []
        for email_address in email.split(","):
            try:
                user = ff_utils.get_metadata('users/' + email_address.lower(),
                                             ff_env=full_env_name(env), add_on='frame=object')
                users.append({"email_address": email_address, "record": user})
            except Exception as e:
                users.append({"email_address": email_address, "record": {"error": str(e)}})
        response = self.create_success_response()
        response.body = sorted(users, key=lambda key: key["email_address"])
        return response

    def reactapi_checks(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks
        Returns a summary (list) of all defined checks.
        """
        response = self.create_success_response()
        response.body = self._checks.get_checks_grouped(env)
        return response

    def reactapi_check_results(self, request: dict, env: str, check: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks/{check}
        Returns the latest result from the given check (name).
        """
        response = self.create_success_response()
        try:
            connection = app.core.init_connection(env)
            check_results = app.core.CheckResult(connection, check)
            check_results = check_results.get_latest_result()
            uuid = check_results["uuid"]
            check_datetime = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
            check_datetime = convert_utc_datetime_to_useastern_datetime_string(check_datetime)
            check_results["timestamp"] = check_datetime
            response.body = check_results
        except Exception as e:
            response.body = {}
        return response

    def reactapi_check_result(self, request: dict, env: str, check: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks/{check}/{uuid}
        Returns the check result for the given check (name) and uuid.
        Analogous legacy function is app_utils.view_foursight_check.
        """
        response = []
        servers = []
        try:
            connection = app.core.init_connection(env)
        except Exception as e:
            connection = None
        if connection:
            servers.append(connection.ff_server)
            check_result = app.core.CheckResult(connection, check)
            if check_result:
                data = check_result.get_result_by_uuid(uuid)
                if data is None:
                    # the check hasn't run. Return a placeholder view
                    data = {
                        'name': check,
                        'uuid': uuid,
                        'status': 'ERROR',  # in this case we just queued a check, so ERROR is ok
                        'summary': 'Check has not yet run',
                        'description': 'Check has not yet run'
                    }
                title = app.core.check_handler.get_check_title_from_setup(check)
                processed_result = app.core.process_view_result(connection, data, is_admin=True)
                response.append({
                    'status': 'success',
                    'env': env,
                    'checks': {title: processed_result}
                })
        return response

    def reactapi_checks_history(self, request: dict, env: str,
                                check: str, offset: int = 0, limit: int = 25, sort: str = None) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks/check/history
        Returns a (paged) summary (list) of check results for the given check (name).
        """
        if offset < 0:
            offset = 0
        if limit < 0:
            limit = 0
        response = self.create_success_response()
        check_record = self._checks.get_check(env, check)
        connection = app.core.init_connection(env)
        history, total = app.core.get_foursight_history(connection, check, offset, limit, sort)
        history_kwargs = list(set(chain.from_iterable([item[2] for item in history])))
        queue_attr = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        running_checks = queue_attr.get('ApproximateNumberOfMessagesNotVisible')
        queued_checks = queue_attr.get('ApproximateNumberOfMessages')
        for item in history:
            for subitem in item:
                if isinstance(subitem, dict):
                    uuid = subitem.get("uuid")
                    if uuid:
                        timestamp = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
                        timestamp = convert_utc_datetime_to_useastern_datetime_string(timestamp)
                        subitem["timestamp"] = timestamp
        history = {
            "check": check_record,
            "env": env,
            "history_kwargs": history_kwargs,
            "paging": {
                "total": total,
                "count": len(history),
                "limit": min(limit, total),
                "offset": min(offset, total),
                "more": max(total - offset - limit, 0)
            },
            "list": history
        }
        response.body = history
        return response

    def reactapi_checks_run(self, request: dict, env: str, check: str, args: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks/{check}/run
        Kicks off a run for the given check (name).
        """
        response = self.create_success_response()
        args = base64_decode_to_json(args)
        queued_uuid = app.core.queue_check(env, check, args)
        response.body = {"check": check, "env": env, "uuid": queued_uuid}
        return response

    def reactapi_checks_status(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks-status
        Returns the status of any/all currently running or queued checks.
        """
        response = self.create_success_response()
        checks_queue = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        checks_running = checks_queue.get('ApproximateNumberOfMessagesNotVisible')
        checks_queued = checks_queue.get('ApproximateNumberOfMessages')
        response.body = {
            "checks_running": checks_running,
            "checks_queued": checks_queued
        }
        return response

    def reactapi_checks_raw(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks-raw
        Returns the content of the raw/original check_setup.json file.
        """
        response = self.create_success_response()
        response.body = self._checks.get_checks_raw()
        return response

    def reactapi_checks_registry(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/checks-registry
        Returns the content of the checks registry collected for the check_function
        decorator in decorators.py.
        """
        response = self.create_success_response()
        response.body = Decorators.get_registry()
        return response

    def reactapi_lambdas(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/lambdas
        Returns a summary (list) of all defined AWS lambdas for the current AWS environment.
        """
        response = self.create_success_response()
        response.body = self._checks.get_annotated_lambdas()
        return response

    def reactapi_gac_compare(self, request: dict, env: str, env_compare: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/gac/{environ_compare}
        Returns differences between two GACs (global application configurations).
        """
        response = self.create_success_response()
        response.body = Gac.compare_gacs(env, env_compare)
        return response

    def reactapi_aws_s3_buckets(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/s3/buckets
        Return a list of all AWS S3 bucket names for the current AWS environment.
        """
        response = self.create_success_response()
        response.body = AwsS3.get_buckets()
        return response

    def reactapi_aws_s3_buckets_keys(self, request: dict, env: str, bucket: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/s3/buckets/{bucket}
        Return a list of all AWS S3 bucket key names in the given bucket
        for the current AWS environment.
        """
        response = self.create_success_response()
        response.body = AwsS3.get_bucket_keys(bucket)
        return response

    def reactapi_aws_s3_buckets_key_contents(self, request: dict, env: str, bucket: str, key: str) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/{environ}/s3/buckets/{bucket}/{key}
        Return the contents of the AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        if True:
            #
            # TODO!!!
            # Disabling this feature for now until we can discuss/resolve security concerns.
            #
            return self.create_not_implemented_response(request)
        key = urllib.parse.unquote(key)
        response = self.create_success_response()
        response.body = AwsS3.get_bucket_key_contents(bucket, key)
        return response

    def reactapi_reload_lambda(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/__reloadlambda__
        Kicks off a reload of the given lambda name. For troubleshooting only.
        """
        app.core.reload_lambda()
        time.sleep(3)
        return self.create_success_response(body={"status": "OK"})

    def reactapi_clear_cache(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: /reactapi/__clearcache___
        Not yet implemented.
        """
        self.cache_clear()
        return self.create_not_implemented_response(request)

    def cache_clear(self) -> None:
        self._auth.cache_clear()
        self._auth0_config.cache_clear()
        self._envs.cache_clear()
        Gac.cache_clear()
        self._cached_header = {}
