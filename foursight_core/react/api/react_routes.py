from urllib.parse import urlparse
from dcicutils.misc_utils import ignored
import json
from ...app import app
from .react_route_utils import route


class ReactRoutes:

    def __init__(self):
        super(ReactRoutes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    @route("/{env}/auth0_config", authorize=False)
    def reactapi_route_auth0_config(env):
        ignored(env)
        """
        Note that this in an UNPROTECTED route.
        Returns the Auth0 configuration info required for login.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_auth0_config(request=request)

    @staticmethod
    @route("/auth0_config", authorize=False)
    def reactapi_route_auth0_config_noenv():
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/auth0_config route.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_auth0_config(request=request, env=app.core.get_default_env())

    @staticmethod
    @route("/{env}/logout", authorize=False)
    def reactapi_route_logout(env: str):
        """
        Note that this in an UNPROTECTED route.
        Logs out the user. Sends back specific message if already logged out, or not.
        The env is not strictly required for logout, since we logout from all environments,
        but it is is useful for the redirect back, and also just for consistency/completeness.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_logout(request=request, env=env)

    @staticmethod
    @route("/logout", authorize=False)
    def reactapi_route_logout_noenv():
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/logout route.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_logout(request=request, env=app.core.get_default_env())

    @staticmethod
    @route("/{env}/header", authorize=False)
    def reactapi_route_header(env: str):
        """
        Note that this in an UNPROTECTED route.
        Returns minimal data for React UI to get up and running.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=env)

    @staticmethod
    @route("/header", authorize=False)
    def reactapi_route_header_noenv():
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/header route.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=app.core.get_default_env())

    @staticmethod
    @route("/{env}/info", authorize=True)
    def reactapi_route_info(env: str):
        """
        Returns various/sundry info about the app.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_info(request=request, env=env)

    @staticmethod
    @route("/{env}/users", authorize=True)
    def reactapi_route_users(env: str):
        """
        Returns the list of all defined users (TODO: not yet paged).
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_users(request=request, env=env)

    @staticmethod
    @route("/{env}/users/{email}", authorize=True)
    def reactapi_route_get_user(env: str, email: str):
        """
        Returns detailed info the given user (email).
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_get_user(request=request, env=env, email=email)

    # XYZZY:NEW

    # Looks like PATCH and DELETE (still) not supported at least in chalice local mode;
    # complaint about this from 2016; says fixed but another complaint from June 2021.
    #
    # https://github.com/aws/chalice/issues/167
    # https://github.com/aws/chalice/pull/173
    #
    # So looks like not a priority to fix and too much of a pain to maintain separate
    # endpoints for chalice local and normal operation so making all of these POSTs
    # with different endpoint paths.

    @staticmethod
    @route("/{env}/users/create", method="POST", authorize=False) # TODO: unauthorized while testing
    def reactapi_route_post_user(env: str):
        """
        Creates a new user described by the given data.
        """
        request = app.current_request.to_dict()
        user = json.loads(app.current_request.raw_body.decode())
        return app.core.reactapi_post_user(request=request, env=env, user=user)

    @staticmethod
    @route("/{env}/users/update/{uuid}", method="POST", authorize=False) # TODO: unauthorized while testing
    def reactapi_route_patch_user(env: str, uuid: str):
        """
        Updates the user identified by the given uuid with the given data.
        """
        request = app.current_request.to_dict()
        user = json.loads(app.current_request.raw_body.decode())
        return app.core.reactapi_patch_user(request=request, env=env, uuid=uuid, user=user)

    @staticmethod
    @route("/{env}/users/delete/{uuid}", method="POST", authorize=False) # TODO: unauthorized while testing
    def reactapi_route_patch_user(env: str, uuid: str):
        """
        Deletes the user identified by the given uuid.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_delete_user(request=request, env=env, uuid=uuid)

    # XYZZY:NEW

    @staticmethod
    @route("/{env}/checks", authorize=True)
    def reactapi_route_checks(env: str):
        """
        Returns detailed info on all defined checks.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks(request=request, env=env)

    @staticmethod
    @route("/{env}/checks/{check}", authorize=True)
    def reactapi_route_check_results(env: str, check: str):
        """
        Returns the most result of the most recent run for the given check.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_check_results(request=request, env=env, check=check)

    @staticmethod
    @route("/{env}/checks/{check}/{uuid}", authorize=True)
    def reactapi_route_check_result(env: str, check: str, uuid: str):
        """
        Returns the result of the given check.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_check_result(request=request, env=env, check=check, uuid=uuid)

    @staticmethod
    @route("/{env}/checks/{check}/history", authorize=True)
    def reactapi_route_checks_history(env: str, check: str):
        """
        Returns detailed info on the run histories of the given check (paged).
        """
        request = app.current_request.to_dict()
        params = request.get("query_params")
        offset = int(params.get("offset", "0")) if params else 0
        limit = int(params.get("limit", "25")) if params else 25
        sort = params.get("sort", "timestamp.desc") if params else "timestamp.desc"
        sort = urlparse.unquote(sort)
        return app.core.reactapi_checks_history(request=request, env=env,
                                                check=check, offset=offset, limit=limit, sort=sort)

    @staticmethod
    @route("/{env}/checks/{check}/run", authorize=True)
    def reactapi_route_checks_run(env: str, check: str):
        """
        Kicks off a run of the given check.
        """
        request = app.current_request.to_dict()
        args = request.get("query_params", {})
        args = args.get("args")
        return app.core.reactapi_checks_run(request=request, env=env, check=check, args=args)

    @staticmethod
    @route("/{env}/checks-status", authorize=True)
    def reactapi_route_checks_status(env: str):
        """
        Returns info on currently running/queueued checks.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_status(request=request, env=env)

    @staticmethod
    @route("/{env}/checks-raw", authorize=True)
    def reactapi_route_checks_raw(env: str):
        """
        Returns the contents of the raw check_setup.json file.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_raw(request=request, env=env)

    @staticmethod
    @route("/{env}/checks-registry", authorize=True)
    def reactapi_route_checks_registry(env: str):
        """
        Returns detailed registered checks functions.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_registry(request=request, env=env)

    @staticmethod
    @route("/{env}/lambdas", authorize=True)
    def reactapi_route_lambdas(env: str):
        """
        Returns detailed info on defined lambdas.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_lambdas(request=request, env=env)

    @staticmethod
    @route("/{env}/gac/{environ_compare}", authorize=True)
    def reactapi_route_gac_compare(env: str, environ_compare: str):
        """
        Compares and returns diffs for values in the given two GACs.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_gac_compare(request=request, env=env, env_compare=environ_compare)

    @staticmethod
    @route("/{env}/aws/s3/buckets", authorize=True)
    def reactapi_route_aws_s3_buckets(env: str):
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets(request=request, env=env)

    @staticmethod
    @route("/{env}/aws/s3/buckets/{bucket}", authorize=True)
    def reactapi_route_aws_s3_buckets_keys(env: str, bucket: str):
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets_keys(request=request, env=env, bucket=bucket)

    @staticmethod
    @route("/{env}/aws/s3/buckets/{bucket}/{key}", authorize=True)
    def reactapi_route_aws_s3_buckets_key_contents(env: str, bucket: str, key: str):
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets_key_contents(request=request, env=env, bucket=bucket, key=key)

    @staticmethod
    @route("/__reloadlambda__", authorize=True)
    def reactapi_route_reload_lambda():
        """
        For troubleshooting only. Reload the lambda code.
        """
        return app.core.reactapi_reload_lambda(request=app.current_request.to_dict())

    @staticmethod
    @route("/__clearcache__", authorize=True)
    def reactapi_route_clear_cache():
        """
        For troubleshooting only. Clear any/all internal caches.
        """
        return app.core.reactapi_clear_cache(request=app.current_request.to_dict())

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes.
    # ----------------------------------------------------------------------------------------------

    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.

    @staticmethod
    def reactui_serve_static_file(env: str, paths: list):
        return app.core.react_serve_static_file(env=env, paths=paths)

    @staticmethod
    @route("/", static=True, authorize=False)
    def reactui_route_static_file_noenv():
        return ReactRoutes.reactui_serve_static_file(env=app.core.get_default_env(), paths=[])

    @staticmethod
    @route("/{env}", static=True, authorize=False)
    def reactui_route_0(env):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[])

    @staticmethod
    @route("/{env}/{path1}", static=True, authorize=False)
    def reactui_route_1(env, path1):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1])

    @staticmethod
    @route("/{env}/{path1}/{path2}", static=True, authorize=False)
    def reactui_route_2(env, path1, path2):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1, path2])

    @staticmethod
    @route("/{env}/{path1}/{path2}/{path3}", static=True, authorize=False)
    def reactui_route_3(env, path1, path2, path3):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1, path2, path3])

    @staticmethod
    @route("/{env}/{path1}/{path2}/{path3}/{path4}", static=True, authorize=False)
    def reactui_route_4(env, path1, path2, path3, path4):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1, path2, path3, path4])
