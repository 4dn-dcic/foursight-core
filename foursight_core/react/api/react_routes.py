from chalice import Response
from dcicutils.misc_utils import ignored
import json
from ...app import app
from .misc_utils import get_request_body
from .react_route_decorator import route


class ReactRoutes:

    def __init__(self):
        super(ReactRoutes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    @route("/{env}/auth0_config", authorize=False)
    def reactapi_route_auth0_config(env) -> Response:
        ignored(env)
        """
        Note that this in an UNPROTECTED route.
        Returns the Auth0 configuration info required for login.
        """
        return app.core.reactapi_auth0_config(app.current_request.to_dict())

    @staticmethod
    @route("/auth0_config", authorize=False)
    def reactapi_route_auth0_config_noenv() -> Response:
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/auth0_config route.
        """
        return app.core.reactapi_auth0_config(app.current_request.to_dict(), app.core.get_default_env())

    @staticmethod
    @route("/{env}/logout", authorize=False)
    def reactapi_route_logout(env: str) -> Response:
        """
        Note that this in an UNPROTECTED route.
        Logs out the user. Sends back specific message if already logged out, or not.
        The env is not strictly required for logout, since we logout from all environments,
        but it is is useful for the redirect back, and also just for consistency/completeness.
        """
        return app.core.reactapi_logout(app.current_request.to_dict(), env)

    @staticmethod
    @route("/logout", authorize=False)
    def reactapi_route_logout_noenv() -> Response:
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/logout route.
        """
        return app.core.reactapi_logout(app.current_request.to_dict(), app.core.get_default_env())

    @staticmethod
    @route("/{env}/header", authorize=False)
    def reactapi_route_header(env: str) -> Response:
        """
        Note that this in an UNPROTECTED route.
        Returns minimal data for React UI to get up and running.
        """
        return app.core.reactapi_header(app.current_request.to_dict(), env)

    @staticmethod
    @route("/header", authorize=False)
    def reactapi_route_header_noenv() -> Response:
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/header route.
        """
        return app.core.reactapi_header(app.current_request.to_dict(), app.core.get_default_env())

    @staticmethod
    @route("/{env}/info", authorize=True)
    def reactapi_route_info(env: str) -> Response:
        """
        Returns various/sundry info about the app.
        """
        return app.core.reactapi_info(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/users", authorize=True)
    def reactapi_route_users(env: str) -> Response:
        """
        Returns the list of all defined users (TODO: not yet paged).
        """
        return app.core.reactapi_users(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/users/{email}", authorize=True)
    def reactapi_route_get_user(env: str, email: str) -> Response:
        """
        Returns detailed info for the given user (email).
        """
        return app.core.reactapi_get_user(app.current_request.to_dict(), env, email=email)

    # Looks like PUT, PATCH, and DELETE are not supported, at least in chalice local mode,
    # still; complaints about this from 2016; says fixed but another complaint from June 2021.
    #
    # https://github.com/aws/chalice/issues/167
    # https://github.com/aws/chalice/pull/173
    #
    # So evidently not a priority to fix and too much of a pain to maintain separate
    # endpoints for chalice local and normal operation so making all of these POSTs,
    # with different (create, update, delete) endpoint paths.

    @staticmethod
    @route("/{env}/users/create", method="POST", authorize=True)
    def reactapi_route_post_user(env: str) -> Response:
        """
        Creates a new user described by the given data.
        """
        user = get_request_body(app.current_request)
        return app.core.reactapi_post_user(app.current_request.to_dict(), env, user=user)

    @staticmethod
    @route("/{env}/users/update/{uuid}", method="POST", authorize=True)
    def reactapi_route_patch_user(env: str, uuid: str) -> Response:
        """
        Updates the user identified by the given uuid with the given data.
        """
        user = get_request_body(app.current_request)
        return app.core.reactapi_patch_user(app.current_request.to_dict(), env, uuid=uuid, user=user)

    @staticmethod
    @route("/{env}/users/delete/{uuid}", method="POST", authorize=True)
    def reactapi_route_patch_user(env: str, uuid: str) -> Response:
        """
        Deletes the user identified by the given uuid.
        """
        return app.core.reactapi_delete_user(app.current_request.to_dict(), env, uuid=uuid)

    @staticmethod
    @route("/{env}/checks", authorize=True)
    def reactapi_route_checks(env: str) -> Response:
        """
        Returns detailed info on all defined checks.
        """
        return app.core.reactapi_checks(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/checks/{check}", authorize=True)
    def reactapi_route_check_results(env: str, check: str) -> Response:
        """
        Returns the most result of the most recent run for the given check.
        """
        return app.core.reactapi_check_results(app.current_request.to_dict(), env, check=check)

    @staticmethod
    @route("/{env}/checks/{check}/{uuid}", authorize=True)
    def reactapi_route_check_result(env: str, check: str, uuid: str) -> Response:
        """
        Returns the result of the given check.
        """
        return app.core.reactapi_check_result(app.current_request.to_dict(), env, check=check, uuid=uuid)

    @staticmethod
    @route("/{env}/checks/{check}/history", authorize=True)
    def reactapi_route_checks_history(env: str, check: str) -> Response:
        """
        Returns detailed info on the run histories of the given check (paged).
        """
        request = app.current_request.to_dict()
        args = request.get("query_params")
        return app.core.reactapi_checks_history(request, env, check=check, args=args)

    @staticmethod
    @route("/{env}/checks/{check}/run", authorize=True)
    def reactapi_route_checks_run(env: str, check: str) -> Response:
        """
        Kicks off a run of the given check.
        """
        request = app.current_request.to_dict()
        args = request.get("query_params", {})
        args = args.get("args")
        return app.core.reactapi_checks_run(request, env, check=check, args=args)

    @staticmethod
    @route("/{env}/checks-status", authorize=True)
    def reactapi_route_checks_status(env: str) -> Response:
        """
        Returns info on currently running/queueued checks.
        """
        return app.core.reactapi_checks_status(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/checks-raw", authorize=True)
    def reactapi_route_checks_raw(env: str) -> Response:
        """
        Returns the contents of the raw check_setup.json file.
        """
        return app.core.reactapi_checks_raw(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/checks-registry", authorize=True)
    def reactapi_route_checks_registry(env: str) -> Response:
        """
        Returns detailed registered checks functions.
        """
        return app.core.reactapi_checks_registry(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/lambdas", authorize=True)
    def reactapi_route_lambdas(env: str) -> Response:
        """
        Returns detailed info on defined lambdas.
        """
        return app.core.reactapi_lambdas(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/gac/{env_compare}", authorize=True)
    def reactapi_route_gac_compare(env: str, env_compare: str) -> Response:
        """
        Compares and returns diffs for values in the given two GACs.
        """
        return app.core.reactapi_gac_compare(app.current_request.to_dict(), env, env_compare=env_compare)

    @staticmethod
    @route("/{env}/aws/s3/buckets", authorize=True)
    def reactapi_route_aws_s3_buckets(env: str) -> Response:
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets(app.current_request.to_dict(), env)

    @staticmethod
    @route("/{env}/aws/s3/buckets/{bucket}", authorize=True)
    def reactapi_route_aws_s3_buckets_keys(env: str, bucket: str) -> Response:
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_keys(app.current_request.to_dict(), env, bucket=bucket)

    @staticmethod
    @route("/{env}/aws/s3/buckets/{bucket}/{key}", authorize=True)
    def reactapi_route_aws_s3_buckets_key_contents(env: str, bucket: str, key: str) -> Response:
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_key_contents(app.current_request.to_dict(), env, bucket=bucket, key=key)

    @staticmethod
    @route("/__reloadlambda__", authorize=True)
    def reactapi_route_reload_lambda() -> Response:
        """
        For troubleshooting only. Reload the lambda code.
        """
        return app.core.reactapi_reload_lambda(app.current_request.to_dict())

    @staticmethod
    @route("/__clearcache__", authorize=True)
    def reactapi_route_clear_cache() -> Response:
        """
        For troubleshooting only. Clear any/all internal caches.
        """
        return app.core.reactapi_clear_cache(app.current_request.to_dict())

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes.
    # Note that ALL of these are UNPROTECTED routes.
    # ----------------------------------------------------------------------------------------------

    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.

    @staticmethod
    @route("/", static=True, authorize=False)
    def reactui_route_static_file_noenv() -> Response:
        return app.core.react_serve_static_file(app.core.get_default_env(), [])

    @staticmethod
    @route("/{env}", static=True, authorize=False)
    def reactui_route_0(env) -> Response:
        return app.core.react_serve_static_file(env, [])

    @staticmethod
    @route("/{env}/{path1}", static=True, authorize=False)
    def reactui_route_1(env, path1) -> Response:
        return app.core.react_serve_static_file(env, [path1])

    @staticmethod
    @route("/{env}/{path1}/{path2}", static=True, authorize=False)
    def reactui_route_2(env, path1, path2) -> Response:
        return app.core.react_serve_static_file(env, [path1, path2])

    @staticmethod
    @route("/{env}/{path1}/{path2}/{path3}", static=True, authorize=False)
    def reactui_route_3(env, path1, path2, path3) -> Response:
        return app.core.react_serve_static_file(env, [path1, path2, path3])

    @staticmethod
    @route("/{env}/{path1}/{path2}/{path3}/{path4}", static=True, authorize=False)
    def reactui_route_4(env, path1, path2, path3, path4) -> Response:
        return app.core.react_serve_static_file(env, [path1, path2, path3, path4])
