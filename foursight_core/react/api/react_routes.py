from chalice import CORSConfig
from functools import wraps
from typing import Tuple
import urllib.parse
from ...app import app
from ...route_prefixes import *

import inspect

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

def __xyzzyroute(*args, **kwargs):
    print("route-decorator")
    if args:
        print('have-args')
        print(type(args))
        print(args)
        print(len(args))
        print(args[0])
        if isinstance(args, Tuple):
            print('have-tuple')
            path = args[0]
            print("path = " + str(path) + " (" + str(type(path)) + ")")
    else:
        print('no-args')
    print(kwargs)
    def inner_route(f):
        print('inner_route')
        print(f)
        print(type(f))
        def inner_inner_route(*args, **kwargs):
            print('inner_inner_route')
            return f(**kwargs)
    return inner_route(args[0], **kwargs) if isinstance(args, Tuple) and len(args) > 0 else inner_route

def xyzzyroute(*args, **kwargs):
    print("route-decorator")
    if args:
        print('have-args')
        print(type(args))
        print(args)
        print(len(args))
        print(args[0])
        if isinstance(args, Tuple):
            print('have-tuple')
            path = args[0]
            print("path = " + str(path) + " (" + str(type(path)) + ")")
    else:
        print('no-args')
    print(kwargs)
    if kwargs.get("authorize"):
        print('have-authorize')
        authorize = True
        del kwargs["authorize"]
    else:
        authorize = False
    print(authorize)
    def inner_route(f):
        print("inner_route")
        print(type(f))
        print(f)
        print(args)
        print(kwargs)
        path = args[0]
        def inner_inner_route(*args, **kwargs):
            request = app.current_request.to_dict()
            print('inner_inner_route call!')
            if authorize:
                print('SHOULD-AUTH')
            else:
                print('SHOULD-NOT-AUTH')
            print(type(f))
            print(f)
            print(args)
            print(kwargs)
            print(request)
            auth = route_requires_authorization(f)
            print('inner_inner_route call auth object.')
            print(type(auth))
            print(auth)
            auth_response = auth(*args, **kwargs)
            print('inner_inner_route call auth response.')
            print(auth_response)
            print(auth_response.status_code)
            print(auth_response.headers)
            print(auth_response.body)
            print('inner_inner_route returning auth response.')
            return auth_response
            result = f(**kwargs)
            result.body["inner_inner_route"] = 12345678;
            return result
            #return {"inner_inner_route":123}
        print('XYZZY:REGISTER:ROUTE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        xyzzy = app.route(path, **kwargs)(inner_inner_route)
        print('inner_route: after app.route')
        print(type(xyzzy))
        print(xyzzy)
        return inner_inner_route
    return inner_route
    #return inner_route(args[0]) if isinstance(args, Tuple) and len(args) > 0 else inner_route

def route(*args, **kwargs):
    if isinstance(args, Tuple) and len(args) > 0:
        path = args[0]
    else:
        raise Exception("No arguments found for route configuration!")
    if "authorize" in kwargs:
        authorize = kwargs["authorize"]
        authorize = isinstance(authorize, bool) and authorize
        del kwargs["authorize"]
    else:
        authorize = False
    def route_registration(wrapped_route_function):
        def route_function(*args, **kwargs):
            request = app.current_request.to_dict()
            if authorize:
                authorization_decorator = route_requires_authorization(wrapped_route_function)
                return authorization_decorator(*args, **kwargs)
            return wrapped_route_function(**kwargs)
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
      -> /{environ}/auth0_config
      -> /{environ}/header
      -> /{environ}/logout

    """
    def wrapper(*args, **kwargs):
        if not kwargs or len(kwargs) < 1:
            raise Exception("Invalid arguments to requires_authorization decorator!")
        env = kwargs["environ"]
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
#   @app.route(ROUTE_PREFIX + "reactapi/{environ}/header", methods=["GET"], cors=CORS)
    @route(ROUTE_PREFIX + "reactapi/{environ}/header", authorize=False)
    def reactapi_route_header(environ: str):
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/header", methods=["GET"], cors=CORS)
    def reactapi_route_header_noenv():
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_header(request=request, env=app.core.get_default_env())

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/logout", methods=["GET"], cors=CORS)
    def reactapi_route_logout(environ: str):
        # Note NON-PROTECTED route. But send back message if already logged out.
        # Note that environ is not strictly required for logout,
        # since we logout from all environments, but is useful
        # for the redirect back, and just for completeness.
        request = app.current_request.to_dict()
        return app.core.reactapi_logout(request=request, env=environ)

    @staticmethod
    @route(ROUTE_PREFIX + "reactapi/{environ}/info", authorize=True)
#   @app.route(ROUTE_PREFIX + "reactapi/{environ}/info", cors=CORS)
#   @route_requires_authorization
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
        return app.core.reactapi_get_user(request=request, env=environ, email=email)

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
    @app.route(ROUTE_PREFIX + "reactapi/{environ}/auth0_config", methods=["GET"], cors=CORS)
    def reactapi_route_auth0_config(environ):
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_auth0_config(request=request, env=environ)

    @staticmethod
    @app.route(ROUTE_PREFIX + "reactapi/auth0_config", methods=["GET"], cors=CORS)
    def reactapi_route_auth0_config_noenv():
        # Note NON-PROTECTED route.
        request = app.current_request.to_dict()
        return app.core.reactapi_auth0_config(request=request, env=app.core.get_default_env())

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

    def foo(environ: str):
        return {"afdasdfadfa":"helloxyzzy"}
        pass
    xyzzy = app.route(ROUTE_PREFIX + "reactapi/{environ}/xyzzy", cors=CORS)(foo)

    @staticmethod
    @xyzzyroute(ROUTE_PREFIX + "reactapi/{environ}/xyzzy2", cors=CORS, authorize=True)
    def goo(environ: str):
        print(f"GOO.............................................{environ}")
        return app.core.create_success_response(body={"goo":"hello-goo:" + environ})

#    @xyzzyroute(ROUTE_PREFIX + "reactapi/{environ}/xyzzy", cors=CORS)
#   def reactapi_route_info(environ: str):
#       request = app.current_request.to_dict()
#       return app.core.reactapi_info(request=request, env=environ)

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes.
    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    def reactui_serve_static_file(env: str, paths: list):
        return app.core.react_serve_static_file(env=env, paths=paths)

    @staticmethod
    @app.route(ROUTE_PREFIX + "react")
    def reactui_route_static_file_noenv():
        return ReactRoutes.reactui_serve_static_file(env=app.core.get_default_env(), paths=[])

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}")
    def reactui_route_0(environ):
        return ReactRoutes.reactui_serve_static_file(env=environ, paths=[])

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}")
    def reactui_route_1(environ, path1):
        return ReactRoutes.reactui_serve_static_file(env=environ, paths=[path1])

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}/{path2}")
    def reactui_route_2(environ, path1, path2):
        return ReactRoutes.reactui_serve_static_file(env=environ, paths=[path1, path2])

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}/{path2}/{path3}")
    def reactui_route_3(environ, path1, path2, path3):
        return ReactRoutes.reactui_serve_static_file(env=environ, paths=[path1, path2, path3])

    @staticmethod
    @app.route(ROUTE_PREFIX + "react/{environ}/{path1}/{path2}/{path3}/{path4}")
    def reactui_route_4(environ, path1, path2, path3, path4):
        return ReactRoutes.reactui_serve_static_file(env=environ, paths=[path1, path2, path3, path4])
