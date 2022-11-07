# This module defines a "route" decorator that wraps the Chalice route decorator,
# and does authorization (and authentication) checking, tweaks the path appropriately,
# sets up CORS if necessary (only for local development), and has common exception handling.
# We DEFAULT to AUTHORIZATION checking; if not wanted use authorize=False in route decorator.

from chalice import CORSConfig, Response
import logging
from typing import Optional, Tuple
from dcicutils.misc_utils import get_error_message
from ...app import app
from ...route_prefixes import ROUTE_CHALICE_LOCAL, ROUTE_PREFIX

REACT_API_PATH_COMPONENT = "reactapi"
REACT_UI_PATH_COMPONENT = "react"

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

logging.basicConfig()
logger = logging.getLogger(__name__)


def route(*args, **kwargs):
    """
    Decorator to wrap the Chalice route decorator to do authentication and authorization
    checking; tweaks the envpoing path appropriately (for API and static files); sets up
    CORS if necessary (for local development); and handles exceptions. Usage looks like this:

      @route("/{env}/info", authorize=True)
      def reactapi_route_info(env: str) -> Response:
          return do_route_processing_and_return_response()

    Note that functions decorated with this are (if class members) implicitly STATIC methods.
    """
    if not isinstance(args, Tuple) or len(args) == 0:
        raise Exception("No arguments found for route configuration!")

    path = args[0]
    route_prefix = ROUTE_PREFIX + ("/" if not ROUTE_PREFIX.endswith("/") else "")
    if "static" in kwargs:
        # This is for serving static files which live in a different/specific directory.
        route_prefix = route_prefix + REACT_UI_PATH_COMPONENT
        del kwargs["static"]
    else:
        route_prefix = route_prefix + REACT_API_PATH_COMPONENT
    path = route_prefix + path
    if path.endswith("/"):
        path = path[:-1]

    if "authorize" in kwargs:
        authorize = kwargs["authorize"]
        authorize = isinstance(authorize, bool) and authorize
        del kwargs["authorize"]
    else:
        # Note we DEFAULT to AUTHORIZE for the route!
        # Only way to turn it off is to explicitly pass authorize=False to the route decorator.
        authorize = True

    if "methods" not in kwargs:
        if "method" in kwargs:
            # Allow singular method kwarg in addition to Chalice methods kwarg.
            kwargs["methods"] = [kwargs["method"]]
            del kwargs["method"]
        else:
            # If no methods given then default to GET.
            kwargs["methods"] = ["GET"]
    elif "method" in kwargs:
        del kwargs["method"]

    def route_registration(wrapped_route_function):
        """
        This function is called once for each defined route/endpoint (at app startup).
        """
        def route_function(*args, **kwargs):
            """
            This is the function called on each actual route/endpoint (API) call.
            """
            try:
                if authorize:
                    # Note that the "env" argument in the kwargs is the environment name from the endpoint
                    # path; this does NOT have to be present in the endpoint path, BUT if it IS then it
                    # MUST be exactly named "env", otherwise we won't properly do per-env authorization.
                    unauthorized_response = _authorize(app.current_request.to_dict(), kwargs.get("env"))
                    if unauthorized_response:
                        return unauthorized_response
                # Here we are authenticated and authorized and so we call the actual route function.
                return wrapped_route_function(*args, **kwargs)
            except Exception as e:
                # Common endpoint exception handling here.
                logger.error(f"Exception in route: {get_error_message(e)}")
                return app.core.create_error_response(e)
        if _CORS:
            # Only used for (cross-origin) localhost development (e.g. UI on 3000 and API on 8000).
            kwargs["cors"] = _CORS
        # This is the call that actually registers the Chalice route/endpoint.
        return app.route(path, **kwargs)(route_function)
    return route_registration


def _authorize(request: dict, env: Optional[str]) -> Optional[Response]:
    """
    If the given request is UNAUTHORIZED (or UNAUTHENTICATED) then returns
    an appropriate unauthorized (or unauthenticated) response, otherwise None;
    i.e. a return of None means all is well, fully authenticated and authorized.
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
