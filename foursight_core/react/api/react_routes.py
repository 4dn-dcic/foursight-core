from chalice import Response
from dcicutils.misc_utils import ignored
from ...app import app
from .misc_utils import get_request_arg, get_request_args, get_request_body
from .react_route_decorator import route, route_root


class ReactRoutes:

    def __init__(self):
        super(ReactRoutes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes UNPROTECTED by authorization/authentication.
    # ----------------------------------------------------------------------------------------------

    @route("/{env}/auth0_config", authorize=False)
    def reactapi_route_auth0_config(env) -> Response:  # noqa
        ignored(env)
        """
        Note that this in an UNPROTECTED route.
        Returns the Auth0 configuration info required for login.
        """
        return app.core.reactapi_auth0_config(app.current_request.to_dict())

    @route("/auth0_config", authorize=False)
    def reactapi_route_auth0_config_noenv() -> Response:  # noqa
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/auth0_config route.
        """
        return app.core.reactapi_auth0_config(app.current_request.to_dict())

    @route("/{env}/logout", authorize=False)
    def reactapi_route_logout(env: str) -> Response:  # noqa
        """
        Note that this in an UNPROTECTED route.
        Logs out the user. Sends back specific message if already logged out, or not.
        The env is not strictly required for logout, since we logout from all environments,
        but it is is useful for the redirect back, and also just for consistency/completeness.
        """
        return app.core.reactapi_logout(app.current_request.to_dict(), env)

    @route("/logout", authorize=False)
    def reactapi_route_logout_noenv() -> Response:  # noqa
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/logout route.
        """
        return app.core.reactapi_logout(app.current_request.to_dict(), app.core.get_default_env())

    @route("/{env}/header", authorize=False)
    def reactapi_route_header(env: str) -> Response:  # noqa
        """
        Note that this in an UNPROTECTED route.
        Returns minimal data for React UI to get up and running.
        """
        return app.core.reactapi_header(app.current_request.to_dict(), env)

    @route("/header", authorize=False)
    def reactapi_route_header_noenv() -> Response:  # noqa
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/header route.
        """
        return app.core.reactapi_header(app.current_request.to_dict(), app.core.get_default_env())

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes PROTECTED by authorization/authentication.
    # ----------------------------------------------------------------------------------------------

    @route("/{env}/info", authorize=True)
    def reactapi_route_info(env: str) -> Response:  # noqa
        """
        Returns sundry info about the app.
        """
        return app.core.reactapi_info(app.current_request.to_dict(), env)

    @route("/{env}/users", methods=["GET", "POST"], authorize=True)
    def reactapi_route_users_get_or_post(env: str) -> Response:  # noqa
        """
        GET:  Returns the list of all defined users (TODO: not yet paged).
        POST: Creates a new user described by the given data;
              must contain: email, first_name, last_name.

        Note that you cannot have more than one route with the same path even
        if the methods are different; rather you must bundle them together and
        distinguish between which method is used programmatically as we do here.
        """
        if app.current_request.method == "GET":
            request = app.current_request.to_dict()
            return app.core.reactapi_users(request, env, get_request_args(request))
        elif app.current_request.method == "POST":
            user = get_request_body(app.current_request)
            return app.core.reactapi_post_user(app.current_request.to_dict(), env, user=user)
        else:
            return app.core.create_forbidden_response()

    @route("/{env}/users/{uuid}", methods=["GET", "PATCH", "DELETE"], authorize=True)
    def reactapi_route_user_get_or_patch_or_delete(env: str, uuid: str) -> Response:  # noqa
        """
        GET:    Returns detailed info for the user identified by the given uuid (may also be email).
        PATCH:  Updates the user identified by the given uuid with the given user data;
                must contain: email, first_name, last_name.
        DELETE: Deletes the user identified by the given uuid.

        Note that you cannot have more than one route with the same path even
        if the methods are different; rather you must bundle them together and
        distinguish between which method is used programmatically as we do here.
        """
        if app.current_request.method == "GET":
            return app.core.reactapi_get_user(app.current_request.to_dict(), env, uuid=uuid)
        elif app.current_request.method == "PATCH":
            user = get_request_body(app.current_request)
            return app.core.reactapi_patch_user(app.current_request.to_dict(), env, uuid=uuid, user=user)
        elif app.current_request.method == "DELETE":
            return app.core.reactapi_delete_user(app.current_request.to_dict(), env, uuid=uuid)
        else:
            return app.core.create_forbidden_response()

    @route("/{env}/checks", authorize=True)
    def reactapi_route_checks(env: str) -> Response:  # noqa
        """
        Returns detailed info on all defined checks.
        """
        return app.core.reactapi_checks(app.current_request.to_dict(), env)

    @route("/{env}/checks/{check}", authorize=True)
    def reactapi_route_check_results(env: str, check: str) -> Response:  # noqa
        """
        Returns the most result of the most recent run for the given check.
        """
        return app.core.reactapi_check_results(app.current_request.to_dict(), env, check=check)

    @route("/{env}/checks/{check}/{uuid}", authorize=True)
    def reactapi_route_check_result(env: str, check: str, uuid: str) -> Response:  # noqa
        """
        Returns the result of the given check.
        """
        return app.core.reactapi_check_result(app.current_request.to_dict(), env, check=check, uuid=uuid)

    @route("/{env}/checks/{check}/history", authorize=True)
    def reactapi_route_checks_history(env: str, check: str) -> Response:  # noqa
        """
        Returns detailed info on the run histories of the given check (paged).
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_history(request, env, check=check, args=get_request_args(request))

    @route("/{env}/checks/history/recent", authorize=True)
    def reactapi_route_checks_history_recent(env: str) -> Response:  # noqa
        """
        Returns all recent check run history.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_history_recent(request, env, args=get_request_args(request))

    @route("/{env}/checks/{check}/run", authorize=True)
    def reactapi_route_checks_run(env: str, check: str) -> Response:  # noqa
        """
        Kicks off a run of the given check.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_run(request, env, check=check, args=get_request_arg(request, "args"))

    @route("/{env}/checks-status", authorize=True)
    def reactapi_route_checks_status(env: str) -> Response:  # noqa
        """
        Returns info on currently running/queueued checks.
        """
        return app.core.reactapi_checks_status(app.current_request.to_dict(), env)

    @route("/{env}/checks-raw", authorize=True)
    def reactapi_route_checks_raw(env: str) -> Response:  # noqa
        """
        Returns the contents of the raw check_setup.json file.
        """
        return app.core.reactapi_checks_raw(app.current_request.to_dict(), env)

    @route("/{env}/checks-registry", authorize=True)
    def reactapi_route_checks_registry(env: str) -> Response:  # noqa
        """
        Returns detailed registered checks functions.
        """
        return app.core.reactapi_checks_registry(app.current_request.to_dict(), env)

    @route("/{env}/lambdas", authorize=True)
    def reactapi_route_lambdas(env: str) -> Response:  # noqa
        """
        Returns detailed info on defined lambdas.
        """
        return app.core.reactapi_lambdas(app.current_request.to_dict(), env)

    @route("/{env}/gac/{env_compare}", authorize=True)
    def reactapi_route_gac_compare(env: str, env_compare: str) -> Response:  # noqa
        """
        Compares and returns diffs for values in the given two GACs.
        """
        return app.core.reactapi_gac_compare(app.current_request.to_dict(), env, env_compare=env_compare)

    @route("/{env}/aws/s3/buckets", authorize=True)
    def reactapi_route_aws_s3_buckets(env: str) -> Response:  # noqa
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets(app.current_request.to_dict(), env)

    @route("/{env}/aws/s3/buckets/{bucket}", authorize=True)
    def reactapi_route_aws_s3_buckets_keys(env: str, bucket: str) -> Response:  # noqa
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_keys(app.current_request.to_dict(), env, bucket=bucket)

    @route("/{env}/aws/s3/buckets/{bucket}/{key}", authorize=True)
    def reactapi_route_aws_s3_buckets_key_contents(env: str, bucket: str, key: str) -> Response:  # noqa
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_key_contents(app.current_request.to_dict(), env, bucket=bucket, key=key)

    @route("/accounts", authorize=True)
    def reactapi_route_accounts() -> Response:  # noqa
        """
        Returns info on known accounts/environments as defined in an accounts.json file if present.
        """
        return app.core.reactapi_accounts(app.current_request.to_dict())

    @route("/accounts/{name}", authorize=True)
    def reactapi_route_account(name: str) -> Response:  # noqa
        """
        Returns info on known accounts/environments as defined in an accounts.json file if present..
        """
        return app.core.reactapi_account(app.current_request.to_dict(), name)

    @route("/__reloadlambda__", authorize=True)
    def reactapi_route_reload_lambda() -> Response:  # noqa
        """
        For troubleshooting only. Reload the lambda code.
        """
        return app.core.reactapi_reload_lambda(app.current_request.to_dict())

    @route("/__clearcache__", authorize=True)
    def reactapi_route_clear_cache() -> Response:  # noqa
        """
        For troubleshooting only. Clear any/all internal caches.
        """
        return app.core.reactapi_clear_cache(app.current_request.to_dict())

    @route("/__testsize__/{n}", authorize=True)
    def reactapi_route_testsize(n: int) -> Response:  # noqa
        """
        For troubleshooting only. Test response size capabilities of AWS Lamdas.
        """
        return app.core.reactapi_testsize(n)

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes, serving the HTML/CSS/JavaScript/React files.
    # Note that ALL of these are UNPROTECTED routes.
    # ----------------------------------------------------------------------------------------------

    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.

    @route(root=True)
    def reactui_route_root() -> Response:  # noqa
        return route_root()

    @route("/", static=True, authorize=False)
    def reactui_route_static_file_noenv() -> Response:  # noqa
        return app.core.react_serve_static_file(app.core.get_default_env(), [])

    @route("/{env}", static=True, authorize=False)
    def reactui_route_0(env) -> Response:  # noqa
        return app.core.react_serve_static_file(env, [])

    @route("/{env}/{path1}", static=True, authorize=False)
    def reactui_route_1(env, path1) -> Response:  # noqa
        return app.core.react_serve_static_file(env, [path1])

    @route("/{env}/{path1}/{path2}", static=True, authorize=False)
    def reactui_route_2(env, path1, path2) -> Response:  # noqa
        return app.core.react_serve_static_file(env, [path1, path2])

    @route("/{env}/{path1}/{path2}/{path3}", static=True, authorize=False)
    def reactui_route_3(env, path1, path2, path3) -> Response:  # noqa
        return app.core.react_serve_static_file(env, [path1, path2, path3])

    @route("/{env}/{path1}/{path2}/{path3}/{path4}", static=True, authorize=False)
    def reactui_route_4(env, path1, path2, path3, path4) -> Response:  # noqa
        return app.core.react_serve_static_file(env, [path1, path2, path3, path4])

    @route("/{env}/{path1}/{path2}/{path3}/{path4}/{path5}", static=True, authorize=False)
    def reactui_route_5(env, path1, path2, path3, path4, path5) -> Response:  # noqa
        return app.core.react_serve_static_file(env, [path1, path2, path3, path4, path5])
