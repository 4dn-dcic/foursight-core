from chalice import Response, __version__ as chalice_version
import copy
import datetime
import io
import json
import os
import pkg_resources
import platform
import requests
import socket
import time
from typing import Optional
import urllib.parse
from itertools import chain
from dcicutils.env_utils import EnvUtils, get_foursight_bucket, get_foursight_bucket_prefix, full_env_name
from dcicutils.env_utils import get_portal_url as env_utils_get_portal_url
from dcicutils.function_cache_decorator import function_cache, function_cache_info, function_cache_clear
from dcicutils import ff_utils
from dcicutils.misc_utils import get_error_message, ignored
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.redis_tools import RedisSessionToken, SESSION_TOKEN_COOKIE
from dcicutils.ssl_certificate_utils import get_ssl_certificate_info
from ...app import app
from .auth import AUTH_TOKEN_COOKIE
from .auth import Auth
from .aws_network import (
    aws_get_network, aws_get_security_groups,
    aws_get_security_group_rules, aws_get_subnets, aws_get_vpcs
)
from .aws_s3 import AwsS3
from .aws_stacks import (
    aws_get_stack, aws_get_stacks,
    aws_get_stack_outputs, aws_get_stack_parameters,
    aws_get_stack_resources, aws_get_stack_template,
)
from .checks import Checks
from .cognito import get_cognito_oauth_config, handle_cognito_oauth_callback
from .cookie_utils import create_delete_cookie_string, read_cookie, read_cookie_bool, read_cookie_int
from .datetime_utils import convert_uptime_to_datetime, convert_utc_datetime_to_useastern_datetime_string
from .encryption import Encryption
from .encoding_utils import base64_decode_to_json
from .gac import Gac
from .misc_utils import (
    get_base_url,
    is_running_locally,
    sort_dictionary_by_case_insensitive_keys
)
from .portal_access_key_utils import get_portal_access_key_info
from .react_routes import ReactRoutes
from .react_api_base import ReactApiBase
from .react_ui import ReactUi


# Implementation functions corresponding directly to the routes in react_routes.
class ReactApi(ReactApiBase, ReactRoutes):

    def __init__(self):
        super(ReactApi, self).__init__()
        self._react_ui = ReactUi(self)
        self._checks = Checks(app.core.check_handler.CHECK_SETUP, self._envs)

    @staticmethod
    def _get_stack_name() -> str:
        """
        Returns our AWS defined stack name, as specified by the STACK_NAME environment variable.
        """
        return os.environ.get("STACK_NAME")

    @function_cache(nocache=None)
    def _get_sqs_queue_url(self):
        return app.core.sqs.get_sqs_queue().url

    def _get_versions_object(self) -> dict:
        def get_package_version(package_name: str) -> Optional[str]:
            try:
                return pkg_resources.get_distribution(package_name).version
            except Exception:
                return None
        return {
                "foursight": app.core.get_app_version(),
                "foursight_core": get_package_version("foursight-core"),
                "dcicutils": get_package_version("dcicutils"),
                "tibanna": get_package_version("tibanna"),
                "tibanna_ff": get_package_version("tibanna-ff"),
                "python": platform.python_version(),
                "chalice": chalice_version,
                "elasticsearch_server": self._get_elasticsearch_server_version(),
                "elasticsearch": get_package_version("elasticsearch"),
                "elasticsearch_dsl": get_package_version("elasticsearch-dsl"),
                "redis": get_package_version("redis"),
                "redis_server": self._get_redis_server_version()
            }

    @function_cache(nokey=True, nocache=None)
    def _get_elasticsearch_server_version(self) -> Optional[str]:
        connection = app.core.init_connection(self._envs.get_default_env())
        es_info = connection.es_info()
        return es_info.get("version", {}).get("number")

    @function_cache(nokey=True, nocache=None)
    def _get_redis_server_version(self) -> Optional[str]:
        connection = app.core.init_connection(self._envs.get_default_env())
        redis_info = connection.redis_info()
        return redis_info.get("redis_version") if redis_info else None

    @function_cache
    def _get_user_projects(self, env: str, raw: bool = False) -> list:
        """
        Returns the list of available user projects.
        """
        connection = app.core.init_connection(env)
        projects = ff_utils.search_metadata(f'/search/?type=Project&datastore=database', key=connection.ff_keys)
        if projects and not raw:
            projects = [
                {
                    "id": project.get("@id"),
                    "uuid": project.get("uuid"),
                    "name": project.get("name"),
                    "title": project.get("title"),
                    "description": project.get("description")
                }
                for project in projects
            ]
        return projects

    @function_cache
    def _get_user_institutions(self, env: str, raw: bool = False) -> list:
        """
        Returns the list of available user institutions.
        """
        connection = app.core.init_connection(env)
        institutions = ff_utils.search_metadata(f'/search/?type=Institution', key=connection.ff_keys)

        def get_principle_investigator(institution):
            pi = institution.get("pi")
            return {"name": pi.get("display_title"), "uuid": pi.get("uuid"), "id": pi.get("@id")} if pi else None

        if institutions and not raw:
            institutions = [
                {
                    "id": institution.get("@id"),
                    "uuid": institution.get("uuid"),
                    "name": institution.get("name"),
                    "title": institution.get("title"),
                    "pi": get_principle_investigator(institution)
                }
                for institution in institutions
            ]
        return institutions

    @function_cache
    def _get_user_roles(self, env: str) -> list:
        ignored(env)
        #
        # The below enumerated user role values where copied from here:
        # https://github.com/dbmi-bgm/cgap-portal/blob/master/src/encoded/schemas/user.json#L69-L106
        #
        roles = [
            "clinician",
            "scientist",
            "developer",
            "director",
            "project_member",
            "patient",
            "other",
            "unknown"
        ]
        return [{"id": role, "name": role, "title": role.replace("_", " ").title()} for role in roles]

    @function_cache
    def _get_user_schema(self, env: str) -> dict:
        portal_url = get_base_url(app.core.get_portal_url(env))
        user_schema_url = f"{portal_url}/profiles/User.json?format=json"
        user_schema = requests.get(user_schema_url).json()
        return user_schema

    @function_cache
    def _get_user_statuses(self, env: str) -> list:
        user_schema = self._get_user_schema(env)
        user_schema_properties = user_schema.get("properties") if user_schema else None
        user_schema_status = user_schema_properties.get("status") if user_schema_properties else None
        user_schema_status_enum = user_schema_status.get("enum") if user_schema_status else None
        if not user_schema_status_enum:
            return []
        return [{"id": status, "name": status, "title": status.title()} for status in user_schema_status_enum]

    def react_serve_static_file(self, env: str, paths: list) -> Response:
        """
        Called from react_routes for static endpoints: /{env}/{path}/{etc}
        Serves static UI related (JavaScript, CSS, HTML) files.
        Note that this in an UNPROTECTED route.
        """
        return self._react_ui.serve_static_file(env, paths)

    def reactapi_auth0_config(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/auth0_config or /auth0_config
        Note that this in an UNPROTECTED route.
        """
        auth0_config = self._auth0_config.get_config_data()
        # Note we add the callback for the UI to setup its Auth0 login for.
        auth0_config["callback"] = self._auth0_config.get_callback_url(request)
        return self.create_success_response(self._auth0_config.get_config_data())

    def reactapi_cognito_config(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /cognito_config
        Returns AWS Cognito configuration for authentication; from environment variables or Secrets Manager;
        getting from one or the other happens in cognito.get_cognito_oauth_config.
        Note that this in an UNPROTECTED route.
        """
        return self.create_success_response(get_cognito_oauth_config(request))

    def reactapi_cognito_callback(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /cognito/callback
        This is actually called from our primary frontend (React) callback /api/react/cognito/callback
        which is redirected to from Cognito so it can pick up the ouath_pkce_key (sic) which is written
        to browser session storage by the React authentication kickoff code (Amplify.federatedSignIn).
        That value (ouath_pkce_key) is passed to this API as the code_verifier argument, along with the
        code argument which is passed to our primary callback. FYI note known typo in ouath_pkce_key.
        Note that this in an UNPROTECTED route.
        """
        envs = self._envs
        site = self.get_site_name()
        # Note that for now at least we use the Auth0 audience (aka client ID) and secret to JWT encode the
        # authtoken (for cookie-ing the user on successful login), for straightforward compatibilty with
        # existing Auth0 code. I.e. once we've done the initial (login) authentication/authorization we
        # act exactly like (as-if) previously implemented Auth0 based authentication.
        authtoken_audience = self._auth0_config.get_client()
        authtoken_secret = self._auth0_config.get_secret()
        response = handle_cognito_oauth_callback(request, envs, site, authtoken_audience, authtoken_secret)
        return self.create_success_response(response)

    def reactapi_logout(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/logout or GET /logout
        Note that this in an UNPROTECTED route.
        """
        authorize_response = self._auth.authorize(request, env)
        if not authorize_response or not authorize_response["authorized"]:
            body = {"status": "Already logged out."}
        else:
            body = {"status": "Logged out."}
        domain, context = app.core.get_domain_and_context(request)
        authtoken_cookie_deletion = create_delete_cookie_string(request=request, name=AUTH_TOKEN_COOKIE, domain=domain)
        c4_st_cookie_deletion = create_delete_cookie_string(request=request, name=SESSION_TOKEN_COOKIE, domain=domain)
        redirect_url = self.get_redirect_url(request, env, domain, context)
        # always delete both cookies on logout
        headers = {"Set-Cookie": [authtoken_cookie_deletion, c4_st_cookie_deletion]}
        redis_handler = self._auth.get_redis_handler()
        if redis_handler:
            redis_session_token = RedisSessionToken.from_redis(
                redis_handler=redis_handler,
                namespace=Auth.get_redis_namespace(env),
                token=read_cookie(request, SESSION_TOKEN_COOKIE)
            )
            if redis_session_token:
                redis_session_token.delete_session_token(redis_handler=redis_handler)
        return self.create_redirect_response(location=redirect_url, body=body, headers=headers)

    def reactapi_header(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/header
        Note that this in an UNPROTECTED route.
        """
        # Note that this route is not protected but/and we return the results from authorize.
        auth = self._auth.authorize(request, env)
        data = self._reactapi_header_cache(request, env)
        data = copy.deepcopy(data)
        data["auth"] = auth
        # 2022-10-18
        # No longer sharing known-envs widely; send only if authenticated;
        # if not authenticated then act as-if the default-env is the only known-env;
        # in this case also include (as an FYI for the UI) the real number of known-envs.
        if auth["authenticated"]:
            data["auth"]["known_envs"] = self._envs.get_known_envs_with_gac_names()
            logged_in = True
        else:
            logged_in = False
            known_envs_default = self._envs.find_known_env(self._envs.get_default_env())
            known_envs_actual_count = self._envs.get_known_envs_count()
            data["auth"]["known_envs"] = [known_envs_default]
            data["auth"]["known_envs_actual_count"] = known_envs_actual_count
        data["auth"]["default_env"] = self._envs.get_default_env()
        # Note that these "test_mode_xyz" cookies are for testing only
        # and if used must be manually set, e.g. via Chrome Developer Tools.
        test_mode_certificate_simulate_error = read_cookie_bool(request, "test_mode_certificate_simulate_error")
        if test_mode_certificate_simulate_error:
            data["portal"]["url"] = None
        # Note that we know that data["portal"]["url"] is explicitly set via _reactapi_header_cache.
        if not data["portal"].get("url"):
            # Here we did not get a Portal URL from the to app.core.get_portal_url (via _reactapi_header_cache).
            # That call ends up ultimately calling the Portal health endpoint (via s3Utils.get_synthetic_env_config
            # via environment.get_environment_and_bucket_info). So there may have been a problem with the Portal,
            # e.g. bad SSL certificate; we will get the Portal URL by other means, and from get get its SSL
            # certificate to help diagnose any problem with that. C4-1017 (April 2023).
            try:
                if test_mode_certificate_simulate_error:
                    raise Exception("test_mode_certificate_simulate_error")
                portal_url = app.core.get_portal_url(env or default_env, raise_exception=True)
                data["portal"]["url"] = portal_url
            except Exception as e:
                e = str(e)
                data_portal = data["portal"]
                data_portal["exception"] = e
                if "certifi" in e.lower():
                    data_portal["ssl_certificate_error"] = True
                portal_url = env_utils_get_portal_url(env)
                data_portal["url"] = portal_url
                data_portal["ssl_certificate"] = get_ssl_certificate_info(portal_url)
                if data_portal["ssl_certificate"]:
                    data_portal["ssl_certificate"]["name"] = "Portal"
                    data_portal["ssl_certificate"]["exception"] = e
        data["timestamp"] = convert_utc_datetime_to_useastern_datetime_string(datetime.datetime.utcnow())
        test_mode_access_key_simulate_error = read_cookie_bool(request, "test_mode_access_key_simulate_error")
        if auth.get("user_exception"): # or test_mode_access_key_simulate_error:
            # Since this call to get the Portal access key info can be relatively expensive, we don't want to
            # do it on every /header API call; so we only call it if, according to the user's authtoken cookie,
            # an exception was experienced when trying to authorize the user (via envs.get_user_auth_info) on
            # login, which if so, would indicate that the is likely a problem with the Portal access key.
            test_mode_access_key_expiration_warning_days = \
                read_cookie_int(request, "test_mode_access_key_expiration_warning_days")
            data["portal_access_key"] = get_portal_access_key_info(
                env,
                logged_in=logged_in,
                test_mode_access_key_simulate_error=test_mode_access_key_simulate_error,
                test_mode_access_key_expiration_warning_days=test_mode_access_key_expiration_warning_days)
            if data["portal_access_key"].get("invalid"):
                data["portal_access_key_error"] = True
        return self.create_success_response(data)

    @function_cache(key=lambda self, request, env: env)  # new as of 2023-04-27
    def _reactapi_header_cache(self, request: dict, env: str) -> dict:
        """
        No-cache version of above reactapi_header function.
        """
        domain, context = app.core.get_domain_and_context(request)
        stage_name = app.core.stage.get_stage()
        default_env = self._envs.get_default_env()
        aws_credentials = self._auth.get_aws_credentials(env or default_env)
        portal_url = app.core.get_portal_url(env or default_env)
        portal_base_url = get_base_url(portal_url)
        connection = app.core.init_connection(env)
        redis_url = connection.redis_url
        redis = connection.redis
        response = {
            "app": {
                "title": app.core.html_main_title,
                "package": app.core.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": app.core.get_app_version(),
                "domain": domain,
                "context": context,
                "stack": self._get_stack_name(),
                "local": is_running_locally(request),
                "credentials": {
                    "aws_account_number": aws_credentials.get("aws_account_number"),
                    "aws_account_name": aws_credentials.get("aws_account_name"),
                    "aws_access_key_id": aws_credentials.get("aws_access_key_id"),
                    "re_captcha_key": os.environ.get("reCaptchaKey", None)
                },
                "launched": app.core.init_load_time,
                "deployed": app.core.get_lambda_last_modified(),
                "accounts_file": self._get_accounts_file(),
                "accounts_file_from_s3": self._get_accounts_file_from_s3()
            },
            "versions": self._get_versions_object(),
            "portal": {
                "url": portal_url,
                "health_url": portal_base_url + "/health?format=json",
                "health_ui_url": portal_base_url + "/health"
            },
            "resources": {
                "es": app.core.host,
                "foursight": self.foursight_instance_url(request),
                "portal": portal_url,
                # TODO: May later want to rds_username and/or such.
                "rds": os.environ["RDS_HOSTNAME"],
                "redis": redis_url,
                "redis_running": redis is not None,
                "sqs": self._get_sqs_queue_url(),
            },
            "s3": {
                "bucket_org": os.environ.get("ENCODED_S3_BUCKET_ORG", os.environ.get("S3_BUCKET_ORG", None)),
                "global_env_bucket": os.environ.get("GLOBAL_ENV_BUCKET", os.environ.get("GLOBAL_BUCKET_ENV", None)),
                "encrypt_key_id": os.environ.get("S3_ENCRYPT_KEY_ID", None)
            }
        }
        return response

    def reactapi_certificates(self, request: dict, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /certificates
        Called from react_routes for endpoint: GET /{env}/certificates
        Note that this in an UNPROTECTED route.

        Returns a dictionary with pertinent publicly available information about the
        SSL certificate for this Foursight instance and the associated Portal instance.
        Of, if a hostname (or hostnames) URL argument is given, then instead returns
        SSL certificate info for the specified (comma-separated) list of hostnames.

        Here are the data points (properties) of the returned dictionary:

        active_at    issuer           owner_country
        exception    issuer_city      owner_entity
        expired      issuer_country   owner_state
        expires_at   issuer_entity    pem
        hostname     issuer_state     public_key_pem
        hostnames    owner            serial_number
        inactive     owner_city       invalid
        """
        hostnames = args.get("hostname", args.get("hostnames", None))
        response = []
        if hostnames and hostnames.lower() != "null":
            for hostname in hostnames.split(","):
                certificate = get_ssl_certificate_info(hostname.strip())
                if certificate:
                    response.append(certificate)
        else:
            test_mode_certificate_expiration_warning_days = \
                read_cookie_int(request, "test_mode_certificate_expiration_warning_days")
            foursight_url = self.foursight_instance_url(request)
            portal_url = env_utils_get_portal_url(self._envs.get_default_env())
            foursight_ssl_certificate_info = get_ssl_certificate_info(
                foursight_url, test_mode_certificate_expiration_warning_days=test_mode_certificate_expiration_warning_days)
            if foursight_ssl_certificate_info:
                foursight_ssl_certificate_info["name"] = "Foursight"
                response.append(foursight_ssl_certificate_info)
            portal_ssl_certificate_info = get_ssl_certificate_info(
                portal_url, test_mode_certificate_expiration_warning_days=test_mode_certificate_expiration_warning_days)
            if portal_ssl_certificate_info:
                portal_ssl_certificate_info["name"] = "Portal"
                response.append(portal_ssl_certificate_info)
        return self.create_success_response(response)

    def reactapi_portal_access_key(self, request: dict, args: Optional[dict] = None) -> Response:
        env = self._envs.get_default_env()
        auth = self._auth.authorize(request, env)
        logged_in = auth.get("authenticated")
        test_mode_access_key_simulate_error = read_cookie_bool(request, "test_mode_access_key_simulate_error")
        test_mode_access_key_expiration_warning_days = read_cookie_int(
                request, "test_mode_access_key_expiration_warning_days")
        response = get_portal_access_key_info(
            env,
            logged_in=logged_in,
            test_mode_access_key_simulate_error=test_mode_access_key_simulate_error,
            test_mode_access_key_expiration_warning_days=test_mode_access_key_expiration_warning_days)
        return self.create_success_response(response)

    def reactapi_elasticsearch(self) -> Response:
        try:
            return self.create_success_response(self._get_elasticsearch_server_version())
        except Exception as e:
            return self.create_error_response(get_error_message(e))

    @function_cache
    def _get_env_and_bucket_info(self, env: str, stage_name: str) -> dict:
        return sort_dictionary_by_case_insensitive_keys(
            obfuscate_dict(app.core.environment.get_environment_and_bucket_info(env, stage_name)))

    @function_cache
    def _get_check_result_bucket_name(self, env: str) -> Optional[str]:
        envs = app.core.init_environments(env=env)
        if not envs:
            return None
        env = envs.get(env)
        return env.get("bucket") if env else None

    def reactapi_info(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/info
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
                environment_and_bucket_info = self._get_env_and_bucket_info(env, stage_name)
                portal_url = app.core.get_portal_url(env)
            except Exception:
                environment_and_bucket_info = None
                portal_url = None
        else:
            environment_and_bucket_info = None
            portal_url = None
        lambda_function_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        lambdas = self._checks.get_annotated_lambdas(env)
        lambda_function_info = [info for info in lambdas if info.get("lambda_function_name") == lambda_function_name]
        if len(lambda_function_info) == 1:
            lambda_function_info = lambda_function_info[0]
        else:
            lambda_function_info = {}
        # Get known envs with GAC name for each.
        body = {
            "app": {
                "title": app.core.html_main_title,
                "package": app.core.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": app.core.get_app_version(),
                "domain": domain,
                "context": context,
                "stack": self._get_stack_name(),
                "local": is_running_locally(request),
                "credentials": self._auth.get_aws_credentials(env or default_env),
                "launched": app.core.init_load_time,
                "deployed": app.core.get_lambda_last_modified(),
                "lambda": lambda_function_info
            },
            "versions": self._get_versions_object(),
            "server": {
                "foursight": socket.gethostname(),
                "portal": portal_url,
                "es": app.core.host,
                "rds": os.environ["RDS_HOSTNAME"],
                "sqs": self._get_sqs_queue_url(),
            },
            "buckets": {
                "env": app.core.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=env or default_env, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": environment_and_bucket_info,
                "ecosystem": sort_dictionary_by_case_insensitive_keys(EnvUtils.declared_data()),
            },
            "page": {
                "path": request.get("context").get("path"),
                "endpoint": request.get("path"),
                "loaded": app.core.get_load_time()
            },
            "checks": {
                "file": app.core.check_handler.CHECK_SETUP_FILE,
                "bucket": self._get_check_result_bucket_name(env or default_env)
            },
            "known_envs": self._envs.get_known_envs_with_gac_names(),
            "gac": Gac.get_gac_info(),
            "environ": sort_dictionary_by_case_insensitive_keys(obfuscate_dict(dict(os.environ)))
        }
        return self.create_success_response(body)

    def _create_user_record_for_output(self, user: dict) -> dict:
        """
        Canonicalizes and returns the given raw user record from our database
        into a common form used by our UI.

        WRT roles: Roles are in ElasticSearch as an array property (named "project_roles")
        of objects each containing a "project" and a "role" property. We send this array back
        to the frontend as-is (but named just "roles"); we also send back the "project" property;
        but we do NOT send back a single "role" property, rather then UI displays the role, from
        the "roles" property, associated with the "project" property. On edit/update/create, the
        UI, in addition to sending back the "roles" property as received (from here), DOES send a
        single "role" property, as well the "project" property; this role will then be associated
        with this project in the "project_roles" property when writing the record to ElasticSearch.
        """
        last_modified = user.get("last_modified")
        if isinstance(last_modified, dict):
            updated = last_modified.get("date_modified") or user.get("date_created")
        else:
            updated = user.get("date_created")
        return {
            # Lower case email to avoid any possible issues on lookup later.
            "email": (user.get("email") or "").lower(),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "uuid": user.get("uuid"),
            "title": user.get("title"),
            "groups": user.get("groups"),
            "project": user.get("project"),
            "institution": user.get("user_institution"),
            "roles": user.get("project_roles"),
            "status": user.get("status"),
            "updated": convert_utc_datetime_to_useastern_datetime_string(updated),
            "created": convert_utc_datetime_to_useastern_datetime_string(user.get("date_created"))
        }

    def _create_user_record_from_input(self, user: dict, include_deletes: bool = False) -> dict:
        """
        Canonicalizes and returns the given user record from our UI into the
        common format suitable for insert/update to our database. Modifies input.
        Please see comment above (in _create_user_record_for_output) WRT roles.
        """
        user = copy.deepcopy(user)
        # TODO
        # Handle these "-" checking things in the (React) UI!
        if self.is_foursight_fourfront():
            if "institution" in user:
                del user["institution"]
            if "project" in user:
                del user["project"]
            if "role" in user:
                del user["role"]
            if "roles" in user:
                del user["roles"]
            if "status" in user:
                if not user["status"] or user["status"] == "-":
                    del user["status"]
            return user

        deletes = []
        if "status" in user:
            if not user["status"] or user["status"] == "-":
                deletes.append("status")
                del user["status"]
        if "institution" in user:
            user["user_institution"] = user["institution"]
            del user["institution"]
        # If project and/or user_institution is present but is empty then remove altogether.
        if "roles" in user:
            user["project_roles"] = user["roles"]
        if "user_institution" in user:
            if not user["user_institution"] or user["user_institution"] == "-":
                deletes.append("user_institution")
                del user["user_institution"]
        if "project" in user:
            if not user["project"] or user["project"] == "-":
                deletes.append("project")
                del user["project"]
            elif "role" in user:
                project = user["project"]
                if not user["role"] or user["role"] == "-":
                    del user["role"]
                else:
                    role = user["role"]
                    project_roles = user.get("roles")
                    if project_roles:
                        found = False
                        for project_role in project_roles:
                            if project_role.get("project") == project:
                                project_role["role"] = role
                                found = True
                                break
                        if not found:
                            project_roles.append({"role": role, "project": project})
                    else:
                        user["project_roles"] = [{"role": role, "project": project}]
        if "role" in user:
            del user["role"]
        if "roles" in user:
            del user["roles"]
        if include_deletes and deletes:
            user["deletes"] = deletes
        return user

    def reactapi_get_users(self, request: dict, env: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users
        Returns a (paged) summary of all users from ElasticSearch.
        Optional arguments (args) for the request are any of:
        - search: to search for the specified value.
        - limit: to limit the results to the specified number.
        - offset: to skip past the first specified number of results.
        - sort: to sort by the specified field name (optionally suffixed with .asc which is default or .desc);
                default is email.asc.
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        offset = int(args.get("offset", "0")) if args else 0
        if offset < 0:
            offset = 0
        limit = int(args.get("limit", "50")) if args else 25
        if limit < 0:
            limit = 0
        sort = urllib.parse.unquote(args.get("sort", "email.asc") if args else "email.asc")
        if sort.endswith(".desc"):
            sort = "-" + sort[:-5]
        elif sort.endswith(".asc"):
            sort = sort[:-4]
        raw = args.get("raw") == "true"
        search = args.get("search")

        users = []
        # TODO: Consider adding ability to search for both normal users and
        #       admin/foursight users (who would have access to foursight);
        #       and more advanced, the ability to grant foursight access.
        connection = app.core.init_connection(env)
        if search:
            # Though limit and offset (from) are supported by search_metadata, total counts don't seem to be (?);
            # very possibly missing something there; so for now get all results and to paging manually here.
            # results = ff_utils.search_metadata(f"/search/?type=User&frame=object&q={search}&limit={limit}&from={offset}&sort={sort}", key=connection.ff_keys, is_generator=True)
            results = ff_utils.search_metadata(f"/search/?type=User&frame=object&q={search}&sort={sort}",
                                               key=connection.ff_keys)
            total = len(results)
            if offset > 0:
                results = results[offset:]
            if len(results) > limit:
                results = results[:limit]
        else:
            add_on = f"frame=object&datastore=database&limit={limit}&from={offset}&sort={sort}"
            results = ff_utils.get_metadata("users/", ff_env=full_env_name(env), add_on=add_on,
                                            key=connection.ff_keys)
            total = results["total"]
            results = results["@graph"]

        for user in results: # results["@graph"]:
            users.append(self._create_user_record_for_output(user) if not raw else user)
        return self.create_success_response({
            "paging": {
                "total": total,
                "count": len(users),
                "limit": min(limit, total),
                "offset": min(offset, total),
                "more": max(total - offset - limit, 0)
            },
            "list": users
        })

    def reactapi_get_user(self, request: dict, env: str, uuid: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/user/{uuid}
        Returns info on the specified user uuid. The uuid can actually also
        be an email address; and can also be a comma-separated list of these;
        if just one requested then return a single object, otherwise return an array.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        raw = args.get("raw") == "true"
        users = []
        items = uuid.split(",")
        not_found_count = 0
        other_error_count = 0
        connection = app.core.init_connection(env)
        for item in items:
            try:
                # Note these call works for both email address or user UUID.
                # Note we must lower case the email to find the user. This is because all emails
                # in the database are lowercased; it causes issues with OAuth if we don't do this.
                user = ff_utils.get_metadata('users/' + item.lower(),
                                             ff_env=full_env_name(env), add_on='frame=object&datastore=database',
                                             key=connection.ff_keys)
                users.append(self._create_user_record_for_output(user) if not raw else user)
            except Exception as e:
                if "Not Found" in str(e):
                    not_found_count += 1
                else:
                    other_error_count += 1
                users.append({"error": str(e)})
        if other_error_count > 0:
            return self.create_response(500, users[0] if len(items) == 1 else users)
        elif not_found_count > 0:
            return self.create_response(404, users[0] if len(items) == 1 else users)
        else:
            return self.create_success_response(users[0] if len(items) == 1 else users)

    def reactapi_post_user(self, request: dict, env: str, user: dict) -> Response:
        """
        Called from react_routes for endpoint: POST /{env}/users
        Creates a new user described by the given data.
        Given user data looks like:
        {email': 'japrufrock@hms.harvard.edu', 'first_name': 'J. Alfred', 'last_name': 'Prufrock'}
        Returns the same response as GET /{env}/users/{uuid} (i.e. reactpi_get_user).
        """
        ignored(request)
        user = self._create_user_record_from_input(user, include_deletes=False)
        connection = app.core.init_connection(env)
        response = ff_utils.post_metadata(schema_name="users", post_item=user, ff_env=full_env_name(env),
                                          key=connection.ff_keys)
        # Response looks like:
        # {'status': 'success', '@type': ['result'], '@graph': [{'date_created': '2022-10-22T18:39:16.973680+00:00',
        # 'submitted_by': '/users/b5f738b6-455a-42e5-bc1c-77fbfd9b15d2/', 'schema_version': '1', 'status': 'current',
        # 'email': 'test_user@hms.harvard.edu', 'first_name': 'J. Alfred', 'last_name': 'Prufrock',
        # 'timezone': 'US/Eastern', 'last_modified': {'modified_by': '/users/b5f738b6-455a-42e5-bc1c-77fbfd9b15d2/',
        # 'date_modified': '2022-10-22T18:39:16.975477+00:00'}, '@id': '/users/03cb92c4-b086-47e5-a875-42a01dc63581/',
        # '@type': ['User', 'Item'], 'uuid': '03cb92c4-b086-47e5-a875-42a01dc63581', 'principals_allowed':
        # {'view': ['group.admin', 'remoteuser.EMBED', 'remoteuser.INDEXER', 'userid.03cb92c4-b086-47e5-a875-42a01dc6'],
        # 'edit': ['group.admin']}, 'display_title': 'J. Alfred Prufrock', 'title': 'J. Alfred Prufrock',
        # 'contact_email': 'test_user@hms.harvard.edu'}]}
        status = response.get("status")
        if status != "success":
            return self.create_error_response(json.dumps(response))
        graph = response.get("@graph")
        if not graph or not isinstance(graph, list) or len(graph) != 1:
            return self.create_error_response(json.dumps(response))
        created_user = self._create_user_record_for_output(graph[0])
        uuid = created_user.get("uuid")
        if not uuid:
            return self.create_error_response(json.dumps(response))
        return self.create_response(201, created_user)

    def reactapi_patch_user(self, request: dict, env: str, uuid: str, user: dict) -> Response:
        """
        Called from react_routes for endpoint: PATCH /{env}/users/{uuid}
        Updates the user identified by the given uuid with the given data.
        Returns the same response as GET /{env}/users/{uuid} (i.e. reactpi_get_user).
        """
        ignored(request)
        # Note that there may easily be a delay after update until the record is actually updated.
        # TODO: Find out precisely why this is so, and if and how to specially handle it on the client side.
        user = self._create_user_record_from_input(user, include_deletes=True)
        if "deletes" in user:
            add_on = "delete_fields=" + ",".join(user["deletes"])
            del user["deletes"]
        else:
            add_on = ""
        connection = app.core.init_connection(env)
        response = ff_utils.patch_metadata(obj_id=f"users/{uuid}", patch_item=user,
                                           ff_env=full_env_name(env), key=connection.ff_keys, add_on=add_on)
        status = response.get("status")
        if status != "success":
            return self.create_error_response(json.dumps(response))
        graph = response.get("@graph")
        if not graph or not isinstance(graph, list) or len(graph) != 1:
            return self.create_error_response(json.dumps(response))
        updated_user = self._create_user_record_for_output(graph[0])
        return self.create_success_response(updated_user)

    def reactapi_delete_user(self, request: dict, env: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: DELETE /{env}/users/{uuid}
        Deletes the user identified by the given uuid.
        """
        ignored(request)
        #
        # TODO
        # When ES7 has been fully merged/deployed pass this to these calls: skip_indexing=True
        #
        elasticsearch_server_version = self._get_elasticsearch_server_version()
        kwargs = {"skip_indexing": True} if elasticsearch_server_version >= "7" else {}
        connection = app.core.init_connection(env)
        ff_utils.delete_metadata(obj_id=f"users/{uuid}", ff_env=full_env_name(env), key=connection.ff_keys, **kwargs)
        ff_utils.purge_metadata(obj_id=f"users/{uuid}", ff_env=full_env_name(env), key=connection.ff_keys, **kwargs)
        return self.create_success_response({"status": "User deleted.", "uuid": uuid})

    def reactapi_users_institutions(self, request: dict, env: str, args: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/institutions
        Returns the list of available user institutions.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        if self.is_foursight_fourfront():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_institutions(env, raw))

    def reactapi_users_projects(self, request: dict, env: str, args: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/projects
        Returns the list of available user projects.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        if self.is_foursight_fourfront():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_projects(env, raw))

    def reactapi_users_roles(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/roles
        Returns the list of available user roles.
        """
        ignored(request)
        if self.is_foursight_fourfront():
            return self.create_success_response([])
        return self.create_success_response(self._get_user_roles(env))

    def reactapi_users_schema(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/schema
        Returns the ElasticSearch user schema.
        """
        ignored(request)
        return self.create_success_response(self._get_user_schema(env))

    def reactapi_users_statuses(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/status
        Returns the list of available user statuses.
        """
        ignored(request)
        return self.create_success_response(self._get_user_statuses(env))

    def reactapi_checks_ungrouped(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks
        Returns a summary (list) of all defined checks, NOT grouped by check group.
        For troubleshooting only.
        """
        ignored(request)
        return self.create_success_response(self._checks.get_checks(env))

    def reactapi_checks_grouped(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/grouped
        Returns a summary (list) of all defined checks, grouped by check group.
        """
        ignored(request)
        return self.create_success_response(self._checks.get_checks_grouped(env))

    def reactapi_checks_grouped_by_schedule(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/grouped/schedule
        Returns a summary (list) of all defined checks, grouped by schedule.
        """
        ignored(request)
        return self.create_success_response(self._checks.get_checks_grouped_by_schedule(env))

    def reactapi_checks_check(self, request: dict, env: str, check: str) -> Response:
        ignored(request)
        return self.create_success_response(self._checks.get_check(env, check))

    def reactapi_checks_history_latest(self, request: dict, env: str, check: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/history/latest
        Returns the latest result (singular) from the given check (name).
        """
        ignored(request)
        connection = app.core.init_connection(env)
        check_results = app.core.CheckResult(connection, check)
        if not check_results:
            return self.create_success_response({})
        check_results = check_results.get_latest_result()
        if not check_results:
            return self.create_success_response({})
        uuid = check_results["uuid"]
        if check_results.get("action"):
            check_results["action_title"] = " ".join(check_results["action"].split("_")).title()
        check_datetime = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
        check_datetime = convert_utc_datetime_to_useastern_datetime_string(check_datetime)
        check_results["timestamp"] = check_datetime
        return self.create_success_response(check_results)

    def reactapi_checks_history_uuid(self, request: dict, env: str, check: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/{uuid}
        Returns the check result for the given check (name) and uuid.
        Analogous legacy function is app_utils.view_foursight_check.
        TODO: No need to return array.
        """
        ignored(request)
        body = {}
        try:
            connection = app.core.init_connection(env)
        except Exception:
            connection = None
        if connection:
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
                processed_result = app.core.process_view_result(connection, data, is_admin=True, stringify=False)
                body = {
                    'status': 'success',
                    'env': env,
                    'checks': {title: processed_result}
                }
        return self.create_success_response(body)

    def reactapi_checks_history_recent(self, request: dict, env: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/history/recent.
        Returns the most results among all defined checks for the given environment.
        Does this by looping through each check and getting the 10 most recent results from each
        and then globally sorting (in descending order) each of those results by check run timestamp.
        Optional arguments (args) for the request are any of:
        - limit: to limit the results to the specified number; default is 25.
        """
        ignored(request)
        max_results_per_check = 10
        limit = int(args.get("limit", "25")) if args else 25
        if limit < 1:
            limit = 1
        results = []
        connection = app.core.init_connection(env)
        checks = self._checks.get_checks(env)
        for check_name in checks:
            group_name = checks[check_name]["group"]
            check_title = checks[check_name]["title"]
            recent_history, _ = app.core.get_foursight_history(connection, check_name,
                                                               0, max_results_per_check, "timestamp.desc")
            for result in recent_history:
                uuid = None
                duration = None
                state = None
                #
                # Oddly each result in the history list is an array like this:
                #
                # [ "PASS",
                #   "DB and ES item counts are equal",
                #   { "primary": true,
                #     "uuid": "2022-09-22T18:00:12.335344",
                #     "runtime_seconds": 12.3,
                #     "queue_action": "Not queued"
                #    },
                #    true
                # ]
                #
                # TODO: Do this same kind of sorting out of data below in
                #       reactapi_checks_history so the UI doesn't have to do it.
                #
                status = result[0]
                for item in result:
                    if isinstance(item, dict):
                        uuid = item.get("uuid")
                        duration = item.get("runtime_seconds")
                        state = item.get("queue_action")
                        break
                if uuid:
                    timestamp = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
                    timestamp = convert_utc_datetime_to_useastern_datetime_string(timestamp)
                    results.append({
                        "check": check_name,
                        "title": check_title,
                        "group": group_name,
                        "status": status,
                        "state": state,
                        "uuid": uuid,
                        "duration": duration,
                        "timestamp": timestamp
                    })
        results.sort(key=lambda value: value["timestamp"], reverse=True)
        results = results[:limit]
        return self.create_success_response(results)

    def reactapi_checks_history(self, request: dict, env: str, check: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/history
        Returns a (paged) summary (list) of check results for the given check (name).
        Optional arguments (args) for the request are any of:
        - limit: to limit the results to the specified number.
        - offset: to skip past the first specified number of results.
        - sort: to sort by the specified field name (optionally suffixed with .asc which is default or .desc);
                default value is timestamp.desc.
        """
        ignored(request)
        offset = int(args.get("offset", "0")) if args else 0
        if offset < 0:
            offset = 0
        limit = int(args.get("limit", "25")) if args else 25
        if limit < 0:
            limit = 0
        sort = args.get("sort", "timestamp.desc") if args else "timestamp.desc"
        sort = urllib.parse.unquote(sort)

        connection = app.core.init_connection(env)
        history, total = app.core.get_foursight_history(connection, check, offset, limit, sort)
        history_kwargs = list(set(chain.from_iterable([item[2] for item in history])))
        # queue_attr = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        for item in history:
            for subitem in item:
                if isinstance(subitem, dict):
                    uuid = subitem.get("uuid")
                    if uuid:
                        timestamp = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
                        timestamp = convert_utc_datetime_to_useastern_datetime_string(timestamp)
                        subitem["timestamp"] = timestamp
        body = {
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
        return self.create_success_response(body)

    def reactapi_checks_run(self, request: dict, env: str, check: str, args: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/run
        The args string, if any, is assumed to be a Base64 encoded JSON object.
        Kicks off a run for the given check (name).
        Arguments (args) for the request are any of:
        - args: Base-64 encode JSON object containing fields/values appropriate for the check run.
        """
        ignored(request)
        args = base64_decode_to_json(args) if args else None
        # This turns strings into ints/floats/etc appropriately.
        args = app.core.query_params_to_literals(args)
        queued_uuid = app.core.queue_check(env, check, args)
        return self.create_success_response({"check": check, "env": env, "uuid": queued_uuid})

    def reactapi_action_run(self, request: dict, env: str, action: str, args: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/action/{action}/run
        The args string, if any, is assumed to be a Base64 encoded JSON object.
        Kicks off a run for the given action (name).
        Arguments (args) for the request are any of:
        - args: Base-64 encode JSON object containing fields/values appropriate for the action run.
        """
        ignored(request)
        args = base64_decode_to_json(args) if args else {}
        # This turns strings into ints/floats/etc appropriately.
        args = app.core.query_params_to_literals(args)
        queued_uuid = app.core.queue_action(env, action, args)
        return self.create_success_response({"action": action, "env": env, "uuid": queued_uuid})

    def reactapi_checks_status(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks_status
        Returns the status of any/all currently running or queued checks.
        """
        ignored(request, env)
        checks_queue = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        checks_running = checks_queue.get('ApproximateNumberOfMessagesNotVisible')
        checks_queued = checks_queue.get('ApproximateNumberOfMessages')
        return self.create_success_response({"checks_running": checks_running, "checks_queued": checks_queued})

    def reactapi_checks_raw(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks_raw
        Returns the content of the raw/original check_setup.json file.
        """
        ignored(request, env)
        return self.create_success_response(self._checks.get_checks_raw())

    def reactapi_checks_registry(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks_registry
        Returns the content of the checks registry collected for the check_function
        decorator in decorators.py. For troubleshooting only.
        """
        ignored(request, env)
        return self.create_success_response(self._checks.get_registry())

    def reactapi_checks_validation(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks_validation
        Returns information about any problems with the checks setup.
        """
        ignored(request, env)
        response = {}
        checks_actions_registry = self._checks.get_registry()
        actions_with_no_associated_check = [item for _, item in checks_actions_registry.items()
                                            if item.get("kind") == "action" and not item.get("checks")
                                            and not item.get("name", "").startswith("test_")]
        if actions_with_no_associated_check:
            response["actions_with_no_associated_check"] = actions_with_no_associated_check
        return self.create_success_response(response)

    def reactapi_lambdas(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/lambdas
        Returns a summary (list) of all defined AWS lambdas for the current AWS environment.
        """
        ignored(request, env)
        # TODO: Filter out checks of lambas not in the env.
        return self.create_success_response(self._checks.get_annotated_lambdas(env))

    def reactapi_gac_compare(self, request: dict, env: str, env_compare: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/gac/{environ_compare}
        Returns differences between two GACs (global application configurations).
        """
        ignored(request, env)
        return self.create_success_response(Gac.compare_gacs(env, env_compare))

    def reactapi_aws_s3_buckets(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets
        Return a list of all AWS S3 bucket names for the current AWS environment.
        """
        ignored(request, env)
        return self.create_success_response(AwsS3.get_buckets())

    def reactapi_aws_s3_buckets_keys(self, request: dict, env: str, bucket: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets/{bucket}
        Return a list of all AWS S3 bucket key names in the given bucket
        for the current AWS environment.
        """
        ignored(request, env)
        return self.create_success_response(AwsS3.get_bucket_keys(bucket))

    def reactapi_aws_s3_buckets_key_contents(self, request: dict, env: str, bucket: str, key: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets/{bucket}/{key}
        Return the contents of the AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        ignored(env, bucket, key)
        #
        # TODO!!!
        # Disabling this feature for now until we can discuss/resolve security concerns.
        # key = urllib.parse.unquote(key)
        # return self.create_success_response(AwsS3.get_bucket_key_contents(bucket, key))
        #
        return self.create_not_implemented_response(request)

    # ----------------------------------------------------------------------------------------------
    # EXPERIMENTAL - /accounts page
    # ----------------------------------------------------------------------------------------------
    # Accounts page, driven by accounts.json file, to list all AWS environments and info.
    # For now we manually encrypt the accounts.json file and decrypt on read here, so that
    # we don't expose (in GitHub or PyPi) the accounts.json, with internal URLs, in plaintext.
    # We use the ENCODED_AUTH0_SECRET in the GAC as the encryption password.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    def _get_accounts_file() -> Optional[str]:
        """
        Returns the full path name to the accounts.json file if one was found or None if not.
        The search for this file happens at startup in AppUtilsCore construction time via its
        _locate_accounts_file function.
        """
        return app.core.accounts_file

    @staticmethod
    def _get_accounts_file_from_s3() -> Optional[str]:
        bucket = os.environ.get("GLOBAL_ENV_BUCKET", os.environ.get("GLOBAL_BUCKET_ENV", None))
        if not bucket:
            return None
        key = app.core.ACCOUNTS_FILE_NAME
        if not AwsS3.bucket_key_exists(bucket, key):
            return None
        return f"s3://{bucket}/{key}"

    def _get_accounts_from_s3(self, request: dict) -> Optional[dict]:
        # Let's not cache this for now, maybe change mind later, thus the OR True clause below.
        s3_uri = self._get_accounts_file_from_s3()
        if not s3_uri:
            return self._get_accounts_only_for_current_account(request)
        s3_uri = s3_uri.replace("s3://", "")
        s3_uri_components = s3_uri.split("/")
        if len(s3_uri_components) != 2:
            return self._get_accounts_only_for_current_account(request)
        bucket = s3_uri_components[0]
        key = s3_uri_components[1]
        accounts_json_content = AwsS3.get_bucket_key_contents(bucket, key)
        return self._read_accounts_json(accounts_json_content)

    def _get_accounts_only_for_current_account(self, request: dict) -> Optional[list]:
        aws_credentials = self._auth.get_aws_credentials(self._envs.get_default_env())
        if aws_credentials:
            account_name = aws_credentials.get("aws_account_name")
            if account_name:
                account_stage = app.core.stage.get_stage()
                account_id = account_name + ":" + account_stage
                return [{
                    "id": account_id,
                    "name": account_name,
                    "stage": account_stage,
                    "foursight_url": self.foursight_instance_url(request)
                }]
        return None

    @staticmethod
    def _read_accounts_json(accounts_json_content) -> dict:
        encryption = Encryption()
        accounts_json_content = encryption.decrypt(accounts_json_content)
        accounts_json = json.loads(accounts_json_content)
        for account in accounts_json:
            account_name = account.get("name")
            if account_name:
                account_stage = account.get("stage")
                if account_stage:
                    account["id"] = account_name + ":" + account_stage
                else:
                    account["id"] = account_name
        return accounts_json

    @function_cache(nocache=None)
    def _get_accounts(self) -> Optional[dict]:
        accounts_file = self._get_accounts_file()
        if not accounts_file:
            return None
        try:
            with io.open(self._get_accounts_file(), "r") as accounts_json_f:
                accounts_json_content_encrypted = accounts_json_f.read()
                accounts_json = self._read_accounts_json(accounts_json_content_encrypted)
                return accounts_json
        except Exception:
            return None

    def reactapi_accounts(self, request: dict, env: str, from_s3: bool = False) -> Response:
        ignored(env)
        accounts = self._get_accounts() if not from_s3 else self._get_accounts_from_s3(request)
        return self.create_success_response(accounts)

    def reactapi_account(self, request: dict, env: str, name: str, from_s3: bool = False) -> Response:

        def is_account_name_match(account: dict, name: str) -> bool:
            account_name = account.get("name")
            if account_name == name:
                return True
            account_name = account_name + ":" + account.get("stage")
            if account_name == name:
                return True
            return False

        def get_foursight_base_url(foursight_url: str) -> Optional[str]:
            return get_base_url(foursight_url) + "/api" if foursight_url else None

        def get_portal_base_url(portal_url: str) -> Optional[str]:
            return get_base_url(portal_url) if portal_url else None

        def is_this_server(url: str) -> bool:
            try:
                url_origin = urllib.parse.urlparse(url).netloc
                this_origin = request.get('headers', {}).get('host')
                return url_origin == this_origin
            except Exception:
                return False

        def get_foursight_info(foursight_url: str, response: dict) -> Optional[str]:
            response["foursight"] = {}
            if not foursight_url:
                return None
            response["foursight"]["url"] = get_foursight_base_url(foursight_url)
            if is_this_server(response["foursight"]["url"]):
                response["foursight"]["header_url"] = response["foursight"]["url"] + f"/reactapi/{env}/header"
            else:
                response["foursight"]["header_url"] = response["foursight"]["url"] + f"/reactapi/header"
            foursight_header_response = requests.get(response["foursight"]["header_url"])
            if foursight_header_response.status_code != 200:
                response["foursight"]["error"] = f"Cannot fetch Foursight header URL.",
                response["foursight"]["header_url_status"] = foursight_header_response.status_code
                return None
            foursight_header_json = foursight_header_response.json()
            response["foursight"]["versions"] = foursight_header_json["versions"]
            foursight_app = foursight_header_json.get("app")
            response["foursight"]["package"] = foursight_app.get("package")
            response["foursight"]["stage"] = foursight_app.get("stage")
            response["foursight"]["stack"] = foursight_app.get("stack")
            response["foursight"]["deployed"] = foursight_app.get("deployed")
            response["foursight"]["default_env"] = foursight_header_json["auth"]["known_envs"][0]
            response["foursight"]["env_count"] = foursight_header_json["auth"]["known_envs_actual_count"]
            response["foursight"]["identity"] = foursight_header_json["auth"]["known_envs"][0].get("gac_name")
            foursight_header_json_s3 = foursight_header_json.get("s3")
            # Older versions of the /header API might not have this s3 element so check.
            if foursight_header_json_s3:
                response["foursight"]["s3"] = {}
                response["foursight"]["s3"]["bucket_org"] = foursight_header_json_s3.get("bucket_org")
                response["foursight"]["s3"]["global_env_bucket"] = foursight_header_json_s3.get("global_env_bucket")
                response["foursight"]["s3"]["encrypt_key_id"] = foursight_header_json_s3.get("encrypt_key_id")
            response["foursight"]["aws_account_number"] = foursight_app["credentials"].get("aws_account_number")
            response["foursight"]["aws_account_name"] = foursight_app["credentials"].get("aws_account_name")
            response["foursight"]["re_captcha_key"] = foursight_app["credentials"].get("re_captcha_key")
            if response["foursight"]["re_captcha_key"] and "ENTER VALUE" in response["foursight"]["re_captcha_key"]:
                response["foursight"]["re_captcha_key"] = None
            response["foursight"]["auth0_client"] = foursight_header_json["auth"]["aud"]
            foursight_header_json_portal = foursight_header_json.get("portal")
            if not foursight_header_json_portal:
                response["foursight"]["portal_url"] = None
                return None
            portal_url = get_portal_base_url(foursight_header_json_portal.get("url"))
            response["foursight"]["portal_url"] = portal_url
            return portal_url

        def get_portal_info(portal_url: str, response: dict) -> Optional[str]:
            response["portal"] = {}
            if not portal_url:
                return None
            response["portal"]["url"] = get_portal_base_url(portal_url)
            response["portal"]["health_url"] = response["portal"]["url"] + "/health?format=json"
            response["portal"]["health_ui_url"] = response["portal"]["url"] + "/health"
            portal_health_response = requests.get(response["portal"]["health_url"])
            if portal_health_response.status_code != 200:
                response["portal"]["error"] = "Cannot fetch Portal health URL."
                response["portal"]["health_url_status"] = portal_health_response.status_code
                return None
            portal_health_json = portal_health_response.json()
            response["portal"]["versions"] = {
                "portal": portal_health_json.get("project_version"),
                "snovault": portal_health_json.get("snovault_version"),
                "dcicutils": portal_health_json.get("utils_version"),
                "python": portal_health_json.get("python_version")
            }
            portal_uptime = portal_health_json.get("uptime")
            portal_started = convert_uptime_to_datetime(portal_uptime)
            response["portal"]["started"] = convert_utc_datetime_to_useastern_datetime_string(portal_started)
            response["portal"]["identity"] = portal_health_json.get("identity")
            response["portal"]["elasticsearch"] = portal_health_json.get("elasticsearch")
            response["portal"]["database"] = portal_health_json.get("database")
            response["portal"]["health"] = portal_health_json
            foursight_url = get_foursight_base_url(portal_health_json.get("foursight"))
            response["portal"]["foursight_url"] = foursight_url
            return foursight_url

        ignored(request)
        response = {"accounts_file": self._get_accounts_file(), "accounts_file_from_s3": self._get_accounts_file_from_s3()}
        accounts = self._get_accounts() if not from_s3 else self._get_accounts_from_s3(request)
        if not accounts:
            return self.create_success_response({"status": "No accounts file support."})
        account = [account for account in accounts if is_account_name_match(account, name)] if accounts else None
        if not account or len(account) > 1:
            response["name"] = name
            response["error"] = f"Cannot find {'unique' if len(account) > 1 else ''} account."
            return self.create_success_response(response)
        else:
            account = account[0]

        response["name"] = account.get("name")
        response["stage"] = account.get("stage")
        response["id"] = account.get("name") + (":" + account.get("stage") if account.get("stage") else "")

        account_foursight_url = account.get("foursight_url")
        account_portal_url = account.get("portal_url")

        if account_foursight_url:
            portal_url = get_foursight_info(account_foursight_url, response)
            get_portal_info(portal_url, response)
        elif account_portal_url:
            foursight_url = get_portal_info(account_portal_url, response)
            get_foursight_info(foursight_url, response)
        else:
            response["error"] = "Neither foursight nor portal URLs found in account info."
            return self.create_success_response(response)

        if response["portal"].get("foursight_url") != response["foursight"].get("url"):
            if not response.get("warnings"):
                response["warnings"] = []
            response["warnings"].append("Foursight URL mismatch")
        if response["portal"].get("url") != response["foursight"].get("portal_url"):
            if not response.get("warnings"):
                response["warnings"] = []
            response["warnings"].append("Portal URL mismatch.")
        if response["portal"].get("identity") != response["foursight"].get("identity"):
            if not response.get("warnings"):
                response["warnings"] = []
            response["warnings"].append("Identity mismatch.")

        return self.create_success_response(response)

    def reactapi_aws_vpcs(self, request: dict, env: str, vpc: Optional[str] = None, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint:
        - GET /{env}/aws/vpcs
        - GET /{env}/aws/vpcs/{vpc}
        Returns AWS VPC info. By default returns VPCs with (tagged) names beginning with "C4".
        If the vpc argument is "all" then info all VPCs are matched; or if the vpc is some other
        value then it is treated as a regular expression against which the VPC names are matched.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request, env)
        if vpc is None:
            vpc = "C4*"
        elif vpc == "all":
            vpc = None
        raw = args.get("raw") == "true"
        return self.create_success_response(aws_get_vpcs(vpc, raw))

    def reactapi_aws_subnets(self, request: dict, env: str, subnet: Optional[str] = None, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint:
        - GET /{env}/aws/subnets
        - GET /{env}/aws/subnets/{subnet}
        Returns AWS Subnet info. By default returns Subnets with (tagged) names beginning with "C4".
        If the subnet argument is "all" then info all Subnets are matched; or if the subnet is some
        other value then it is treated as a regular expression against which the Subnet names are matched.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request, env)
        if subnet is None:
            subnet = "C4*"
        elif subnet == "all":
            subnet = None
        raw = args.get("raw") == "true"
        vpc = args.get("vpc")
        return self.create_success_response(aws_get_subnets(subnet, vpc, raw))

    def reactapi_aws_security_groups(self, request: dict, env: str, security_group: Optional[str] = None, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoints:
        - GET /{env}/aws/security_groups
        - GET /{env}/aws/security_groups/{security_group}
        Returns AWS Security Group info. By default returns Security Groups with (tagged) names beginning with "C4".
        If the security_group argument is "all" then info all Security Groups are matched; or if the security_group is some
        other value then it is treated as a regular expression against which the Subnet names are matched.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request, env)
        if security_group is None:
            security_group = "C4*"
        elif security_group == "all":
            security_group = None
        raw = args.get("raw") == "true"
        vpc = args.get("vpc")
        return self.create_success_response(aws_get_security_groups(security_group, vpc, raw))

    def reactapi_aws_security_group_rules(self, request: dict, env: str, security_group: Optional[str] = None, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoints:
        - GET /{env}/aws/security_groups_rules/{security_group}
        Returns AWS Security Group Rule info for the given security_group (ID).
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request, env)
        raw = args.get("raw") == "true"
        direction = args.get("direction")
        return self.create_success_response(aws_get_security_group_rules(security_group, direction, raw))

    def reactapi_aws_network(self, request: dict, env: str, network: Optional[str] = None, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoints:
        - GET /{env}/aws/network
        - GET /{env}/aws/network/{network}
        Returns aggregated AWS network info, i.e. WRT VPCs, Subnets, and Security Groups, ala the above functions.
        The network argument is treated like the vpc, subnet, and security_group for the above functions.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request, env)
        if network is None:
            network = "C4*"
        elif network == "all":
            network = None
        raw = args.get("raw") == "true"
        return self.create_success_response(aws_get_network(network, raw))

    def reactapi_aws_stacks(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoints: GET /{env}/aws/stacks
        """
        ignored(request, env)
        return self.create_success_response(aws_get_stacks())

    def reactapi_aws_stack(self, request: dict, env: str, stack: str) -> Response:
        """
        Called from react_routes for endpoints: GET /{env}/aws/stacks/{stack}/outputs
        """
        ignored(request, env)
        return self.create_success_response(aws_get_stack(stack))

    def reactapi_aws_stack_outputs(self, request: dict, env: str, stack: str) -> Response:
        """
        Called from react_routes for endpoints: GET /{env}/aws/stacks/{stack}/outputs
        """
        ignored(request, env)
        return self.create_success_response(aws_get_stack_outputs(stack))

    def reactapi_aws_stack_parameters(self, request: dict, env: str, stack: str) -> Response:
        """
        Called from react_routes for endpoints: GET /{env}/aws/stacks/{stack}/parameters
        """
        ignored(request, env)
        return self.create_success_response(aws_get_stack_parameters(stack))

    def reactapi_aws_stack_resources(self, request: dict, env: str, stack: str) -> Response:
        """
        Called from react_routes for endpoints: GET /{env}/aws/stacks/{stack}/resources
        """
        ignored(request, env)
        return self.create_success_response(aws_get_stack_resources(stack))

    def reactapi_aws_stack_template(self, request: dict, env: str, stack: str) -> Response:
        """
        Called from react_routes for endpoints: GET /{env}/aws/stacks/{stack}/template
        """
        ignored(request, env)
        return self.create_success_response(aws_get_stack_template(stack))

    # ----------------------------------------------------------------------------------------------
    # END OF EXPERIMENTAL - /accounts page
    # ----------------------------------------------------------------------------------------------

    def reactapi_reload_lambda(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /__reloadlambda__
        Kicks off a reload of the given lambda name. For troubleshooting only.
        """
        ignored(request)
        app.core.reload_lambda()
        time.sleep(3)
        return self.create_success_response({"status": "Lambda reloaded."})

    def reactapi_function_cache(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /__reloadlambda__
        Kicks off a reload of the given lambda name. For troubleshooting only.
        """
        ignored(request)
        return self.create_success_response(json.dumps(function_cache_info(), default=str))

    def reactapi_function_cache_clear(self, request: dict, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /__reloadlambda__
        Kicks off a reload of the given lambda name. For troubleshooting only.
        """
        names = args.get("name", args.get("names", None))
        cache_cleared = []
        if names and names.lower() != "null":
            for name in names.split(","):
                if function_cache_clear(name):
                    cache_cleared.append(name)
        else:
            function_cache_clear()
            cache_cleared.append("<all>")
        return self.create_success_response({"cache_cleared": cache_cleared})

    @staticmethod
    def reactapi_testsize(n: int) -> Response:
        n = int(n) - 8  # { "N": "" }
        body = {"N": "X" * n}
        return app.core.create_success_response(body)
