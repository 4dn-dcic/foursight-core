from chalice import Response, __version__ as chalice_version
import copy
import datetime
from functools import lru_cache
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
from dcicutils import ff_utils
from dcicutils.misc_utils import ignored
from dcicutils.obfuscation_utils import obfuscate_dict
from ...app import app
from ...decorators import Decorators
from .aws_s3 import AwsS3
from .checks import Checks
from .cookie_utils import create_delete_cookie_string
from .datetime_utils import convert_uptime_to_datetime, convert_utc_datetime_to_useastern_datetime_string
from .encoding_utils import base64_decode_to_json
from .gac import Gac
from .misc_utils import (
    get_base_url,
    is_running_locally,
    sort_dictionary_by_case_insensitive_keys
)
from .react_routes import ReactRoutes
from .react_api_base import ReactApiBase
from .react_ui import ReactUi


# Implementation functions corresponding directly to the routes in react_routes.
class ReactApi(ReactApiBase, ReactRoutes):

    def __init__(self):
        super(ReactApi, self).__init__()
        self._react_ui = ReactUi(self)
        self._checks = Checks(app.core.check_handler.CHECK_SETUP, self._envs)
        self._cached_header = {}
        self._cached_sqs_queue_url = None
        self._cached_accounts = None
        self._cached_elasticsearch_server_version = None

    def get_sqs_queue_url(self):
        if not self._cached_sqs_queue_url:
            self._cached_sqs_queue_url = app.core.sqs.get_sqs_queue().url
        return self._cached_sqs_queue_url

    def _get_versions_object(self) -> dict:
        try:
            elasticsearch_version = pkg_resources.get_distribution('elasticsearch').version
            elasticsearch_dsl_version = pkg_resources.get_distribution('elasticsearch-dsl').version
        except Exception:
            elasticsearch_version = None
            elasticsearch_dsl_version = None
        return {
                "foursight": app.core.get_app_version(),
                "foursight_core": pkg_resources.get_distribution('foursight-core').version,
                "dcicutils": pkg_resources.get_distribution('dcicutils').version,
                "python": platform.python_version(),
                "chalice": chalice_version,
                "elasticsearch_server": self._get_elasticsearch_server_version(),
                "elasticsearch": elasticsearch_version,
                "elasticsearch_dsl": elasticsearch_dsl_version
            }

    def _get_elasticsearch_server_version(self) -> Optional[str]:
        if not self._cached_elasticsearch_server_version:
            try:
                connection = app.core.init_connection(self._envs.get_default_env())
                es_info = connection.es_info()
                elasticsearch_server_version = es_info["version"]["number"]
                self._cached_elasticsearch_server_version = elasticsearch_server_version
            except Exception:
                pass
        return self._cached_elasticsearch_server_version

    def react_serve_static_file(self, env: str, paths: list) -> Response:
        """
        Called from react_routes for static endpoints: /{env}/{path}/{etc}
        Serves static UI related (JavaScript, CSS, HTML) files.
        Note that this in an UNPROTECTED route.
        """
        return self._react_ui.serve_static_file(env, paths)

    def reactapi_auth0_config(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/auth0_config
        Note that this in an UNPROTECTED route.
        """
        auth0_config = self._auth0_config.get_config_data()
        # Note we add the callback for the UI to setup its Auth0 login for.
        auth0_config["callback"] = self._auth0_config.get_callback_url(request)
        return self.create_success_response(self._auth0_config.get_config_data())

    def reactapi_logout(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/logout
        Note that this in an UNPROTECTED route.
        """
        authorize_response = self._auth.authorize(request, env)
        if not authorize_response or not authorize_response["authorized"]:
            body = {"status": "Already logged out."}
        else:
            body = {"status": "Logged out."}
        domain, context = app.core.get_domain_and_context(request)
        authtoken_cookie_deletion = create_delete_cookie_string(request=request, name="authtoken", domain=domain)
        redirect_url = self.get_redirect_url(request, env, domain, context)
        headers = {"Set-Cookie": authtoken_cookie_deletion}
        return self.create_redirect_response(location=redirect_url, body=body, headers=headers)

    def reactapi_header(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/header
        Note that this in an UNPROTECTED route.
        """
        # Note that this route is not protected but/and we return the results from authorize.
        auth = self._auth.authorize(request, env)
        data = self._cached_header.get(env)
        if not data:
            data = self._reactapi_header_nocache(request, env)
            self._cached_header[env] = data
        data = copy.deepcopy(data)
        data["auth"] = auth
        # 2022-10-18
        # No longer sharing known-envs widely; send only if authenticated;
        # if not authenticated then act as-if the default-env is the only known-env;
        # in this case also include (as an FYI for the UI) the real number of known-envs.
        if auth["authenticated"]:
            data["auth"]["known_envs"] = self._envs.get_known_envs_with_gac_names()
        else:
            known_envs_default = self._envs.find_known_env(self._envs.get_default_env())
            known_envs_actual_count = self._envs.get_known_envs_count()
            data["auth"]["known_envs"] = [known_envs_default]
            data["auth"]["known_envs_actual_count"] = known_envs_actual_count
        data["timestamp"] = convert_utc_datetime_to_useastern_datetime_string(datetime.datetime.utcnow())
        return self.create_success_response(data)

    def _reactapi_header_nocache(self, request: dict, env: str) -> dict:
        """
        No-cache version of above reactapi_header function.
        """
        domain, context = app.core.get_domain_and_context(request)
        stage_name = app.core.stage.get_stage()
        default_env = self._envs.get_default_env()
        aws_credentials = self._auth.get_aws_credentials(env if env else default_env)
        portal_url = get_base_url(app.core.get_portal_url(env if env else default_env))
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
                    "aws_account_name": aws_credentials.get("aws_account_name"),
                    "re_captcha_key": os.environ.get("reCaptchaKey", None)
                },
                "launched": app.core.init_load_time,
                "deployed": app.core.get_lambda_last_modified(),
                "accounts": self.get_accounts_file()
            },
            "versions": self._get_versions_object(),
            "portal": {
                "url": app.core.get_portal_url(env if env else default_env),
                "health_url": portal_url + "/health?format=json",
                "health_ui_url": portal_url + "/health"
            },
            "s3": {
                "bucket_org": os.environ.get("ENCODED_S3_BUCKET_ORG", os.environ.get("S3_BUCKET_ORG", None)),
                "global_env_bucket": os.environ.get("GLOBAL_ENV_BUCKET", os.environ.get("GLOBAL_BUCKET_ENV", None)),
                "encrypt_key_id": os.environ.get("S3_ENCRYPT_KEY_ID", None)
            }
        }
        return response

    @lru_cache(50)
    def _get_env_and_bucket_info(self, env: str, stage_name: str) -> dict:
        return sort_dictionary_by_case_insensitive_keys(
            obfuscate_dict(app.core.environment.get_environment_and_bucket_info(env, stage_name)))

    @lru_cache(50)
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
        lambdas = self._checks.get_annotated_lambdas()
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
                "local": is_running_locally(request),
                "credentials": self._auth.get_aws_credentials(env if env else default_env),
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
                "sqs": self.get_sqs_queue_url(),
            },
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
            "checks": {
                "file": app.core.check_handler.CHECK_SETUP_FILE,
                "bucket": self._get_check_result_bucket_name(env if env else default_env)
            },
            "known_envs": self._envs.get_known_envs_with_gac_names(),
            "gac": Gac.get_gac_info(),
            "environ": sort_dictionary_by_case_insensitive_keys(obfuscate_dict(dict(os.environ)))
        }
        return self.create_success_response(body)

    def reactapi_users(self, request: dict, env: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/users
        Returns a (paged) summary of all users.
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

        users = []
        # TODO: Consider adding ability to search for both normal users and
        #       admin/foursight users (who would have access to foursight);
        #       and more advanced, the ability to grant foursight access.
        add_on = f"frame=object&datastore=database&limit={limit}&from={offset}&sort={sort}"
        results = ff_utils.get_metadata("users/", ff_env=full_env_name(env), add_on=add_on)
        total = results["total"]
        for user in results["@graph"]:
            updated = user.get("last_modified")
            if updated:
                updated = updated.get("date_modified")
            created = user.get("date_created")
            users.append({
                # Lower case email to avoid any possible issues on lookup later.
                "email": (user.get("email") or "").lower(),
                "first_name": user.get("first_name"),
                "last_name": user.get("last_name"),
                "uuid": user.get("uuid"),
                "title": user.get("title"),
                "groups": user.get("groups"),
                "project": user.get("project"),
                "institution": user.get("user_institution"),
                "updated": convert_utc_datetime_to_useastern_datetime_string(updated),
                "created": convert_utc_datetime_to_useastern_datetime_string(created)
            })
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

    def reactapi_get_user(self, request: dict, env: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/user/{uuid}
        Returns info on the specified user uuid. The uuid can actually also
        be an email address; and can also be a comma-separated list of these;
        if just one requested then return a single object, otherwise return an array.
        """
        ignored(request)
        users = []
        items = uuid.split(",")
        not_found_count = 0
        other_error_count = 0
        for item in items:
            try:
                # Note these call works for both email address or user UUID.
                # Note we must lower case the email to find the user. This is because all emails
                # in the database are lowercased; it causes issues with OAuth if we don't do this.
                user = ff_utils.get_metadata('users/' + item.lower(),
                                             ff_env=full_env_name(env), add_on='frame=object&datastore=database')
                users.append(user)
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
        Called from react_routes for endpoint: POST /{env}/users/create
        Creates a new user described by the given data.
        Given user data looks like:
        {email': 'japrufrock@hms.harvard.edu', 'first_name': 'J. Alfred', 'last_name': 'Prufrock'}
        Returns the same response as GET /{env}/users/{uuid} (i.e. reactpi_get_user).
        """
        ignored(request)
        response = ff_utils.post_metadata(schema_name="users", post_item=user, ff_env=full_env_name(env))
        #
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
        created_user = graph[0]
        uuid = created_user.get("uuid")
        if not uuid:
            return self.create_error_response(json.dumps(response))
        return self.create_response(201, created_user)

    def reactapi_patch_user(self, request: dict, env: str, uuid: str, user: dict) -> Response:
        """
        Called from react_routes for endpoint: PATCH /{env}/users/update/{uuid}
        Updates the user identified by the given uuid with the given data.
        Returns the same response as GET /{env}/users/{uuid} (i.e. reactpi_get_user).
        """
        ignored(request)
        # Note that there may easily be a delay after update until the record is actually updated.
        # TODO: Find out precisely why this is so, and if and how to specially handle it on the client side.
        response = ff_utils.patch_metadata(obj_id=f"users/{uuid}", patch_item=user, ff_env=full_env_name(env))
        status = response.get("status")
        if status != "success":
            return self.create_error_response(json.dumps(response))
        graph = response.get("@graph")
        if not graph or not isinstance(graph, list) or len(graph) != 1:
            return self.create_error_response(json.dumps(response))
        updated_user = graph[0]
        return self.create_success_response(updated_user)

    def reactapi_delete_user(self, request: dict, env: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: DELETE /{env}/users/delete/{uuid}
        Deletes the user identified by the given uuid.
        """
        ignored(request)
        _ = ff_utils.delete_metadata(obj_id=f"users/{uuid}", ff_env=full_env_name(env))
        _ = ff_utils.purge_metadata(obj_id=f"users/{uuid}", ff_env=full_env_name(env))
        return self.create_success_response({"status": "User deleted.", "uuid": uuid})

    def reactapi_checks(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks
        Returns a summary (list) of all defined checks.
        """
        ignored(request)
        return self.create_success_response(self._checks.get_checks_grouped(env))

    def reactapi_check_results(self, request: dict, env: str, check: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}
        Returns the latest result from the given check (name).
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
        check_datetime = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
        check_datetime = convert_utc_datetime_to_useastern_datetime_string(check_datetime)
        check_results["timestamp"] = check_datetime
        return self.create_success_response(check_results)

    def reactapi_check_result(self, request: dict, env: str, check: str, uuid: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/{uuid}
        Returns the check result for the given check (name) and uuid.
        Analogous legacy function is app_utils.view_foursight_check.
        """
        ignored(request)
        body = []
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
                body.append({
                    'status': 'success',
                    'env': env,
                    'checks': {title: processed_result}
                })
        return self.create_success_response(body)

    def reactapi_checks_history_recent(self, request: dict, env: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/history/recent.
        Returns the most results among all defined checks for the given environment.
        Does this by looping through each check and getting the 10 most recent results from each
        and then globally sorting (in descending order) each of those results by check run timestamp.
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
        Called from react_routes for endpoint: GET /{env}/checks/check/history
        Returns a (paged) summary (list) of check results for the given check (name).
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

        check_record = self._checks.get_check(env, check)
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
        return self.create_success_response(body)

    def reactapi_checks_run(self, request: dict, env: str, check: str, args: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}/run
        Kicks off a run for the given check (name).
        """
        ignored(request)
        args = base64_decode_to_json(args)
        queued_uuid = app.core.queue_check(env, check, args)
        return self.create_success_response({"check": check, "env": env, "uuid": queued_uuid})

    def reactapi_checks_status(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks-status
        Returns the status of any/all currently running or queued checks.
        """
        ignored(request)
        ignored(env)
        checks_queue = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        checks_running = checks_queue.get('ApproximateNumberOfMessagesNotVisible')
        checks_queued = checks_queue.get('ApproximateNumberOfMessages')
        return self.create_success_response({"checks_running": checks_running, "checks_queued": checks_queued})

    def reactapi_checks_raw(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks-raw
        Returns the content of the raw/original check_setup.json file.
        """
        ignored(request)
        ignored(env)
        return self.create_success_response(self._checks.get_checks_raw())

    def reactapi_checks_registry(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks-registry
        Returns the content of the checks registry collected for the check_function
        decorator in decorators.py.
        """
        ignored(request)
        ignored(env)
        return self.create_success_response(Decorators.get_registry())

    def reactapi_lambdas(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/lambdas
        Returns a summary (list) of all defined AWS lambdas for the current AWS environment.
        """
        ignored(request)
        ignored(env)
        # TODO: Filter out checks of lambas not in the env.
        return self.create_success_response(self._checks.get_annotated_lambdas())

    def reactapi_gac_compare(self, request: dict, env: str, env_compare: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/gac/{environ_compare}
        Returns differences between two GACs (global application configurations).
        """
        ignored(request)
        ignored(env)
        return self.create_success_response(Gac.compare_gacs(env, env_compare))

    def reactapi_aws_s3_buckets(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets
        Return a list of all AWS S3 bucket names for the current AWS environment.
        """
        ignored(request)
        ignored(env)
        return self.create_success_response(AwsS3.get_buckets())

    def reactapi_aws_s3_buckets_keys(self, request: dict, env: str, bucket: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets/{bucket}
        Return a list of all AWS S3 bucket key names in the given bucket
        for the current AWS environment.
        """
        ignored(request)
        ignored(env)
        return self.create_success_response(AwsS3.get_bucket_keys(bucket))

    def reactapi_aws_s3_buckets_key_contents(self, request: dict, env: str, bucket: str, key: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets/{bucket}/{key}
        Return the contents of the AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        ignored(env)
        ignored(bucket)
        ignored(key)
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
    def get_accounts_file() -> str:
        return app.core.accounts_file

    def get_accounts(self) -> Optional[dict]:
        accounts_file = self.get_accounts_file()
        if not accounts_file:
            return None
        if not self._cached_accounts:
            from foursight_core.react.api.encryption import Encryption
            encryption = Encryption()
            with io.open(self.get_accounts_file(), "r") as accounts_json_f:
                accounts_json_content_encrypted = accounts_json_f.read()
                if accounts_json_content_encrypted.startswith("["):
                    # Check for not encrypted (lamely) for local testing.
                    accounts_json_content = accounts_json_content_encrypted
                else:
                    accounts_json_content = encryption.decrypt(accounts_json_content_encrypted)
                accounts_json = json.loads(accounts_json_content)
                for account in accounts_json:
                    account_name = account.get("name")
                    if account_name:
                        account_stage = account.get("stage")
                        if account_stage:
                            account["id"] = account_name + ":" + account_stage
                        else:
                            account["id"] = account_name
                self._cached_accounts = accounts_json
        return self._cached_accounts

    def reactapi_accounts(self, request: dict) -> Response:
        ignored(request)
        accounts = self.get_accounts()
        return self.create_success_response(accounts)

    def reactapi_account(self, request: dict, name: str) -> Response:

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

        def get_foursight_info(foursight_url: str, response: dict) -> Optional[str]:
            response["foursight"] = {}
            if not foursight_url:
                return None
            response["foursight"]["url"] = get_foursight_base_url(foursight_url)
            response["foursight"]["header_url"] = response["foursight"]["url"] + "/reactapi/header"
            foursight_header_response = requests.get(response["foursight"]["header_url"])
            if foursight_header_response.status_code != 200:
                response["foursight"]["error"] = f"Cannot fetch Foursight header URL.",
                response["foursight"]["header_url_status"] = foursight_header_response.status_code
                return None
            foursight_header_json = foursight_header_response.json()
            response["foursight"]["versions"] = foursight_header_json["versions"]
            foursight_app = foursight_header_json.get("app")
            if foursight_app:
                response["foursight"]["package"] = foursight_app["package"]
                response["foursight"]["stage"] = foursight_app["stage"]
                response["foursight"]["deployed"] = foursight_app["deployed"]
            response["foursight"]["default_env"] = foursight_header_json["auth"]["known_envs"][0]
            response["foursight"]["env_count"] = foursight_header_json["auth"]["known_envs_actual_count"]
            response["foursight"]["identity"] = foursight_header_json["auth"]["known_envs"][0].get("gac_name")
            foursight_header_json_s3 = foursight_header_json.get("s3")
            if foursight_header_json_s3:
                response["foursight"]["s3"] = {}
                response["foursight"]["s3"]["bucket_org"] = foursight_header_json_s3.get("bucket_org")
                response["foursight"]["s3"]["global_env_bucket"] = foursight_header_json_s3.get("global_env_bucket")
                response["foursight"]["s3"]["encrypt_key_id"] = foursight_header_json_s3.get("encrypt_key_id")
            if foursight_app:
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
        response = {"accounts_file": self.get_accounts_file()}
        accounts = self.get_accounts()
        if not accounts:
            return self.create_success_response({"status": "No accounts file support."})
        account = [account for account in accounts if is_account_name_match(account, name)] if accounts else None
        if not account or len(account) > 1:
            response["name"] = name
            response["error"] = f"Cannot find {' unique' if len(account) > 1 else ''} account."
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

    def reactapi_clear_cache(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /__clearcache___
        Not yet implemented.
        """
        ignored(request)
        app.core.cache_clear()
        super().cache_clear()
        self._checks.cache_clear()
        self._react_ui.cache_clear()
        Gac.cache_clear()
        self._cached_header = {}
        self._cached_sqs_queue_url = None
        self._cached_elasticsearch_server_version = None
        self._cached_accounts = None
        self._get_env_and_bucket_info.cache_clear()
        self._get_check_result_bucket_name.cache_clear()
        return self.create_success_response({"status": "Caches cleared."})

    @staticmethod
    def reactapi_testsize(n: int) -> Response:
        n = int(n) - 8  # { "N": "" }
        s = "".join(["X" for _ in range(n)])
        body = {"N": s}
        return app.core.create_success_response(body)
