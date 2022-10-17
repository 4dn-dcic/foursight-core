from chalice import CORSConfig
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

    Note that ONLY two React API routes should NOT be authorization protected by
    this decorator: the /{environ}/header and the /{environ}/logout endpoints/routes.
    """
    def wrapper(*args, **kwargs):
        if not kwargs or len(kwargs) < 1:
            raise Exception("Invalid arguments to requires_authorization decorator!")
        env = kwargs["environ"]
        request = app.current_request.to_dict()
        authorize_response = app.core.react_authorize(request, env)
        if not authorize_response or not authorize_response["authorized"]:
            response = app.core.create_success_response("route_requires_authorization")
            response.body = authorize_response
            # HTTP 401 - Unauthorized (more precisely: Unauthenticated):
            # Request has no or invalid credentials.
            # HTTP 403 - Forbidden (more precisely: Unauthorized):
            # Request has valid credentials but no privileges for resource.
            if not authorize_response["authenticated"]:
                response.status_code = HTTP_UNAUTHENTICATED
            else:
                response.status_code = HTTP_UNAUTHORIZED
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
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/header", methods=["GET"], cors=CORS)
    def reactapi_route_header(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/header", methods=["GET"], cors=CORS)
    def reactapi_route_header_noenv():
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=app.core.get_default_env())

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/logout", methods=["GET"], cors=CORS)
    def reactapi_route_logout(environ: str):
        # Note that environ is not strictly required for logout,
        # since we logout from all environments, but is useful
        # for the redirect back, and just for completeness.
        request = app.current_request.to_dict()
        return app.core.reactapi_logout(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/info", cors=CORS)
    @route_requires_authorization
    def reactapi_route_info(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_info(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/users", cors=CORS)
    @route_requires_authorization
    def reactapi_route_users(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_users(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/users/{email}", cors=CORS)
    @route_requires_authorization
    def reactapi_route_users_user(environ: str, email: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_users_user(request=request, env=environ, email=email)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks/{check}", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_check_results(environ: str, check: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_check_results(request=request, env=environ, check=check)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks/{check}/{uuid}", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_check_result(environ: str, check: str, uuid: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_check_result(request=request, env=environ, check=check, uuid=uuid)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks/{check}/history", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_history(environ: str, check: str):
        request = app.current_request.to_dict()
        params = request.get("query_params")
        offset = int(params.get("offset", "0")) if params else 0
        limit = int(params.get("limit", "25")) if params else 25
        sort = params.get("sort", "timestamp.desc") if params else "timestamp.desc"
        sort = urllib.parse.unquote(sort)
        return app.core.reactapi_checks_history(request=request, env=environ,
                                                check=check, offset=offset, limit=limit, sort=sort)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks/{check}/run", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_run(environ: str, check: str):
        request = app.current_request.to_dict()
        args = request.get("query_params", {})
        args = args.get("args")
        return app.core.reactapi_checks_run(request=request, env=environ, check=check, args=args)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks-status", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_status(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_status(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks-raw", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_raw(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_raw(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/checks-registry", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_registry(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_checks_registry(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/lambdas", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_lambdas(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_lambdas(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/gac/{environ_compare}", cors=CORS)
    @route_requires_authorization
    def reactapi_route_gac_compare(environ: str, environ_compare: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_gac_compare(request=request, env=environ, env_compare=environ_compare)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/aws/s3/buckets", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_aws_s3_buckets(environ: str):
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/aws/s3/buckets/{bucket}", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_aws_s3_buckets_keys(environ: str, bucket: str):
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets_keys(request=request, env=environ, bucket=bucket)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/aws/s3/buckets/{bucket}/{key}", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_aws_s3_buckets_key_contents(environ: str, bucket: str, key: str):
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        request = app.current_request.to_dict()
        return app.core.reactapi_aws_s3_buckets_key_contents(request=request, env=environ, bucket=bucket, key=key)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/__reloadlambda__", methods=["GET"], cors=CORS)
    @route_requires_authorization
    def reactapi_route_reload_lambda(environ: str):
        request = app.current_request.to_dict()
        return app.core.reactapi_reload_lambda(request=request, env=environ, lambda_name="default")

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/__clearcache__", cors=CORS)
    @route_requires_authorization
    def reactapi_route_clear_cache(environ: str):  # Not yet implemented
        request = app.current_request.to_dict()
        return app.core.reactapi_clear_cache(request=request, env=environ)

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes.
    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    def reactui_serve_static_file(environ: str, **kwargs):
        return app.core.react_serve_static_file(env=environ, **kwargs)

    @staticmethod
    @app.route(ROUTE_PREFIX + "react", cors=CORS)
    def reactui_route_static_file_noenv():
        return ReactRoutes.reactui_serve_static_file(app.core.get_default_env(), **{})

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}", cors=CORS)
    def reactui_route_0(environ):
        return ReactRoutes.reactui_serve_static_file(environ, **{})

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}", cors=CORS)
    def reactui_route_1(environ, path1):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1})

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}/{path2}", cors=CORS)
    def reactui_route_2(environ, path1, path2):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1, "path2": path2})

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}/{path2}/{path3}", cors=CORS)
    def reactui_route_3(environ, path1, path2, path3):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1, "path2": path2, "path3": path3})

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}/{path2}/{path3}/{path4}", cors=CORS)
    def reactui_route_4(environ, path1, path2, path3, path4):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1,
                                                                 "path2": path2, "path3": path3, "path4": path4})
