from chalice import CORSConfig
from functools import wraps
from typing import Tuple
import urllib.parse
from ...app import app
from ...route_prefixes import *

# Set CORS to True if CHALICE_LOCAL; not needed if running React from Foursight
# directly, on the same port (e.g. 8000), but useful if/when running React on a
# separate port (e.g. 3000) via npm start in foursight-core/react to facilitate
# easy/quick development/changes directly to React UI code.
if ROUTE_CHALICE_LOCAL:
    # Very specific/tricky requirements for running Foursight React UI/API
    # in CORS mode (i.e. UI on localhost:3000 and API on localhost:8000).
    # The allow_origin must be exact (i.e. no "*" allowed), and the
    # allow_credentials must be True. On the client-side (React UI)
    # we must include 'credentials: "include"' in the fetch.
    CORS = CORSConfig(
        allow_origin="http://localhost:3000",  # Need this to be explicit not "*"
        allow_credentials=True  # Need this
    )
else:
    CORS = False

HTTP_UNAUTHENTICATED = 401
HTTP_UNAUTHORIZED = 403

def route(*args, **kwargs):
    """
    Decorator that wraps the Chalice app.route and our route_requires_authorization decorator;
    as well as setting up CORS for the route if necessary, and tweaking the path appropriately. 
    """
    if not isinstance(args, Tuple) or len(args) == 0:
        raise Exception("No arguments found for route configuration!")

    path = args[0]
    route_prefix = ROUTE_PREFIX + ("/" if not ROUTE_PREFIX.endswith("/") else "")
    if "static" in kwargs:
        route_prefix = route_prefix + "react"
        del kwargs["static"]
    else:
        route_prefix = route_prefix + "reactapi"
    path = route_prefix + path
    if path.endswith("/"):
        path = path[:-1]

    if "authorize" in kwargs:
        authorize = kwargs["authorize"]
        authorize = isinstance(authorize, bool) and authorize
        del kwargs["authorize"]
    else:
        authorize = False

    def route_registration(wrapped_route_function):
        def route_function(*args, **kwargs):
            if authorize:
                return route_requires_authorization(wrapped_route_function)(*args, **kwargs)
            return wrapped_route_function(*args, **kwargs)
        if CORS:
            kwargs["cors"] = CORS
        app.route(path, **kwargs)(route_function)
        return route_function
    return route_registration

def route_requires_authorization(f):
    """
    Decorator for Chalice routes which should be PROTECTED by an AUTHORIZATION check.
    This ASSUMES that the FIRST argument to the route function using this decorator
    is the ENVIRONMENT name. The Chalice request is gotten from app.current_request.

    If the request is NOT authorized/authenticated then a forbidden (HTTP 403 or 401)
    response is returned, otherwise we go ahead with the function/route invocation.
    A request is authorized iff it is AUTHENTICATED, i.e. the user has successfully
    logged in, AND also has PERMISSION to access the specified environment. If the
    request is not authorized an HTTP 401 is returned; if the request is authenticated
    but is not authorized (for the specified environment) and HTTP 403 is returned.

    The info to determine this is pass via the authtoken cookie, which is a (server-side)
    JWT-signed-encode value containing authentication info and list allowed environment
    for the user; this value/cookie is set server-side at login time.

    Note that ONLY three React API routes should NOT be authorization protected by this decorator:
      -> /{env}/auth0_config
      -> /{env}/header
      -> /{env}/logout

    """
    def wrapper(*args, **kwargs):
        if not kwargs or len(kwargs) < 1:
            raise Exception("Invalid arguments to requires_authorization decorator!")
        env = kwargs["env"]
        request = app.current_request.to_dict()
        authorize_response = app.core.react_authorize(request, env)
        if not authorize_response or not authorize_response["authorized"]:
            # HTTP 401 - Unauthorized (more precisely: Unauthenticated):
            # Request has no or invalid credentials.
            # HTTP 403 - Forbidden (more precisely: Unauthorized):
            # Request has valid credentials but no privileges for resource.
            http_status = HTTP_UNAUTHENTICATED if not authorize_response["authenticated"] else HTTP_UNAUTHORIZED
            return app.core.create_response(http_status=http_status, body=authorize_response)
            return response
        return f(*args, **kwargs)
    return wrapper


class ReactRoutes:

    def __init__(self):
        super(ReactRoutes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/header", methods=["GET"], cors=CORS)
    @route("/{env}/header", methods=["GET"])
    def reactapi_route_header(env: str):
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/header", methods=["GET"], cors=CORS)
    @route("/header", methods=["GET"])
    def reactapi_route_header_noenv():
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=app.core.get_default_env())

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/logout", methods=["GET"], cors=CORS)
    @route("/{env}/logout", methods=["GET"])
    def reactapi_route_logout(env: str):
        # Note NON-PROTECTED route. But send back message if already logged out.
        # Note that env is not strictly required for logout,
        # since we logout from all environments, but is useful
        # for the redirect back, and just for completeness.
        request = app.current_request.to_dict()
        return app.core.reactapi_logout(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/info", cors=CORS)
#   @route_requires_authorization
    @route("/{env}/info", methods=["GET"], authorize=True)
    def reactapi_route_info(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_info(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/users", cors=CORS)
#   @route_requires_authorization
    @route("/{env}/users", methods=["GET"], authorize=True)
    def reactapi_route_users(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_users(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/users/{email}", cors=CORS)
#   @route_requires_authorization
    @route("/{env}/users/{email}", methods=["GET"], authorize=True)
    def reactapi_route_users_user(env: str, email: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_get_user(request=request, env=env, email=email)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks", methods=["GET"], authorize=True)
    def reactapi_route_checks(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks/{check}", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks/{check}", methods=["GET"], authorize=True)
    def reactapi_route_check_results(env: str, check: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_check_results(request=request, env=env, check=check)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks/{check}/{uuid}", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks/{check}/{uuid}", methods=["GET"], authorize=True)
    def reactapi_route_check_result(env: str, check: str, uuid: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_check_result(request=request, env=env, check=check, uuid=uuid)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks/{check}/history", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks/{check}/history", methods=["GET"], authorize=True)
    def reactapi_route_checks_history(env: str, check: str):
        request = app.current_request.to_dict()
        params = request.get("query_params")
        offset = int(params.get("offset", "0")) if params else 0
        limit = int(params.get("limit", "25")) if params else 25
        sort = params.get("sort", "timestamp.desc") if params else "timestamp.desc"
        sort = urllib.parse.unquote(sort)
        return app.core.reactapi_checks_history(request=request, env=env,
                                                check=check, offset=offset, limit=limit, sort=sort)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks/{check}/run", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks/{check}/run", methods=["GET"], authorize=True)
    def reactapi_route_checks_run(env: str, check: str):
        request = app.current_request.to_dict()
        args = request.get("query_params", {})
        args = args.get("args")
        return app.core.reactapi_checks_run(request=request, env=env, check=check, args=args)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks-status", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks-status", methods=["GET"], authorize=True)
    def reactapi_route_checks_status(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_status(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks-raw", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks-raw", methods=["GET"], authorize=True)
    def reactapi_route_checks_raw(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_raw(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/checks-registry", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/checks-registry", methods=["GET"], authorize=True)
    def reactapi_route_checks_registry(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_registry(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/lambdas", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/lambdas", methods=["GET"], authorize=True)
    def reactapi_route_lambdas(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_lambdas(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/gac/{environ_compare}", cors=CORS)
#   @route_requires_authorization
    @route("/{env}/gac/{environ_compare}", authorize=True)
    def reactapi_route_gac_compare(env: str, environ_compare: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_gac_compare(request=request, env=env, env_compare=environ_compare)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/aws/s3/buckets", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/aws/s3/buckets", methods=["GET"], authorize=True)
    def reactapi_route_aws_s3_buckets(env: str):
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/aws/s3/buckets/{bucket}", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/aws/s3/buckets/{bucket}", methods=["GET"], authorize=True)
    def reactapi_route_aws_s3_buckets_keys(env: str, bucket: str):
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets_keys(request=request, env=env, bucket=bucket)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/aws/s3/buckets/{bucket}/{key}", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/aws/s3/buckets/{bucket}/{key}", methods=["GET"], authorize=True)
    def reactapi_route_aws_s3_buckets_key_contents(env: str, bucket: str, key: str):
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets_key_contents(request=request, env=env, bucket=bucket, key=key)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/auth0_config", methods=["GET"], cors=CORS)
    @route("/{env}/auth0_config", methods=["GET"])
    def reactapi_route_auth0_config(env):
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_auth0_config(request=request, env=env)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/auth0_config", methods=["GET"], cors=CORS)
    @route("/auth0_config", methods=["GET"])
    def reactapi_route_auth0_config_noenv():
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_auth0_config(request=request, env=app.core.get_default_env())

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/{env}/__reloadlambda__", methods=["GET"], cors=CORS)
#   @route_requires_authorization
    @route("/{env}/__reloadlambda__", methods=["GET"], authorize=True)
    def reactapi_route_reload_lambda(env: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_reload_lambda(request=request, env=env, lambda_name="default")

    @staticmethod
#   @app.route(ROUTE_PREFIX + "reactapi/__clearcache__", cors=CORS)
#   @route_requires_authorization
    @route("/__clearcache__", authorize=True)
    def reactapi_route_clear_cache(env: str):  # Not yet implemented
        request = app.current_request.to_dict()
        return app.core.reactapi_clear_cache(request=request, env=env)

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes.
    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    def reactui_serve_static_file(env: str, paths: list):
        return app.core.react_serve_static_file(env=env, paths=paths)

    @staticmethod
#   @app.route(ROUTE_PREFIX + "react")
    @route("/", static=True)
    def reactui_route_static_file_noenv():
        return ReactRoutes.reactui_serve_static_file(env=app.core.get_default_env(), paths=[])

    @staticmethod
#   @app.route(ROUTE_PREFIX + "react/{env}")
#   @route(ROUTE_PREFIX + "react/{env}")
    @route("/{env}", static=True)
    def reactui_route_0(env):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[])

    @staticmethod
#   @app.route(ROUTE_PREFIX + "react/{env}/{path1}")
    @route("/{env}/{path1}", static=True)
    def reactui_route_1(env, path1):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1])

    @staticmethod
#   @app.route(ROUTE_PREFIX + "react/{env}/{path1}/{path2}")
    @route("/{env}/{path1}/{path2}", static=True)
    def reactui_route_2(env, path1, path2):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1, path2])

    @staticmethod
#   @app.route(ROUTE_PREFIX + "react/{env}/{path1}/{path2}/{path3}")
    @route("/{env}/{path1}/{path2}/{path3}", static=True)
    def reactui_route_3(env, path1, path2, path3):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1, path2, path3])

    @staticmethod
#   @app.route(ROUTE_PREFIX + "react/{env}/{path1}/{path2}/{path3}/{path4}")
    @route("/{env}/{path1}/{path2}/{path3}/{path4}", static=True)
    def reactui_route_4(env, path1, path2, path3, path4):
        return ReactRoutes.reactui_serve_static_file(env=env, paths=[path1, path2, path3, path4])
