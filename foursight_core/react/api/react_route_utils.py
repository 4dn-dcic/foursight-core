# This module defines a "route" decorator which wraps the Chalice route decorator,
# and does authorization (and authentication) checking, tweaks the path appropriately,
# sets up CORS if necessary (only for local development), and has common exception handling.
# We DEFAULT to AUTHORIZATION checking; if not wanted use authorize=False in route decorator.

from chalice import CORSConfig, Response
from typing import Optional, Tuple
from ...app import app
from ...route_prefixes import ROUTE_CHALICE_LOCAL, ROUTE_PREFIX

# CORS is need ONLY for local DEVELOPMENT, i.e. when using chalice local!
# Set CORS to True if CHALICE_LOCAL; not needed if running React from Foursight
# directly, on the same port (e.g. 8000), but useful if/when running React on a
# separate port (e.g. 3000) via npm start in foursight-core/react to facilitate
# easy/quick development/changes directly to React UI code.
if ROUTE_CHALICE_LOCAL:
    # Very specific/tricky requirements for running Foursight React UI/API in CORS
    # mode (i.e. UI on localhost:3000 and API on localhost:8000). The allow_origin
    # must be exact (i.e. no "*" allowed), and the allow_credentials must be True.
    # On the client-side (React UI) we must include 'credentials: "include"' in the
    # fetch (if using React fetch, though now we use axios, where we require, in
    # any case, 'withCredentials: "include"').
    _CORS = CORSConfig(
        allow_origin="http://localhost:3000",  # Need this to be explicit not "*"
        allow_credentials=True  # Need this
    )
else:
    _CORS = None

_HTTP_UNAUTHENTICATED = 401
_HTTP_UNAUTHORIZED = 403


def route(*args, **kwargs):
    """
    Decorator to wrap the Chalice route decorator to do our authentication and
    authorization checking; also tweaks the path appropriately; sets up CORS
    if necessary (only for local development); and handles exceptions.
    """
    if not isinstance(args, Tuple) or len(args) == 0:
        raise Exception("No arguments found for route configuration!")

    path = args[0]
    route_prefix = ROUTE_PREFIX + ("/" if not ROUTE_PREFIX.endswith("/") else "")
    if "static" in kwargs:
        # This is for serving static files which live in a different/specific directory.
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
        # Note we DEFAULT to AUTHORIZE!
        # Only way to turn it off is to explicitly pass authorize=False to the route decorator.
        authorize = True

    def route_registration(wrapped_route_function):
        """
        This function is called once for each defined route/endpoint (at app startup).
        """
        def route_function(*args, **kwargs):
            """
            This is the function called on each route/endpoint (API) call.
            """
            try:
                if authorize:
                    # Was calling the _route_requires_authorization decorator; now do it directly.
                    # return _route_requires_authorization(wrapped_route_function)(*args, **kwargs)
                    # Note that we access the env argument in kwargs; ASSUME this name from the route.
                    unauthorized_response = _authorize(app.current_request.to_dict(), kwargs.get("env"))
                    if unauthorized_response:
                        return unauthorized_response
                return wrapped_route_function(*args, **kwargs)
            except Exception as e:
                # Common endpoint exception handling here.
                return app.core.create_error_response(e)
        if _CORS:
            # Only used for cross-origin localhost development (e.g. UI on 3000 and API on 8000).
            kwargs["cors"] = _CORS
        # This is the call that registers the Chalice route/endpoint.
        app.route(path, **kwargs)(route_function)
        return route_function
    return route_registration


def _authorize(request: dict, env: Optional[str]) -> Optional[Response]:
    """
    If the given request is unauthorized (or unauthenticated) then return
    an appropriate unauthorized (or unauthenticated) response, otherwise None.
    """
    authorize_response = app.core.react_authorize(request, env)
    if not authorize_response or not authorize_response["authorized"]:
        # HTTP 401 - Unauthorized (more precisely: Unauthenticated):
        # Request has no or invalid credentials.
        # HTTP 403 - Forbidden (more precisely: Unauthorized):
        # Request has valid credentials but no privileges for resource.
        http_status = _HTTP_UNAUTHENTICATED if not authorize_response["authenticated"] else _HTTP_UNAUTHORIZED
        return app.core.create_response(http_status=http_status, body=authorize_response)
    return None


def _route_requires_authorization(f):
    """
    THIS DECORATOR NOT USED ANYMORE.
    Functionality now wrapped in common route decorator above.

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

    N.B. This was originally used to decorate each route, then created the below "route"
    wrapper which called this. And then changed that (below) "route" wrapper to call
    the function directly (maybe more efficient); so this is actually NO LONGER USED.
    Keeping here just for now just in case.

    """
    def wrapper(*args, **kwargs):
        if not kwargs or len(kwargs) < 1:
            raise Exception("Invalid arguments to requires_authorization decorator!")
        unauthorized_response = _authorize(app.current_request.to_dict(), kwargs.get("env"))
        if unauthorized_response:
            return unauthorized_response
        return f(*args, **kwargs)
    return wrapper
