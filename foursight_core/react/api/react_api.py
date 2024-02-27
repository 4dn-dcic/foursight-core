from chalice import Response, __version__ as chalice_version
import boto3
from botocore.errorfactory import ClientError as BotoClientError
import copy
import datetime
import json
import os
import pkg_resources
import platform
import requests
import socket
import time
from typing import Callable, Optional
import tzlocal
import urllib.parse
from itertools import chain
from dcicutils.ecs_utils import ECSUtils
from dcicutils.env_manager import EnvManager
from dcicutils.env_utils import EnvUtils, get_foursight_bucket, get_foursight_bucket_prefix, full_env_name
from dcicutils.env_utils import get_portal_url as env_utils_get_portal_url
from dcicutils.function_cache_decorator import function_cache, function_cache_info, function_cache_clear
from dcicutils import ff_utils, s3_utils
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
from .datetime_utils import (
    convert_uptime_to_datetime,
    convert_datetime_to_utc_datetime_string
)
from .encoding_utils import base64_decode_to_json
from .gac import Gac
from .ingestion_utils import (
    read_ingestion_submissions,
    read_ingestion_submission_detail,
    read_ingestion_submission_manifest,
    read_ingestion_submission_resolution,
    read_ingestion_submission_summary,
    read_ingestion_submission_submission_response,
    read_ingestion_submission_traceback,
    read_ingestion_submission_upload_info,
    read_ingestion_submission_validation_report
)
from .misc_utils import (
    find_common_prefix,
    get_base_url,
    is_running_locally,
    name_value_list_to_dict,
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
        self._accounts_file_name = "known_accounts"

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
                "boto3": get_package_version("boto3"),
                "botocore": get_package_version("botocore"),
                "chalice": chalice_version,
                "elasticsearch_server": self._get_elasticsearch_server_version(),
                "elasticsearch": get_package_version("elasticsearch"),
                "elasticsearch_dsl": get_package_version("elasticsearch-dsl"),
                "redis": get_package_version("redis"),
                "redis_server": self._get_redis_server_version()
            }

    @function_cache
    def _get_known_buckets(self, env: str = None) -> dict:
        if not env:
            env = self._envs.get_default_env()
        s3 = s3_utils.s3Utils(env=env)
        return {
            "blob_bucket": s3.blob_bucket,
            "metadata_bucket": s3.metadata_bucket,
            "outfile_bucket": s3.outfile_bucket,
            "raw_file_bucket": s3.raw_file_bucket,
            "sys_bucket": s3.sys_bucket,
            "results_bucket": get_foursight_bucket(envname=env, stage=app.core.stage.get_stage()),
            "tibanna_cwls_bucket": s3.tibanna_cwls_bucket,
            "tibanna_output_bucket": s3.tibanna_output_bucket
        }

    def get_ecosystem_data(self) -> dict:
        return sort_dictionary_by_case_insensitive_keys(EnvUtils.declared_data())

    def _get_elasticsearch_server_status(self) -> Optional[dict]:
        response = {"url": app.core.host}
        try:
            connection = app.core.init_connection(self._envs.get_default_env())
            response["url"] = app.core.host
            response["info"] = connection.es_info()
            response["health"] = connection.es_health()
        except Exception:
            pass
        return response

    @function_cache(nokey=True, nocache=None)
    def _get_elasticsearch_server_version(self) -> Optional[str]:
        connection = app.core.init_connection(self._envs.get_default_env())
        es_info = connection.es_info()
        return es_info.get("version", {}).get("number")

    @function_cache(nokey=True, nocache=None)
    def _get_elasticsearch_server_cluster(self) -> Optional[str]:
        status = self._get_elasticsearch_server_status()
        cluster = status.get("health", {}).get("cluster_name")
        cluster_parts = cluster.split(":", 1)
        cluster_name = cluster_parts[1] if len(cluster_parts) > 1 else cluster
        return cluster_name

    @function_cache(nokey=True, nocache=None)
    def _get_rds_server(self) -> Optional[str]:
        return os.environ.get("RDS_HOSTNAME")

    @function_cache(nokey=True, nocache=None)
    def _get_rds_name(self) -> Optional[str]:
        server = self._get_rds_server()
        name_parts = server.split(".", 1) if server else None
        name = name_parts[0] if len(name_parts) > 0 else ""
        return name

    @function_cache(nokey=True, nocache=None)
    def _get_redis_server_version(self) -> Optional[str]:
        connection = app.core.init_connection(self._envs.get_default_env())
        redis_info = connection.redis_info()
        return redis_info.get("redis_version") if redis_info else None

    @function_cache
    def _get_user_attribution(self, type: str, env: str, raw: bool = False,
                              map_title: Optional[Callable] = None,
                              additional_info: Optional[Callable] = None) -> list:
        """
        Returns the list of available user projects.
        """
        results = []
        connection = app.core.init_connection(env)
        response = ff_utils.search_metadata(f'/search/?type={type}&datastore=database', key=connection.ff_keys)
        if response:
            if not raw:
                for item in response:
                    result = {
                        "id": item.get("@id"),
                        "uuid": item.get("uuid"),
                        "name": item.get("name"),
                        "title": item.get("title") if not map_title else map_title(item.get("title")),
                        "description": item.get("description")
                    }
                    if additional_info:
                        result = {**result, **additional_info(item)}
                    results.append(result)
            else:
                results = response
        return results

    @function_cache
    def _get_user_institutions(self, env: str, raw: bool = False) -> list:
        """
        Returns the list of available user institutions.
        """
        def get_principle_investigator(result):
            pi = result.get("pi")
            return {"pi": {"name": pi.get("display_title"), "uuid": pi.get("uuid"), "id": pi.get("@id")}} if pi else {}

        return self._get_user_attribution("Institution", env, raw, additional_info=get_principle_investigator)

    @function_cache
    def _get_user_projects(self, env: str, raw: bool = False) -> list:
        return self._get_user_attribution("Project", env, raw)

    @function_cache
    def _get_user_awards(self, env: str, raw: bool = False) -> list:
        return self._get_user_attribution("Award", env, raw)

    @function_cache
    def _get_user_labs(self, env: str, raw: bool = False) -> list:
        return self._get_user_attribution("Lab", env, raw)

    @function_cache
    def _get_user_consortia(self, env: str, raw: bool = False) -> list:
        def map_title(title: str) -> str:
            suffix_to_ignore = " Consortium"
            if title.endswith(suffix_to_ignore):
                title = title[:-len(suffix_to_ignore)]
            return title
        return self._get_user_attribution("Consortium", env, raw, map_title=map_title)

    @function_cache
    def _get_user_submission_centers(self, env: str, raw: bool = False) -> list:
        def map_title(title: str) -> str:
            suffix_to_ignore = " Submission Center"
            if title.endswith(suffix_to_ignore):
                title = title[:-len(suffix_to_ignore)]
            return title
        return self._get_user_attribution("SubmissionCenter", env, raw, map_title=map_title)

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

    @classmethod
    def _is_test_name(cls, name):
        return isinstance(name, str) and name.startswith("test_")

    @classmethod
    def _is_test_name_item(cls, item, property_name="name"):
        return isinstance(item, dict) and cls._is_test_name(item.get(property_name))

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
        default_env = self._envs.get_default_env()
        if not self._envs.is_known_env(env):
            # If we are not given a known env then, at least for
            # the /header endpoint, coerce it to the default env.
            env = default_env
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
            known_envs_default = self._envs.find_known_env(default_env)
            known_envs_actual_count = self._envs.get_known_envs_count()
            data["auth"]["known_envs"] = [known_envs_default]
            data["auth"]["known_envs_actual_count"] = known_envs_actual_count
        data["auth"]["default_env"] = default_env
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
        data["timestamp"] = convert_datetime_to_utc_datetime_string(datetime.datetime.utcnow())
        data["timezone"] = tzlocal.get_localzone_name()
        test_mode_access_key_simulate_error = read_cookie_bool(request, "test_mode_access_key_simulate_error")
        if auth.get("user_exception"):  # or test_mode_access_key_simulate_error:
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
                data["portal_access_key_erro"] = True
        return self.create_success_response(data)

    @function_cache
    def _get_gitinfo(self, package: str = None) -> Optional[dict]:
        if not package:
            if gitinfo := self._get_gitinfo("chalicelib_smaht"):
                return gitinfo
            elif gitinfo := self._get_gitinfo("chalicelib_fourfront"):
                return gitinfo
            elif gitinfo := self._get_gitinfo("chalicelib_cgap"):
                return gitinfo
            else:
                return None
        try:
            gitinfo = {}
            if os.path.exists(f"{package}/gitinfo.json"):
                with open(f"{package}/gitinfo.json", "r") as f:
                    if package_gitinfo := json.load(f):
                        gitinfo[package] = package_gitinfo
            if os.path.exists(f"foursight_core/gitinfo.json"):
                with open(f"foursight_core/gitinfo.json", "r") as f:
                    if package_gitinfo := json.load(f):
                        gitinfo["foursight_core"] = package_gitinfo
            return gitinfo
        except Exception:
            pass
        return None

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
                "identity": Gac.get_identity_name(),
                "local": is_running_locally(request),
                "credentials": {
                    "aws_account_number": aws_credentials.get("aws_account_number"),
                    "aws_account_name": aws_credentials.get("aws_account_name"),
                    "aws_access_key_id": aws_credentials.get("aws_access_key_id"),
                    "re_captcha_key": os.environ.get("reCaptchaKey", None)
                },
                "launched": app.core.init_load_time,
                "deployed": app.core.get_lambda_last_modified(),
                "accounts_file": self._get_accounts_file_name(),
                "git": self._get_gitinfo()
            },
            "versions": self._get_versions_object(),
            "portal": {
                "url": portal_url,
                "health_url": portal_base_url + "/health?format=json",
                "health_ui_url": portal_base_url + "/health",
            },
            "resources": {
                "es": app.core.host,
                "es_cluster": self._get_elasticsearch_server_cluster(),
                "foursight": self.foursight_instance_url(request),
                "portal": portal_url,
                # TODO: May later want to rds_username and/or such.
                "rds": self._get_rds_server(),
                "rds_name": self._get_rds_name(),
                "redis": redis_url,
                "redis_running": redis is not None,
                "sqs": self._get_sqs_queue_url(),
            },
            "s3": {
                "bucket_org": os.environ.get("ENCODED_S3_BUCKET_ORG", os.environ.get("S3_BUCKET_ORG", None)),
                "global_env_bucket": self.get_global_env_bucket(),
                "encrypt_key_id": os.environ.get("S3_ENCRYPT_KEY_ID", None),
                "buckets": self._get_known_buckets()
            }
        }
        portal_production_color, portal_production_env = self._envs.get_production_color()
        portal_staging_color, portal_staging_env = self._envs.get_staging_color()
        if portal_production_color:
            response["portal"]["production_color"] = portal_production_color
            response["portal"]["production_env"] = portal_production_env
            response["portal"]["production_url"] = app.core.get_portal_url(portal_production_env.get("full_name"))
        if portal_staging_color:
            response["portal"]["staging_color"] = portal_staging_color
            response["portal"]["staging_env"] = portal_staging_env
            response["portal"]["staging_url"] = app.core.get_portal_url(portal_staging_env.get("full_name"))
        if os.environ.get("S3_ENCRYPT_KEY"):
            response["s3"]["has_encryption"] = True
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
                foursight_url,
                test_mode_certificate_expiration_warning_days=test_mode_certificate_expiration_warning_days)
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
            return self.create_success_response(self._get_elasticsearch_server_status())
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
                "identity": Gac.get_identity_name(),
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
                "es_cluster": self._get_elasticsearch_server_cluster(),
                "rds": self._get_rds_server(),
                "rds_name": self._get_rds_name(),
                "sqs": self._get_sqs_queue_url(),
            },
            "buckets": {
                "env": app.core.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=env or default_env, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": environment_and_bucket_info,
                "ecosystem": self.get_ecosystem_data()
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

    def reactapi_ecosystems(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint:
        - GET /{env}/envs
        - GET /envs
        Return info about all environment "ecosystems", just for informtional purposes.
        """
        current_ecosystem_data = self.get_ecosystem_data()
        current_ecosystem_name = None
        current_ecosystem_name_cannot_infer = False
        main_ecosystem_name = "main.ecosystem"
        main_ecosystem_data = None
        global_env_bucket = self.get_global_env_bucket()
        ecosystem_names = EnvManager.get_all_ecosystems(env_bucket=global_env_bucket)
        results = {}
        for ecosystem_name in ecosystem_names:
            if not ecosystem_name.endswith(".ecosystem"):
                ecosystem_name = f"{ecosystem_name}.ecosystem"
            s3 = boto3.client("s3")
            try:
                ecosystem_data = s3.get_object(Bucket=global_env_bucket, Key=ecosystem_name)
                ecosystem_data = json.loads(ecosystem_data["Body"].read().decode("utf-8"))
                ecosystem_data = sort_dictionary_by_case_insensitive_keys(ecosystem_data)
                if ecosystem_data == current_ecosystem_data:
                    # No convenient way to get the name of the current
                    # ecosystem fron EnvManager so infer it from the contents.
                    if current_ecosystem_name:
                        current_ecosystem_name_cannot_infer = True
                    else:
                        current_ecosystem_name = ecosystem_name
                if ecosystem_name == main_ecosystem_name:
                    main_ecosystem_data = ecosystem_data
                results[ecosystem_name] = ecosystem_data
            except Exception:
                pass
        if current_ecosystem_name:
            if not current_ecosystem_name_cannot_infer:
                results = {"current": current_ecosystem_name, **results}
            elif current_ecosystem_data == main_ecosystem_data:
                results = {"current": main_ecosystem_name, **results}
        return self.create_success_response(results)

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
        result = {
            # Lower case email to avoid any possible issues on lookup later.
            "email": (user.get("email") or "").lower(),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "uuid": user.get("uuid"),
            "title": user.get("title"),
            "groups": user.get("groups"),
            "roles": user.get("project_roles"),
            "status": user.get("status"),
            "updated": convert_datetime_to_utc_datetime_string(updated),
            "created": convert_datetime_to_utc_datetime_string(user.get("date_created"))
        }
        institution = user.get("user_institution")
        project = user.get("project")
        award = user.get("award")
        lab = user.get("lab")
        consortia = user.get("consortia")
        submission_centers = user.get("submission_centers")
        if institution:
            result["institution"] = institution
        if project:
            result["project"] = project
        if award:
            result["award"] = award
        if lab:
            result["lab"] = lab
        # Note that for the affilitiaions, like institution/project for CGAP
        # and award/institution for Fourfrount, where these are single
        # values, for SMaHT consortia/submission-centers are arrays;
        # will let the UI deal with any display issues there.
        if consortia:
            result["consortia"] = consortia
        if submission_centers:
            result["submission_centers"] = submission_centers
        return result

    def _create_user_record_from_input(self, user: dict, include_deletes: bool = False) -> dict:
        """
        Canonicalizes and returns the given user record from our UI into the
        common format suitable for insert/update to our database. Modifies input.
        Please see comment above (in _create_user_record_for_output) WRT roles.
        """
        user = copy.deepcopy(user)
        # TODO
        # Handle these "-" checking things in the (React) UI!
#       if self.is_foursight_fourfront():
#           if "institution" in user:
#               del user["institution"]
#           if "project" in user:
#               del user["project"]
#           if "role" in user:
#               del user["role"]
#           if "roles" in user:
#               del user["roles"]
#           if "submission_centers" in user:
#               del user["submission_centers"]
#           if "consortia" in user:
#               del user["consortia"]
#           if "status" in user:
#               if not user["status"] or user["status"] == "-":
#                   del user["status"]
#           return user

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
            if self.is_foursight_cgap():
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

        for user in results:  # results["@graph"]:
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
            # TODO: Maybe raise special 404 exception and have common handler (e.g. in the @route decorator).
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
        # kwargs = {"skip_indexing": True} if elasticsearch_server_version >= "7" else {}
        kwargs = {} if elasticsearch_server_version >= "7" else {}
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
        if not self.is_foursight_cgap():
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
        if not self.is_foursight_cgap():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_projects(env, raw))

    def reactapi_users_awards(self, request: dict, env: str, args: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/awards
        Returns the list of available user awards.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        if not self.is_foursight_fourfront():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_awards(env, raw))

    def reactapi_users_labs(self, request: dict, env: str, args: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/labs
        Returns the list of available user labs.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        if not self.is_foursight_fourfront():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_labs(env, raw))

    def reactapi_users_consortia(self, request: dict, env: str, args: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/consortia
        Returns the list of available user consortia.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        if not self.is_foursight_smaht():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_consortia(env, raw))

    def reactapi_users_submission_centers(self, request: dict, env: str, args: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users/submission_centers
        Returns the list of available user submission_centers.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        ignored(request)
        if not self.is_foursight_smaht():
            return self.create_success_response([])
        raw = args.get("raw") == "true"
        return self.create_success_response(self._get_user_submission_centers(env, raw))

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
        check_datetime = convert_datetime_to_utc_datetime_string(check_datetime)
        check_results["timestamp"] = check_datetime
        return self.create_success_response(check_results)

    def reactapi_checks_history_uuid(self, request: dict, env: str, check: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/history/{uuid}
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
                # This gets the result from S3, for example:
                # s3://cgap-kmp-main-foursight-cgap-supertest-results/access_key_status/2023-06-15T10:00:21.205768.json
                # where access_key_status is the check (name) and 2023-06-15T10:00:21.205768 is the uuid;
                # and cgap-kmp-main-foursight-cgap-supertest-results is the bucket name which is from our environment.
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
                    timestamp = convert_datetime_to_utc_datetime_string(timestamp)
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
                        timestamp = convert_datetime_to_utc_datetime_string(timestamp)
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
                                            and not self._is_test_name_item(item)]
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

    def _put_accounts_file_data(self, accounts_file_data: list) -> list:
        accounts_file_data = {"data": accounts_file_data}
        s3 = s3_utils.s3Utils(env=self._envs.get_default_env())
        s3.s3_put_secret(accounts_file_data, self._accounts_file_name)
        return self.create_success_response(accounts_file_data)

    def _get_accounts_file_data(self) -> Optional[list]:
        try:
            s3 = s3_utils.s3Utils(env=self._envs.get_default_env())
            accounts_file_data = s3.get_key(self._accounts_file_name)
            return accounts_file_data.get("data") if accounts_file_data else {}
        except BotoClientError as e:
            if e.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise e

    def _get_accounts_file_name(self) -> Optional[str]:
        """
        Returns the full path name to the accounts.json file name is S3.
        """
        s3 = s3_utils.s3Utils(env=self._envs.get_default_env())
        return f"s3://{s3.sys_bucket}/{self._accounts_file_name}"

    @staticmethod
    def _read_accounts_json(accounts_json) -> dict:
        for account in accounts_json:
            account_name = account.get("name")
            if account_name:
                account_stage = account.get("stage")
                if account_stage:
                    account["id"] = account_name + ":" + account_stage
                else:
                    account["id"] = account_name
        return accounts_json

    def _get_accounts(self, request) -> Optional[list]:
        accounts_file_data = self._get_accounts_file_data()
        if not accounts_file_data:
            return accounts_file_data
        env = self._envs.get_default_env()
        stage = app.core.stage.get_stage()
        aws_credentials = self._auth.get_aws_credentials(env) or {}
        aws_account_name = aws_credentials.get("aws_account_name")
        if self.is_running_locally(request):
            # For running locally put this localhost account first.
            accounts_file_data.insert(0, {
                "name": "localhost",
                "stage": stage,
                "foursight_url": "http://localhost:8000/api"
            })
        else:
            # Put this account at first.
            for account in accounts_file_data:
                if account.get("name") == aws_account_name and account.get("stage") == stage:
                    accounts_file_data.remove(account)
                    accounts_file_data.insert(0, account)
                    break
        return self._read_accounts_json(accounts_file_data)

    def reactapi_accounts(self, request: dict, env: str) -> Response:
        ignored(env)
        accounts = self._get_accounts(request)
        if accounts is None:
            return self.create_response(404, {"message": f"Account file not found: {self._get_accounts_file_name()}"})
        return self.create_success_response(accounts)

    def reactapi_account(self, request: dict, env: str, name: str) -> Response:

        if name == "current":
            aws_credentials = self._auth.get_aws_credentials(env or self._envs.get_default_env())
            aws_account_name = aws_credentials.get("aws_account_name")
            stage = app.core.stage.get_stage()
            name = f"{aws_account_name}:{stage}"

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
                return url_origin == this_origin or url_origin == "localhost:8000"
            except Exception:
                return False

        def check_s3_aws_access_key() -> Optional[bool]:
            s3_aws_access_key_id = os.environ.get("S3_AWS_ACCESS_KEY_ID")
            s3_secret_access_key = os.environ.get("S3_SECRET_ACCESS_KEY")
            global_env_bucket = self.get_global_env_bucket()
            if s3_aws_access_key_id and s3_secret_access_key and global_env_bucket:
                s3 = boto3.client("s3")
                try:
                    s3.list_objects_v2(Bucket=global_env_bucket)
                    return True
                except Exception:
                    return False
            return None

        def get_foursight_info(foursight_url: str, response: dict) -> Optional[str]:
            if not response.get("foursight"):
                response["foursight"] = {}
            if not response.get("portal"):
                response["portal"] = {}
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
            response["foursight"]["identity"] = foursight_app.get("identity")
            if not response["foursight"]["identity"]:
                response["foursight"]["identity"] = foursight_header_json["auth"]["known_envs"][0].get("gac_name")
            response["foursight"]["redis_url"] = foursight_header_json.get("resources", {}).get("redis")
            response["foursight"]["es_url"] = foursight_header_json.get("resources", {}).get("es")
            response["foursight"]["es_cluster"] = foursight_header_json.get("resources", {}).get("es_cluster")
            response["foursight"]["rds"] = foursight_header_json.get("resources", {}).get("rds")
            response["foursight"]["rds_name"] = foursight_header_json.get("resources", {}).get("rds_name")
            response["foursight"]["sqs_url"] = foursight_header_json.get("resources", {}).get("sqs")
            response["foursight"]["redis_running"] = foursight_header_json.get("resources", {}).get("redis_running")
            foursight_header_json_s3 = foursight_header_json.get("s3")
            # TODO: Maybe eventually make separate API call (to get Portal Access Key info for any account)
            # so that we do not have to wait here within this API call for this synchronous API call.
            portal_access_key_url = response["foursight"]["url"] + f"/reactapi/portal_access_key"
            portal_access_key_response = requests.get(portal_access_key_url)
            if portal_access_key_response and portal_access_key_response.status_code == 200:
                response["foursight"]["portal_access_key"] = portal_access_key_response.json()
            # Older versions of the /header API might not have this s3 element so check.
            if foursight_header_json_s3:
                response["foursight"]["s3"] = {}
                response["foursight"]["s3"]["bucket_org"] = foursight_header_json_s3.get("bucket_org")
                response["foursight"]["s3"]["global_env_bucket"] = foursight_header_json_s3.get("global_env_bucket")
                response["foursight"]["s3"]["encrypt_key_id"] = foursight_header_json_s3.get("encrypt_key_id")
                response["foursight"]["s3"]["has_encryption"] = foursight_header_json_s3.get("has_encryption")
                response["foursight"]["s3"]["buckets"] = foursight_header_json_s3.get("buckets")
            if is_this_server(response["foursight"]["url"]):
                response["foursight"]["s3"]["access_key"] = os.environ.get("S3_AWS_ACCESS_KEY_ID")
                aws_access_key_check = check_s3_aws_access_key()
                if aws_access_key_check is not None:
                    if aws_access_key_check:
                        response["foursight"]["s3"]["access_key_okay"] = True
                    else:
                        response["foursight"]["s3"]["access_key_error"] = True
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
            if foursight_header_json_portal.get("production_color"):
                response["portal"]["production_color"] = foursight_header_json_portal["production_color"]
                response["portal"]["production_env"] = foursight_header_json_portal["production_env"]
                response["portal"]["production_url"] = foursight_header_json_portal["production_url"]
            if foursight_header_json_portal.get("staging_color"):
                response["portal"]["staging_color"] = foursight_header_json_portal["staging_color"]
                response["portal"]["staging_env"] = foursight_header_json_portal["staging_env"]
                response["portal"]["staging_url"] = foursight_header_json_portal["staging_url"]
            return portal_url

        def get_portal_info(portal_url: str, response: dict) -> Optional[str]:
            if not response.get("portal"):
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
            response["portal"]["started"] = convert_datetime_to_utc_datetime_string(portal_started)
            response["portal"]["identity"] = portal_health_json.get("identity")
            response["portal"]["elasticsearch"] = portal_health_json.get("elasticsearch")
            response["portal"]["database"] = portal_health_json.get("database")
            response["portal"]["health"] = portal_health_json
            foursight_url = get_foursight_base_url(portal_health_json.get("foursight"))
            response["portal"]["foursight_url"] = foursight_url
            return foursight_url

        ignored(request)
        response = {"accounts_file": self._get_accounts_file_name()}
        accounts = self._get_accounts(request)
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

    def reactapi_aws_vpcs(self, request: dict, env: str,
                          vpc: Optional[str] = None, args: Optional[dict] = None) -> Response:
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

    def reactapi_aws_subnets(self, request: dict, env: str,
                             subnet: Optional[str] = None, args: Optional[dict] = None) -> Response:
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

    def reactapi_aws_security_groups(self, request: dict, env: str,
                                     security_group: Optional[str] = None, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoints:
        - GET /{env}/aws/security_groups
        - GET /{env}/aws/security_groups/{security_group}
        Returns AWS Security Group info. By default returns Security Groups with (tagged) names beginning with "C4".
        If the security_group argument is "all" then info all Security Groups are matched; or if the security_group
        is some other value then it is treated as a regular expression against which the Subnet names are matched.
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

    def reactapi_aws_security_group_rules(self, request: dict, env: str,
                                          security_group: Optional[str] = None,
                                          args: Optional[dict] = None) -> Response:
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

    def reactapi_aws_network(self, request: dict, env: str,
                             network: Optional[str] = None, args: Optional[dict] = None) -> Response:
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

    def reactapi_accounts_file_upload(self, accounts_file_data: list) -> Response:
        return self.create_success_response(self._put_accounts_file_data(accounts_file_data))

    def reactapi_accounts_file_download(self) -> Response:
        accounts_file_data = self._get_accounts_file_data()
        if accounts_file_data is None:
            return self.create_response(404, {"message": f"Account file not found: {self._get_accounts_file_name()}"})
        return self.create_success_response(self._get_accounts_file_data())

    def reactapi_portal_health(self, env: str) -> Response:
        portal_url = app.core.get_portal_url(env or self._envs.get_default_env, raise_exception=False)
        portal_health_url = f"{portal_url}/health?format=json"
        portal_health_response = requests.get(portal_health_url)
        if portal_health_response.status_code == 200:
            portal_health_json = portal_health_response.json()
            portal_uptime = portal_health_json.get("uptime")
            portal_health_json["started"] = (
                convert_datetime_to_utc_datetime_string(convert_uptime_to_datetime(portal_uptime)))
            return portal_health_json

    # ----------------------------------------------------------------------------------------------
    # END OF EXPERIMENTAL - /accounts page
    # ----------------------------------------------------------------------------------------------

    def reactapi_aws_secret_names(self) -> Response:
        return self.create_success_response(Gac.get_secret_names())

    def reactapi_aws_secrets(self, secrets_name: str) -> Response:
        return self.create_success_response(Gac.get_secrets(secrets_name))

    def reactapi_aws_ecs_clusters(self) -> Response:

        def ecs_cluster_arn_to_name(cluster_arn: str) -> str:
            cluster_arn_parts = cluster_arn.split("/", 1)
            return cluster_arn_parts[1] if len(cluster_arn_parts) > 1 else cluster_arn

        ecs = ECSUtils()
        clusters = ecs.list_ecs_clusters()
        clusters = [{"cluster_name": ecs_cluster_arn_to_name(arn), "cluster_arn": arn} for arn in clusters]
        return sorted(clusters, key=lambda item: item["cluster_name"])

    def reactapi_aws_ecs_cluster(self, cluster_arn: str) -> Response:
        # Given cluster_name may actually be either a cluster name or its ARN,
        # e.g. either c4-ecs-cgap-supertest-stack-CGAPDockerClusterForCgapSupertest-YZMGi06YOoSh or
        # arn:aws:ecs:us-east-1:466564410312:cluster/c4-ecs-cgap-supertest-stack-CGAPDockerClusterForCgapSupertest-YZMGi06YOoSh
        # URL-decode because the ARN may contain a slash.
        cluster_arn = urllib.parse.unquote(cluster_arn)
        ecs = ECSUtils()
        cluster = ecs.client.describe_clusters(clusters=[cluster_arn])["clusters"][0]
        response = {
            "cluster_arn": cluster["clusterArn"],
            "cluster_name": cluster["clusterName"],
            "status": cluster["status"],
            "services": []
        }
        most_recent_deployment_at = None
        service_arns = ecs.list_ecs_services(cluster_name=cluster_arn)
        for service_arn in service_arns:
            service = ecs.client.describe_services(cluster=cluster_arn, services=[service_arn])["services"][0]
            deployments = []
            most_recent_update_at = None
            # Typically we have just one deployment record, but if there are more than one, then the
            # one with a status of PRIMARY (of which there should be at most one), is the active one,
            # and we will place that first in the list; all others will go after that.
            for deployment in service.get("deployments", []):
                if (not most_recent_update_at or (deployment.get("updatedAt")
                                                  and deployment.get("updatedAt") > most_recent_update_at)):
                    most_recent_update_at = deployment.get("updatedAt")
                deployment_status = deployment.get("status")
                deployment_info = {
                    "deployment_id": deployment.get("id"),
                    "task_arn": deployment.get("taskDefinition"),
                    "task_name": self._ecs_task_definition_arn_to_name(deployment.get("taskDefinition")),
                    "task_display_name": self._ecs_task_definition_arn_to_name(deployment.get("taskDefinition")),
                    "status": deployment_status,
                    "counts": {"running": deployment.get("runningCount"),
                               "pending": deployment.get("pendingCount"),
                               "expected": deployment.get("desiredCount")},
                    "rollout": {"state": deployment.get("rolloutState"),
                                "reason": deployment.get("rolloutStateReason")},
                    "created": convert_datetime_to_utc_datetime_string(deployment.get("createdAt")),
                    "updated": convert_datetime_to_utc_datetime_string(deployment.get("updatedAt"))
                }
                if deployment_status and deployment_status.upper() == "PRIMARY":
                    deployments.insert(0, deployment_info)
                else:
                    deployments.append(deployment_info)
            if (not most_recent_deployment_at or (most_recent_update_at
                                                  and most_recent_update_at > most_recent_deployment_at)):
                most_recent_deployment_at = most_recent_update_at
            if len(deployments) > 1:
                task_name_common_prefix = find_common_prefix(
                        [deployment["task_name"] for deployment in deployments])
                if task_name_common_prefix:
                    for deployment in deployments:
                        deployment["task_display_name"] = deployment["task_name"][len(task_name_common_prefix):]
            response["services"].append({
                "service_arn": service_arn,
                "service_name": service.get("serviceName"),
                "service_display_name": service.get("serviceName"),
                "task_arn": service.get("taskDefinition"),
                "task_name": self._ecs_task_definition_arn_to_name(service.get("taskDefinition")),
                "task_display_name": self._ecs_task_definition_arn_to_name(service.get("taskDefinition")),
                "deployments": deployments
            })
        if len(response["services"]) > 1:
            service_name_common_prefix = (
                find_common_prefix([service["service_name"] for service in response["services"]]))
            if service_name_common_prefix:
                for service in response["services"]:
                    service["service_display_name"] = service["service_name"][len(service_name_common_prefix):]
            task_name_common_prefix = (
                find_common_prefix([service["task_name"] for service in response["services"]]))
            if task_name_common_prefix:
                for service in response["services"]:
                    service["task_display_name"] = service["task_name"][len(task_name_common_prefix):]

        if most_recent_deployment_at:
            response["most_recent_deployment_at"] = convert_datetime_to_utc_datetime_string(
                    most_recent_deployment_at)
        return self.create_success_response(response)

    def reactapi_aws_ecs_task_arns(self, latest: bool = True) -> Response:
        # If latest is True then only looks for the non-revisioned task ARNs.
        ecs = boto3.client('ecs')
        task_arns = ecs.list_task_definitions()['taskDefinitionArns']  # TODO: ecs_utils.list_ecs_tasks
        if latest:
            task_arns = list(set([self._ecs_task_definition_arn_to_name(task_arn) for task_arn in task_arns]))
        task_arns.sort()
        return task_arns

    def reactapi_aws_ecs_tasks(self, latest: bool = True) -> Response:
        task_definitions = []
        ecs = boto3.client('ecs')
        task_definition_arns = ecs.list_task_definitions()['taskDefinitionArns']
        if latest:
            task_definition_arns = list(set([self._ecs_task_definition_arn_to_name(task_definition_arn)
                                             for task_definition_arn in task_definition_arns]))
        for task_definition_arn in task_definition_arns:
            task_definition = self._reactapi_aws_ecs_task(task_definition_arn)
            task_containers = task_definition["task_containers"]
            task_container_names = [task_container["task_container_name"] for task_container in task_containers]
            if task_container_names:
                # If the "name" value of all of the task containers are then same then we
                # will take this to be the the task display name, e.g. "DeploymentAction".
                if all(task_container_name == task_container_names[0] for task_container_name in task_container_names):
                    task_definition["task_display_name"] = task_container_names[0]
            task_definitions.append(task_definition)
        # Here we have the flattened out list of task definitions, by revisions,
        # but we want them (the revisions) to be grouped by task_family, so do that now.
        response = []
        for task_definition in task_definitions:
            task_family = task_definition["task_family"]
            task_definition_response = [td for td in response if td["task_family"] == task_family]
            if not task_definition_response:
                task_definition_response = {
                    "task_family": task_family,
                    "task_name": task_definition["task_name"],
                    "task_display_name": task_definition["task_display_name"],
                    "task_revisions": []
                }
                response.append(task_definition_response)
            else:
                task_definition_response = task_definition_response[0]
            task_definition_response["task_revisions"].append(task_definition)
        response.sort(key=lambda value: value["task_family"])
        return self.create_success_response(response)

    def reactapi_aws_ecs_task(self, task_definition_arn: str) -> Response:
        return self.create_success_response(self._reactapi_aws_ecs_task(task_definition_arn))

    def _reactapi_aws_ecs_task(self, task_definition_arn: str) -> Response:
        # Note that the task_definition_arn can be either the specific task definition revision ARN,
        # i.e. the one with the trailing ":<revision-number>", or the plain task definition ARN,
        # i.e. without that trailing revision suffix. If it is the without the revision suffix,
        # then the latest (most recent, i.e. the revision with the highest number) is returned;
        # and the ARN prefix, e.g. "arn:aws:ecs:us-east-1:643366669028:task-definition", may be
        # also be omitted. URL-decode because the ARN may contain a slash.
        task_definition_arn = urllib.parse.unquote(task_definition_arn)
        ecs = boto3.client('ecs')
        task_definition = ecs.describe_task_definition(taskDefinition=task_definition_arn)["taskDefinition"]
        task_containers = []
        for task_container in task_definition.get("containerDefinitions", []):
            task_container_log = task_container.get("logConfiguration", {}).get("options", {})
            task_containers.append({
                "task_container_name": task_container["name"],
                "task_container_image": task_container["image"],
                "task_container_env": obfuscate_dict(name_value_list_to_dict(task_container["environment"])),
                "task_container_log_group": task_container_log.get("awslogs-group"),
                "task_container_log_region": task_container_log.get("awslogs-region"),
                "task_container_log_stream_prefix": task_container_log.get("awslogs-stream-prefix")
            })
        task_definition = {
            "task_arn": task_definition["taskDefinitionArn"],
            # The values of the task_family and task_name below should be exactly the same.
            "task_family": task_definition["family"],
            "task_name": self._ecs_task_definition_arn_to_name(task_definition_arn),
            "task_display_name": task_definition["family"],
            "task_revision": self._ecs_task_definition_revision(task_definition["taskDefinitionArn"]),
            "task_containers": task_containers
        }
        task_container_names = [task_container["task_container_name"] for task_container in task_containers]
        if task_container_names:
            # If the "name" value of all of the task containers are then same then we
            # will take this to be the the task display name, e.g. "DeploymentAction".
            if all(task_container_name == task_container_names[0] for task_container_name in task_container_names):
                task_definition["task_display_name"] = task_container_names[0]
        return task_definition

    @staticmethod
    def _ecs_task_definition_arn_to_name(task_definition_arn: str) -> str:
        """
        Given something like this:
        - arn:aws:ecs:us-east-1:466564410312:task-definition/c4-ecs-cgap-supertest-stack-CGAPDeployment-of2dr96JX1ds:1
        this function would return this:
        - c4-ecs-cgap-supertest-stack-CGAPDeployment-of2dr96JX1ds
        """
        if not task_definition_arn:
            return ""
        arn_parts = task_definition_arn.split("/", 1)
        name = arn_parts[1] if len(arn_parts) > 1 else task_definition_arn
        name_parts = name.rsplit(":", 1)
        return name_parts[0] if len(name_parts) > 1 else name

    @staticmethod
    def _ecs_task_definition_revision(task_definition_arn: str) -> str:
        task_definition_arn_parts = task_definition_arn.rsplit(":", 1)
        return task_definition_arn_parts[1] if len(task_definition_arn_parts) > 1 else task_definition_arn

    def reactapi_ingestion_submissions(self, request: dict, env: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(read_ingestion_submissions(
            self._get_metadata_bundles_bucket(env, args),
            int(args.get("offset", "0")) if args else 0,
            int(args.get("limit", "50")) if args else 50,
            urllib.parse.unquote(args.get("sort", "modified.desc") if args else "modified.desc")))

    def reactapi_ingestion_submission_summary(self, request: dict, env: str,
                                              uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_summary(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_detail(self, request: dict, env: str,
                                             uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_detail(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_manifest(self, request: dict, env: str,
                                               uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_manifest(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_resolution(self, request: dict, env: str,
                                                 uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_resolution(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_submission_response(self, request: dict, env: str,
                                                          uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_submission_response(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_traceback(self, request: dict, env: str,
                                                uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_traceback(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_upload_info(self, request: dict, env: str,
                                                  uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_upload_info(self._get_metadata_bundles_bucket(env, args), uuid))

    def reactapi_ingestion_submission_validation_report(self, request: dict, env: str,
                                                        uuid: str, args: Optional[dict] = None) -> Response:
        return self.create_success_response(
            read_ingestion_submission_validation_report(self._get_metadata_bundles_bucket(env, args), uuid))

    @staticmethod
    def _get_metadata_bundles_bucket(env: str, args: Optional[dict] = None) -> str:
        metadata_bundles_bucket = args.get("bucket") if args else None
        if not metadata_bundles_bucket or metadata_bundles_bucket == "null" or metadata_bundles_bucket == "undefined":
            s3 = s3_utils.s3Utils(env=env)
            metadata_bundles_bucket = s3.metadata_bucket
        return metadata_bundles_bucket

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
