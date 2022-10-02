from chalice import Response, __version__ as chalice_version
import os
import datetime
import copy
import json
import pkg_resources
import platform
import socket
import time
import urllib.parse
from itertools import chain
from dcicutils.env_utils import (
    EnvUtils,
    get_foursight_bucket,
    get_foursight_bucket_prefix,
    full_env_name
)
from dcicutils import ff_utils
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import (get_identity_name, get_identity_secrets)
from ...app import app
from ...cookie_utils import create_delete_cookie_string, read_cookie
from ...datetime_utils import convert_utc_datetime_to_useastern_datetime
from ...decorators import Decorators
from ...misc_utils import sort_dictionary_by_lowercase_keys
from .encoding_utils import base64_decode
from .auth import Auth
from .aws_s3 import AwsS3
from .checks import Checks
from .envs import Envs
from .gac import Gac
from .react_routes import ReactRoutes
from .react_ui import ReactUi


class ReactApi(ReactRoutes):

    def __init__(self):
        super(ReactApi, self).__init__()
        self.envs = Envs(app.core.get_unique_annotated_environment_names())
        self.checks = Checks(app.core.check_handler.CHECK_SETUP)
        self.gac = Gac()
        self.auth = Auth(app.core.get_auth0_client_id(app.core.get_default_env()),
                         app.core.get_auth0_secret(app.core.get_default_env()), self.envs)
        self.react_ui = ReactUi(self)

    class Cache:
        header = {}

    def create_standard_response(self, label: str, content_type: str = "application/json"):
        response = Response(label)
        response.headers = { "Content-Type": content_type }
        response.status_code = 200
        return response

    def is_react_authentication(self, auth0_response: dict) -> bool:
        return "react" in auth0_response.get("scope", "") if auth0_response else False

    def react_authentication_callback(self, request: dict, env: str, domain: str, jwt: str, expires: int):
        return self.auth.authorization_callback(request, env, domain, jwt, expires)

    def react_authorize(self, request: dict, env: str) -> dict:
        return self.auth.authorize(request, env)

    def react_serve_static_file(self, env: str, **kwargs):
        return self.react_ui.serve_static_file(env, **kwargs)

    def reactapi_route_logout(self, request: dict, env: str):
        domain, context = app.core.get_domain_and_context(request)
        redirect_url = read_cookie("reactredir", request)
        if not redirect_url:
            http = "https" if not app.core.is_running_locally(request) else "http"
            redirect_url = f"{http}://{domain}{context if context else ''}react/{env}/login"
        else:
            # Not certain if by design but the React library (universal-cookie) used to
            # write cookies URL-encodes them; rolling with it for now and URL-decoding here.
            redirect_url = urllib.parse.unquote(redirect_url)
        authtoken_cookie_deletion = create_delete_cookie_string(request=request, name="authtoken", domain=domain)
        headers = {
            "location": redirect_url,
            "set-cookie": authtoken_cookie_deletion
        }
        return Response(status_code=302, body=json.dumps(headers), headers=headers)

    def reactapi_route_header(self, request: dict, env: str):
        # Note that this route is not protected but/and we return the results from authorize.
        # TODO: remove stuff we don't need like credentials and also auth also version of other stuff and gac_name ...
        #       review all these data points and see which ones really need ...
        auth = self.auth.authorize(request, env)
        data = ReactApi.Cache.header.get(env)
        if not data:
            data = self.reactapi_route_header_nocache(request, env)
            ReactApi.Cache.header[env] = data
        data = copy.deepcopy(data)
        data["auth"] = auth
        response = self.create_standard_response("reactapi_route_header")
        response.body = data
        return response

    def reactapi_route_header_nocache(self, request: dict, env: str):
        domain, context = app.core.get_domain_and_context(request)
        stage_name = app.core.stage.get_stage()
        default_env = app.core.get_default_env()
        aws_credentials = self.auth.get_aws_credentials(env if env else default_env);
        response = {
            "app": {
                "title": app.core.html_main_title,
                "package": app.core.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": app.core.get_app_version(),
                "domain": domain,
                "context": context,
                "local": app.core.is_running_locally(request),
                "credentials": {
                    "aws_account_number": aws_credentials["aws_account_number"]
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

    def reactapi_route_info(self, request: dict, env: str):
        domain, context = app.core.get_domain_and_context(request)
        stage_name = app.core.stage.get_stage()
        default_env = app.core.get_default_env()
        if not self.envs.is_known_env(env):
            env_unknown = True
        else:
            env_unknown = False
        if not env_unknown:
            try:
                environment_and_bucket_info = sort_dictionary_by_lowercase_keys(obfuscate_dict(app.core.environment.get_environment_and_bucket_info(env, stage_name))),
                portal_url = app.core.get_portal_url(env)
            except:
                environment_and_bucket_info = None
                portal_url = None
        else:
            environment_and_bucket_info = None
            portal_url = None
        # Get known envs with GAC name for each.
        response = self.create_standard_response("reactapi_route_info")
        response.body = {
            "app": {
                "title": app.core.html_main_title,
                "package": app.core.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": app.core.get_app_version(),
                "domain": domain,
                "context": context,
                "local": app.core.is_running_locally(request),
                "credentials": self.auth.get_aws_credentials(env if env else default_env),
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
                "ecosystem": sort_dictionary_by_lowercase_keys(EnvUtils.declared_data()),
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
            "known_envs": self.envs.get_known_envs_with_gac_names(self.gac),
            # TODO: cache this (slow).
            "gac": {
                "name": get_identity_name(),
                "values": sort_dictionary_by_lowercase_keys(obfuscate_dict(get_identity_secrets())),
             },
            "environ": sort_dictionary_by_lowercase_keys(obfuscate_dict(dict(os.environ)))
        }
        return response

    def reactapi_route_users(self, request: dict, env: str):
        users = []
        # TODO: Support paging.
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
                "modified": convert_utc_datetime_to_useastern_datetime(last_modified)})
        response = self.create_standard_response("reactapi_route_users")
        response.body = sorted(users, key=lambda key: key["email_address"])
        return response

    def reactapi_route_users_user(self, request: dict, env: str, email: str):
        users = []
        for email_address in email.split(","):
            try:
                user = ff_utils.get_metadata('users/' + email_address.lower(), ff_env=full_env_name(env), add_on='frame=object')
                users.append({"email_address": email_address, "record": user})
            except Exception as e:
                users.append({"email_address": email_address, "record": {"error": str(e)}})
        response = self.create_standard_response("reactapi_route_users_user")
        response.body = sorted(users, key=lambda key: key["email_address"])
        return response

    def reactapi_route_gac_compare(self, request: dict, env: str, env_compare: str):
        response = self.create_standard_response("reactapi_route_gac_compare")
        response.body = self.gac.compare_gacs(env, env_compare)
        return response

    def reactapi_route_checks_raw(self, request: dict, env: str):
        response = self.create_standard_response("reactapi_route_checks_raw")
        response.body = self.checks.get_checks_raw()
        return response

    def reactapi_route_checks_registry(self, request: dict, env: str):
        response = self.create_standard_response("reactapi_route_checks_registry")
        response.body = Decorators.get_registry()
        return response

    def reactapi_route_checks(self, request: dict, env: str):
        response = self.create_standard_response("reactapi_route_checks")
        response.body = self.checks.get_checks_grouped(env)
        return response

    def reactapi_route_checks_history(self, request: dict, env: str, check: str, offset: int = 0, limit: int = 25, sort: str = None):
        if offset < 0:
            offset = 0
        if limit < 0:
            limit = 0
        response = self.create_standard_response("reactapi_route_checks_history")
        check_record = self.checks.get_check(env, check)
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
                        timestamp = convert_utc_datetime_to_useastern_datetime(timestamp)
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

    def reactapi_route_checks_status(self, request: dict, env: str):
        response = self.create_standard_response("reactapi_route_checks_status")
        checks_queue = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        checks_running = checks_queue.get('ApproximateNumberOfMessagesNotVisible')
        checks_queued = checks_queue.get('ApproximateNumberOfMessages')
        response.body = {
            "checks_running": checks_running,
            "checks_queued": checks_queued
        }
        return response

    def reactapi_route_lambdas(self, request: dict, env: str):
        response = self.create_standard_response("reactapi_route_lambdas")
        response.body = self.checks.get_annotated_lambdas()
        return response

    def reactapi_route_check_results(self, request: dict, env: str, check: str):
        """
        Returns the latest result from the given check.
        """
        response = self.create_standard_response("reactapi_route_check_results")
        try:
            connection = app.core.init_connection(env)
            check_results = app.core.CheckResult(connection, check)
            #check_results = check_results.get_closest_result()
            check_results = check_results.get_latest_result()
            uuid = check_results["uuid"]
            check_datetime = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
            check_datetime = convert_utc_datetime_to_useastern_datetime(check_datetime)
            check_results["timestamp"] = check_datetime
            response.body = check_results
        except Exception as e:
            response.body = {}
        return response

    def reactapi_route_check_result(self, request: dict, env: str, check: str, uuid: str):
        """
        Returns the specified result, by uuid, for the given check.
        Analogous legacy function is app_utils.view_foursight_check.
        """
        response = []
        servers = []
        try:
            connection = app.core.init_connection(env)
        except Exception:
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

    def reactapi_route_checks_run(self, request: dict, env: str, check: str, args: str):
        response = self.create_standard_response("reactapi_route_checks_run")
        args = base64_decode(args)
        args = json.loads(args)
        queued_uuid = app.core.queue_check(env, check, args)
        response.body = {"check": check, "env": env, "uuid": queued_uuid}
        return response

    def reactapi_route_aws_s3_buckets(self, request: dict, env: str):
        response = self.create_standard_response("reactapi_route_aws_s3_buckets")
        response.body = AwsS3.get_buckets()
        return response

    def reactapi_route_aws_s3_buckets_keys(self, request: dict, env: str, bucket: str):
        response = self.create_standard_response("reactapi_route_aws_s3_buckets_keys")
        response.body = AwsS3.get_bucket_keys(bucket)
        return response

    def reactapi_route_aws_s3_buckets_key_contents(self, request: dict, env: str, bucket: str, key: str):
        key = urllib.parse.unquote(key)
        response = self.create_standard_response("reactapi_route_aws_s3_buckets_key_contents")
        response.body = AwsS3.get_bucket_key_contents(bucket, key)
        return response

    def reactapi_route_reload_lambda(self, request: dict, env: str, lambda_name: str):
        app.core.reload_lambda(lambda_name)
        time.sleep(3)
        headers = {'Location': f"{context}info/{environ}"}
        return Response(status_code=302, body=json.dumps(headers), headers=headers)

    def reactapi_route_clear_cache(self, request: dict, env: str):
        pass
