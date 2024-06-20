from chalice import Response
import copy
import datetime
import json
import os
import requests
from typing import Optional, Union
import urllib.parse
from dcicutils.misc_utils import get_error_message
from dcicutils.redis_tools import RedisSessionToken, SESSION_TOKEN_COOKIE
from ...app import app
from ...route_prefixes import ROUTE_PREFIX
from .auth import Auth, AUTH_TOKEN_COOKIE
from .auth0_config import Auth0Config
from .cookie_utils import create_set_cookie_string, read_cookie
from .datetime_utils import convert_datetime_to_time_t
from .envs import Envs
from .misc_utils import (
    get_request_arg,
    is_running_locally,
)


class ReactApiBase:

    CONTENT_TYPE = "Content-Type"
    JSON_CONTENT_TYPE = "application/json"
    STANDARD_HEADERS = {CONTENT_TYPE: JSON_CONTENT_TYPE}

    def __init__(self):
        super(ReactApiBase, self).__init__()
        self._envs = Envs(app.core.get_unique_annotated_environment_names())
        self._auth0_config = self.resolve_auth0_config()
        self._auth = Auth(self._auth0_config.get_client(), self._auth0_config.get_secret(), self._envs)

    def resolve_auth0_config(self):
        """ For mocking, this calls into EnvUtils which gives us trouble in unit testing """
        return Auth0Config(app.core.get_portal_url(self._envs.get_default_env()))

    @staticmethod
    def create_response(http_status: int = 200,
                        body: Optional[Union[dict, list]] = None,
                        headers: dict = None,
                        content_type: str = JSON_CONTENT_TYPE) -> Response:
        if body is None:  # unsupplied argument
            # Check specifically for None as given body could be empty LIST which we want to keep.
            body = {}
        if not headers:
            headers = ReactApiBase.STANDARD_HEADERS
        if content_type:
            if id(headers) == id(ReactApiBase.STANDARD_HEADERS):
                headers = {**headers}
            headers[ReactApiBase.CONTENT_TYPE] = content_type
        return Response(status_code=http_status, body=body, headers=headers)

    @staticmethod
    def create_success_response(body: Optional[Union[dict, list]] = None, content_type: str = None) -> Response:
        if body is None:  # unsupplied argument
            # Check specifically for None as given body could be empty LIST which we want to keep.
            body = {}
        if not content_type:
            content_type = ReactApiBase.JSON_CONTENT_TYPE
        return ReactApiBase.create_response(http_status=200, body=body, content_type=content_type)

    @staticmethod
    def create_redirect_response(location: str, body: dict = None, headers: dict = None) -> Response:
        if not body:
            # Check specifically for None as given body could be empty LIST which we want to keep.
            body = {}
        if not headers:
            if not location:
                raise Exception("No location specified for HTTP redirect.")
            headers = {"Location": location}
        elif location:
            headers = copy.deepcopy(headers)
            headers["Location"] = location
        elif "location" not in [key.lower() for key in headers.keys()]:
            raise Exception("No location specified in header for HTTP redirect.")
        return ReactApiBase.create_response(http_status=302, body=body, headers=headers)

    @staticmethod
    def create_not_implemented_response(request: dict) -> Response:
        method = request.get("method")
        context = request.get("context")
        path = context.get("path") if isinstance(context, dict) else None
        body = {"error": "Not implemented.", "method": method, "path": path}
        return ReactApiBase.create_response(http_status=501, body=body)

    @staticmethod
    def create_forbidden_response() -> Response:
        """
        Note that this is different from the unauthenticated and/or unauthorized response
        if the user is not logged in or does not have access to the given environment.
        This is for other forbidden cases, e.g. access to static files we restrict
        access to, or a failed login/authentication attempt.
        """
        return ReactApiBase.create_response(http_status=403, body={"status": "Forbidden."})

    @staticmethod
    def create_error_response(message: Union[dict, str, Exception]) -> Response:
        if isinstance(message, Exception):
            # Treat an Exception object like the error message string associated with that Exception.
            body = {"error": get_error_message(message)}
        elif isinstance(message, str):
            body = {"error": message}
        elif isinstance(message, dict):
            body = message
        else:
            raise ValueError(f"The message argument must be a dict, str, or Exception: {message!r}")
        return ReactApiBase.create_response(http_status=500, body=body)

    @staticmethod
    def is_react_authentication_callback(request: dict) -> bool:
        """
        Returns True iff the given Auth0 authentication/login callback request, i.e. from
        the /callback route which is defined in the main routes.py for both React and non-React
        Auth0 authentication/login, is for a React authentication/login. This is communicated
        via a "react" URL parameter in the callback URL, which is setup on the React UI side.

        This was PREVIOUSLY done there via a "react" string in Auth0 "scope" and gotten from the Auth0
        POST result, but changed so that we can get the domain for the Auth0 POST URL from our Auth0Config.

        See: react/src/pages/LoginPage.js/createAuth0Lock
        See: foursight_core/src/react/api/auth0_config.py/get_callback_url
        """
        return get_request_arg(request, "react") is not None

    def react_authentication_callback(self, request: dict, env: str) -> Response:
        """
        Called by the main authentication callback function (app_utils.auth0_callback)
        if the above is_react_authentication_callback returns True. Performs the actual
        Auth0 authentication for login via the Auth0 (HTTP POST) API. If successful,
        returns a redirect response (to the UI) with a cookie setting for the login
        authtoken. If unsuccessful, returns a forbidden (HTTP 403) response.
        """

        auth0_code = get_request_arg(request, "code")
        auth0_domain = self._auth0_config.get_domain()
        auth0_client = self._auth0_config.get_client()
        auth0_secret = self._auth0_config.get_secret()
        if not (auth0_code and auth0_domain and auth0_client and auth0_secret):
            return self.create_forbidden_response()

        # Not actually sure what this auth0_redirect_uri is needed
        # for, but needed it does seem to be, for this Auth0 POST;
        # it evidently needs to be (this) authentication callback URL.
        auth0_redirect_uri = self._auth0_config.get_callback_url(request)
        auth0_payload = {
            'grant_type': 'authorization_code',
            'client_id': auth0_client,
            'client_secret': auth0_secret,
            'code': auth0_code,
            'redirect_uri': auth0_redirect_uri
        }
        auth0_post_url = f"https://{auth0_domain}/oauth/token"

        auth0_payload_json = json.dumps(auth0_payload)
        auth0_headers = self.STANDARD_HEADERS
        auth0_response = requests.post(auth0_post_url, data=auth0_payload_json, headers=auth0_headers)
        auth0_response_json = auth0_response.json()
        jwt = auth0_response_json.get("id_token")

        if not jwt:
            return self.create_forbidden_response()

        jwt_expires_in = auth0_response_json.get("expires_in")
        jwt_expires_at = convert_datetime_to_time_t(datetime.datetime.utcnow() +
                                                    datetime.timedelta(seconds=jwt_expires_in))
        domain, context = app.core.get_domain_and_context(request)
        authtoken, email = self._auth.create_authtoken(jwt, jwt_expires_at, domain, request=request)
        authtoken_cookie = create_set_cookie_string(request, name=AUTH_TOKEN_COOKIE,
                                                    value=authtoken,
                                                    domain=domain,
                                                    expires=jwt_expires_at, http_only=False)

        # if Redis is in use, create and return session token as well
        redis_handler = self._auth.get_redis_handler()
        if redis_handler:
            redis_session_token = RedisSessionToken(
                namespace=Auth.get_redis_namespace(env), jwt=jwt, email=email
            )
            redis_session_token.store_session_token(redis_handler=redis_handler)
            c4_st_cookie = create_set_cookie_string(request, name=SESSION_TOKEN_COOKIE,
                                                    value=redis_session_token.get_session_token(),
                                                    domain=domain,
                                                    expires=str(datetime.datetime.utcnow() +
                                                                redis_session_token.get_expiration()))
            authtoken_cookie = [authtoken_cookie, c4_st_cookie]
        redirect_url = self.get_redirect_url(request, env, domain, context)
        return self.create_redirect_response(location=redirect_url, headers={"Set-Cookie": authtoken_cookie})

    def react_authorize(self, request: dict, env: Optional[str]) -> dict:
        """
        Exposed for call from "route" decorator for endpoint authentication protection.
        """
        return self._auth.authorize(request, env)

    def foursight_instance_url(self, request: dict) -> str:
        """
        Returns the "base" URL of this Foursight instance, for example:
        https://zvalpb2vxb.execute-api.us-east-1.amazonaws.com/api.
        """
        domain, context = app.core.get_domain_and_context(request)
        if is_running_locally(request):
            scheme = "http"
            context = ROUTE_PREFIX
        else:
            scheme = "https"
        if context.endswith("/"):
            context = context[0:-1]
        return f"{scheme}://{domain}{context}"

    def get_redirect_url(self, request: dict, env: str, domain: str, context: str) -> str:
        """
        Returns the redirect URL to the UI from the reactredir cookie, or if that
        is not set then to the /login page of the UI; for redirect on login/logout.
        """
        redirect_url = read_cookie(request, "reactredir")
        if redirect_url:
            # Not certain if by design but the React library (universal-cookie) used to
            # write cookies URL-encodes them; rolling with it for now and URL-decoding here.
            return urllib.parse.unquote(redirect_url)
        else:
            return f"{self.foursight_instance_url(request)}/react/{env}/login"

    def is_foursight_cgap(self) -> bool:
        return app.core.APP_PACKAGE_NAME == "foursight-cgap"

    def is_foursight_fourfront(self) -> bool:
        return app.core.APP_PACKAGE_NAME == "foursight" or app.core.APP_PACKAGE_NAME == "foursight-fourfront"

    def is_foursight_smaht(self) -> bool:
        return app.core.APP_PACKAGE_NAME == "foursight-smaht"

    def get_site_name(self) -> str:
        # FYI known site name (APP_PACKAGE_NAME value) are:
        # - foursight
        # - foursight-cgap
        # - foursight-smaht
        if app.core.APP_PACKAGE_NAME == "foursight":
            # For React, change foursight to foursight-fourfront,
            # just to be more explicit and reduce possible confusion.
            return "foursight-fourfront"
        else:
            return app.core.APP_PACKAGE_NAME

    def get_default_env(self) -> str:
        return self._envs.get_default_env()

    def get_global_env_bucket(self) -> Optional[str]:
        return os.environ.get("GLOBAL_ENV_BUCKET") or os.environ.get("GLOBAL_BUCKET_ENV")
