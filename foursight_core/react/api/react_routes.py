from chalice import CORSConfig
import urllib.parse
from ...app import app
from ...route_prefixes import *


# Set CORS to True if CHALICE_LOCAL; not needed if running React (nascent support of which
# is experimental and under development in distinct branch) from Foursight directly, on the same
# port (e.g. 8000), but useful if/when running React on a separate port (e.g. 3000) via npm start
# in foursight-core/react to facilitate easy/quick development/changes directly to React code.
if ROUTE_CHALICE_LOCAL:
    # Very specific requirements for running Foursight React UI/API
    # in CORS mode (i.e. UI on localhost:3000 and API on localhost:8000).
    # The allow_origin must be exact (i.e. no "*" allowed), and the
    # allow_credentials must be True. On the caller/client (React UI)
    # side we must include 'credentials: "include"' in the fetch.
    CORS = CORSConfig(
        allow_origin='http://localhost:3000', # need this to be explicit not '*'
        allow_credentials=True, # need this
    )
else:
    CORS = False


def route_requires_authorization(f):
    """
    Decorator for Chalice routes which should be PROTECTED by an AUTHORIZATION check.
    This ASSUMES that the FIRST argument to the route function using this decorator
    is the ENVIRONMENT name. The Chalice request is gotten from app.current_request.

    If the request is NOT authorized then a forbidden (HTTP 403) response is returned,
    otherwise we go ahead with the function/route invocation. A request is authorized
    iff the user is AUTHENTICATED, i.e. has successfully logged in, AND also have
    PERMISSION to access the specified environment. The info to determine this is
    pass via the authtoken cookie, which is a (server-side) JWT-signed-encode value
    containing authentication info and list allowed environment for the user; this
    value/cookie is set server-side at login time.

    Note that ONLY two React API routes should NOT be authorization protected by
    this decorator: the /{environ}/header and the /{environ}/logout endpoints/routes.
    """
    def wrapper(*args, **kwargs):
        if not kwargs or len(kwargs) < 1:
            raise Exception("Invalid arguments to requires_authorization decorator!")
        env = kwargs["environ"]
        request = app.current_request
        authorize_response = app.core.authorize(request, env)
        if not authorize_response or not authorize_response["authorized"]:
            return app.core.forbidden_response(authorize_response)
        return f(*args, **kwargs)
    return wrapper


class ReactRoutes:

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes.
    # ----------------------------------------------------------------------------------------------

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/users', cors=CORS)
    @route_requires_authorization
    def reactapi_route_users(environ):
        return app.core.reactapi_route_users(request=app.current_request, environ=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/users/{email}', cors=CORS)
    @route_requires_authorization
    def reactpi_route_users_user(environ, email):
        return app.core.reactapi_route_users_user(request=app.current_request, environ=environ, email=email)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/info', cors=CORS)
    @route_requires_authorization
    def reactapi_route_info(environ):
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app.core.get_domain_and_context(request_dict)
        return app.core.reactapi_route_info(request=request, environ=environ, domain=domain, context=context)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/header', methods=["GET"], cors=CORS)
    def reactapi_route_header(environ):
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app.core.get_domain_and_context(request_dict)
        return app.core.reactapi_route_header(request=request, env=environ, domain=domain, context=context)

    @app.route(ROUTE_PREFIX + 'reactapi/__clearcache__', cors=CORS)
    @route_requires_authorization
    def reactapi_route_clear_cache(environ): # not yet implemented
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app.core.get_domain_and_context(request_dict)
        return app.core.reactapi_route_clear_cache(request=request, env=environ, domain=domain, context=context)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/gac/{environ_compare}', cors=CORS)
    @route_requires_authorization
    def reactapi_route_gac_compare(environ, environ_compare):
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app.core.get_domain_and_context(request_dict)
        return app.core.reactapi_route_gac_compare(request=request, environ=environ, environ_compare=environ_compare, domain=domain, context=context)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/__reloadlambda__', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_reload_lambda(environ):
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        return app.core.reactapi_route_reload_lambda(request=app.current_request, environ=environ, lambda_name='default', domain=domain, context=context)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks-raw', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_raw(environ: str):
        return app.core.reactapi_route_checks_raw(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks-registry', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_registry(environ: str):
        return app.core.reactapi_route_checks_registry(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks(environ: str):
        return app.core.reactapi_route_checks(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_check_results(environ: str, check: str):
        return app.core.reactapi_route_check_results(request=app.current_request, env=environ, check=check)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}/{uuid}', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_check_result(environ: str, check: str, uuid: str):
        return app.core.reactapi_route_check_result(request=app.current_request, env=environ, check=check, uuid=uuid)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}/history', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_history(environ: str, check: str):
        params = app.current_request.to_dict().get("query_params")
        offset = int(params.get("offset", "0")) if params else 0
        limit = int(params.get("limit", "25")) if params else 25
        sort = params.get("sort", "timestamp.desc") if params else "timestamp.desc"
        sort = urllib.parse.unquote(sort)
        return app.core.reactapi_route_checks_history(request=app.current_request, env=environ, check=check, offset=offset, limit=limit, sort=sort)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}/run', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_run(environ: str, check: str):
        args = app.current_request.to_dict().get('query_params', {})
        args = args.get('args')
        return app.core.reactapi_route_checks_run(request=app.current_request, env=environ, check=check, args=args)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks-status', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_checks_status(environ: str):
        return app.core.reactapi_route_checks_status(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/lambdas', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_lambdas(environ: str):
        return app.core.reactapi_route_lambdas(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/aws/s3/buckets', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_aws_s3_buckets(environ: str):
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        return app.core.reactapi_route_aws_s3_buckets(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/aws/s3/buckets/{bucket}', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_aws_s3_buckets_keys(environ: str, bucket: str):
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_route_aws_s3_buckets_keys(request=app.current_request, env=environ, bucket=bucket)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/aws/s3/buckets/{bucket}/{key}', methods=['GET'], cors=CORS)
    @route_requires_authorization
    def reactapi_route_aws_s3_buckets_key_contents(environ: str, bucket: str, key: str):
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_route_aws_s3_buckets_key_contents(request=app.current_request, env=environ, bucket=bucket, key=key)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/logout', methods=['GET'], cors=CORS)
    def reactapi_route_logout(environ):
        #
        # The environ on strictly required for logout (as we logout from all envs) but useful for redirect back.
        #
        return app.core.reactapi_route_logout(request=app.current_request, environ=environ)

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes.
    # TODO: See if there is a better way to deal with variadic paths.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    def reactui_serve_static_file(environ, **kwargs):
        return app.core.react_serve_static_file(environ, **kwargs)

    @app.route(ROUTE_PREFIX + 'react', cors=CORS)
    def reactui_route_static_file_noenv():
        return ReactRoutes.reactui_serve_static_file(app.core.get_default_env(), **{})

    @app.route(ROUTE_PREFIX + 'react/{environ}', cors=CORS)
    def reactui_route_0(environ):
        return ReactRoutes.reactui_serve_static_file(environ, **{})

    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}', cors=CORS)
    def reactui_route_1(environ, path1):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1})

    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}/{path2}', cors=CORS)
    def reactui_route_2(environ, path1, path2):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1, "path2": path2})

    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}/{path2}/{path3}', cors=CORS)
    def reactui_route_3(environ, path1, path2, path3):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1, "path2": path2, "path3": path3})

    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}/{path2}/{path3}/{path4}', cors=CORS)
    def reactui_route_4(environ, path1, path2, path3, path4):
        return ReactRoutes.reactui_serve_static_file(environ, **{"path1": path1, "path2": path2, "path3": path3, "path4": path4})