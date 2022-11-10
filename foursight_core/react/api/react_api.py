from chalice import Response, __version__ as chalice_version
import copy
import datetime
from functools import lru_cache
import json
import os
import pkg_resources
import platform
import socket
import time
from typing import Optional
import urllib.parse
from itertools import chain
from dcicutils.env_utils import EnvUtils, get_foursight_bucket, get_foursight_bucket_prefix, full_env_name
from dcicutils import ff_utils
from dcicutils.obfuscation_utils import obfuscate_dict
from ...app import app
from ...decorators import Decorators
from .aws_s3 import AwsS3
from .checks import Checks
from .cookie_utils import create_delete_cookie_string
from .datetime_utils import convert_utc_datetime_to_useastern_datetime_string
from .encoding_utils import base64_decode_to_json
from .gac import Gac
from .misc_utils import (
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

    def get_sqs_queue_url(self):
        if not self._cached_sqs_queue_url:
            self._cached_sqs_queue_url = app.core.sqs.get_sqs_queue().url
        return self._cached_sqs_queue_url

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
        return self.create_success_response(data)

    def _reactapi_header_nocache(self, request: dict, env: str) -> dict:
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
                    "aws_account_name": aws_credentials.get("aws_account_name")
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

    @lru_cache(1)
    def _get_env_and_bucket_info(self, env: str, stage_name: str) -> dict:
        return sort_dictionary_by_case_insensitive_keys(
            obfuscate_dict(app.core.environment.get_environment_and_bucket_info(env, stage_name)))

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
            except Exception as e:
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
                "file": app.core.check_handler.CHECK_SETUP_FILE
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
        response = ff_utils.post_metadata(schema_name="users", post_item=user, ff_env=full_env_name(env))
        #
        # Response looks like:
        # {'status': 'success', '@type': ['result'], '@graph': [{'date_created': '2022-10-22T18:39:16.973680+00:00', 'submitted_by': '/users/b5f738b6-455a-42e5-bc1c-77fbfd9b15d2/', 'schema_version': '1', 'status': 'current', 'email': 'test_user@hms.harvard.edu', 'first_name': 'J. Alfred', 'last_name': 'Prufrock', 'timezone': 'US/Eastern', 'last_modified': {'modified_by': '/users/b5f738b6-455a-42e5-bc1c-77fbfd9b15d2/', 'date_modified': '2022-10-22T18:39:16.975477+00:00'}, '@id': '/users/03cb92c4-b086-47e5-a875-42a01dc63581/', '@type': ['User', 'Item'], 'uuid': '03cb92c4-b086-47e5-a875-42a01dc63581', 'principals_allowed': {'view': ['group.admin', 'remoteuser.EMBED', 'remoteuser.INDEXER', 'userid.03cb92c4-b086-47e5-a875-42a01dc63581'], 'edit': ['group.admin']}, 'display_title': 'J. Alfred Prufrock', 'title': 'J. Alfred Prufrock', 'contact_email': 'test_user@hms.harvard.edu'}]}
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
        response = ff_utils.delete_metadata(obj_id=f"users/{uuid}", ff_env=full_env_name(env))
        response = ff_utils.purge_metadata(obj_id=f"users/{uuid}", ff_env=full_env_name(env))
        return self.create_success_response({"status": "User deleted.", "uuid": uuid})

    def reactapi_checks(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks
        Returns a summary (list) of all defined checks.
        """
        return self.create_success_response(self._checks.get_checks_grouped(env))

    def reactapi_check_results(self, request: dict, env: str, check: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/{check}
        Returns the latest result from the given check (name).
        """
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
        body = []
        try:
            connection = app.core.init_connection(env)
        except Exception as e:
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
                processed_result = app.core.process_view_result(connection, data, is_admin=True)
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
        MAX_RESULTS_PER_CHECK = 10
        limit = int(args.get("limit", "25")) if args else 25
        if limit < 1:
            limit = 1
        results = []
        connection = app.core.init_connection(env)
        checks = self._checks._get_checks(env)
        for check_name in checks:
            group_name = checks[check_name]["group"]
            check_title = checks[check_name]["title"]
            recent_history, _ = app.core.get_foursight_history(connection, check_name,
                                                               0, MAX_RESULTS_PER_CHECK, "timestamp.desc")
            for result in recent_history:
                uuid = None
                duration = None
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
        results.sort(key=lambda item: item["timestamp"], reverse=True)
        results = results[:limit]
        return self.create_success_response(results)

    def reactapi_checks_history(self, request: dict, env: str, check: str, args: Optional[dict] = None) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks/check/history
        Returns a (paged) summary (list) of check results for the given check (name).
        """
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
        queue_attr = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
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
        args = base64_decode_to_json(args)
        queued_uuid = app.core.queue_check(env, check, args)
        return self.create_success_response({"check": check, "env": env, "uuid": queued_uuid})

    def reactapi_checks_status(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks-status
        Returns the status of any/all currently running or queued checks.
        """
        checks_queue = app.core.sqs.get_sqs_attributes(app.core.sqs.get_sqs_queue().url)
        checks_running = checks_queue.get('ApproximateNumberOfMessagesNotVisible')
        checks_queued = checks_queue.get('ApproximateNumberOfMessages')
        return self.create_success_response({"checks_running": checks_running, "checks_queued": checks_queued})

    def reactapi_checks_raw(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks-raw
        Returns the content of the raw/original check_setup.json file.
        """
        return self.create_success_response(self._checks.get_checks_raw())

    def reactapi_checks_registry(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/checks-registry
        Returns the content of the checks registry collected for the check_function
        decorator in decorators.py.
        """
        return self.create_success_response(Decorators.get_registry())

    def reactapi_lambdas(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/lambdas
        Returns a summary (list) of all defined AWS lambdas for the current AWS environment.
        """
        # TODO: Filter out checks of lambas not in the env.
        return self.create_success_response(self._checks.get_annotated_lambdas())

    def reactapi_gac_compare(self, request: dict, env: str, env_compare: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/gac/{environ_compare}
        Returns differences between two GACs (global application configurations).
        """
        return self.create_success_response(Gac.compare_gacs(env, env_compare))

    def reactapi_aws_s3_buckets(self, request: dict, env: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets
        Return a list of all AWS S3 bucket names for the current AWS environment.
        """
        return self.create_success_response(AwsS3.get_buckets())

    def reactapi_aws_s3_buckets_keys(self, request: dict, env: str, bucket: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets/{bucket}
        Return a list of all AWS S3 bucket key names in the given bucket
        for the current AWS environment.
        """
        return self.create_success_response(AwsS3.get_bucket_keys(bucket))

    def reactapi_aws_s3_buckets_key_contents(self, request: dict, env: str, bucket: str, key: str) -> Response:
        """
        Called from react_routes for endpoint: GET /{env}/s3/buckets/{bucket}/{key}
        Return the contents of the AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        if True:
            #
            # TODO!!!
            # Disabling this feature for now until we can discuss/resolve security concerns.
            #
            return self.create_not_implemented_response(request)
        key = urllib.parse.unquote(key)
        return self.create_success_response(AwsS3.get_bucket_key_contents(bucket, key))

    def reactapi_reload_lambda(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /__reloadlambda__
        Kicks off a reload of the given lambda name. For troubleshooting only.
        """
        app.core.reload_lambda()
        time.sleep(3)
        return self.create_success_response({"status": "Lambda reloaded."})

    def reactapi_clear_cache(self, request: dict) -> Response:
        """
        Called from react_routes for endpoint: GET /__clearcache___
        Not yet implemented.
        """
        app.core.cache_clear()
        super().cache_clear()
        self._checks.cache_clear()
        self._react_ui.cache_clear()
        Gac.cache_clear()
        self._cached_header = {}
        self._cached_sqs_queue_url = None
        self._get_env_and_bucket_info.cache_clear()
        return self.create_success_response({"status": "Caches cleared."})
