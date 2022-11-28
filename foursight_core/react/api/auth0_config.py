import logging
import os
import requests
from dcicutils.misc_utils import get_error_message
from .misc_utils import get_request_domain, is_running_locally

logging.basicConfig()
logger = logging.getLogger(__name__)


# Class to encapsulate the Auth0 configuration
# parameters from the Portal /auth0_config endpoint,
# e.g. from: https://cgap-mgb.hms.harvard.edu/auth0_config?format=json
#         or: https://data.4dnucleome.org/auth0_config?format=json
#  {
#    "title": "Auth0 Config",
#    "auth0Client": "DPxEwsZRnKDpk0VfVAxrStRKukN14ILB",
#    "auth0Domain": "hms-dbmi.auth0.com",
#    "auth0Options": {
#      "auth": {
#        "sso": false,
#        "redirect": false,
#        "responseType": "token",
#        "params": { "scope": "openid email",
#                    "prompt": "select_account" }
#      },
#      "allowedConnections": [ "github", "google-oauth2", "partners" ]
#    }
#  }
#
# The constructor takes a REQUIRED Portal URL as an argument.
# Use get_config_data() get the relevant Auth0 info in cannocial form;
# it is a dictionary containing these properties:
#
# - domain (e.g. "hms-dbmi.auth0.com")
# - client (e.g. "CQxApsZSnKDpk7VfWMzrTtRKykM14JFC")
# - sso (e.g. False)
# - scope (e.g. "openid email")
# - prompt (e.g. "select_account")
# - connections (e.g. ["github", "google-oauth2"])
#
# Note that these Auth0 configuration parameters are NOT environment specific.
# We ASSUME the same credentials/configuration across all environments for a deployment.
#
class Auth0Config:

    # Fallback values only because at least currently (2022-10-18) this is only returning auth0Client:
    # http://cgap-supertest-1972715139.us-east-1.elb.amazonaws.com/auth0_config?format=json
    # This has been FIXED but leaving this here for now just in case.
    # Note that the secret associated with the Auth0 client is in the GAC (ENCODED_AUTH0_SECRET).
    FALLBACK_VALUES = {
        "domain": "hms-dbmi.auth0.com",
        "client": "DPxEwsZRnKDpk0VfVAxrStRKukN14ILB",
        "sso": False,
        "scope": "openid email",
        "prompt": "select_account",
        "connections": ["github", "google-oauth2"]
    }

    def __init__(self, portal_url: str) -> None:
        if not portal_url:
            raise ValueError("Portal URL required for Auth0Config usage.")
        self._portal_url = portal_url
        self._config_url = f"{portal_url}{'/' if not portal_url.endswith('/') else ''}auth0_config?format=json"
        self._config_data = {}
        self._config_raw_data = {}

    def get_portal_url(self) -> str:
        return self._portal_url

    def get_config_url(self) -> str:
        return self._config_url

    def get_config_data(self) -> dict:
        """
        Returns relevant info (dictionary) from the Auth0 config URL in canonical form.
        It contains these properties: domain, client, sso, scope, prompt, connections.
        This caches its data.
        """
        if not self._config_data:
            self._config_data = self._get_config_data_nocache() or {}
        return self._config_data

    def _get_config_data_nocache(self) -> dict:
        """
        Returns relevant info (dictionary) from the Auth0 config URL in canonical form.
        It contains these properties: domain, client, sso, scope, prompt, connections.
        This does NOT cache its data.
        """
        config_raw_data = self.get_config_raw_data()
        domain = config_raw_data.get("auth0Domain") if config_raw_data else None
        client = config_raw_data.get("auth0Client") if config_raw_data else None
        options = config_raw_data.get("auth0Options") if config_raw_data else None
        options_auth = options.get("auth") if options else None
        options_auth_params = options_auth.get("params") if options_auth else None
        sso = options_auth.get("sso") if options_auth else None
        scope = options_auth_params.get("scope") if options_auth_params else None
        prompt = options_auth_params.get("prompt") if options_auth_params else None
        connections = options.get("allowedConnections") if options else None
        # The Auth0 config may contain "partners" in the allowedConnections,
        # which is something we don't want, as it causes a generic diplay
        # of yours@example.com option to login in the Auth0 (lock) box.
        if connections and "partners" in connections:
            connections.remove("partners")
        return {
            "client": client or Auth0Config.FALLBACK_VALUES["client"],
            "domain": domain or Auth0Config.FALLBACK_VALUES["domain"],
            "sso": sso or Auth0Config.FALLBACK_VALUES["sso"],
            "scope": scope or Auth0Config.FALLBACK_VALUES["scope"],
            "prompt": prompt or Auth0Config.FALLBACK_VALUES["prompt"],
            "connections": connections or Auth0Config.FALLBACK_VALUES["connections"]
        }

    def get_config_raw_data(self) -> dict:
        """
        Returns raw data (dictionary) from the Auth0 config URL.
        This caches its data.
        """
        if not self._config_raw_data:
            self._config_raw_data = self._get_config_raw_data_nocache() or {}
        return self._config_raw_data

    def _get_config_raw_data_nocache(self) -> dict:
        """
        Returns raw data (dictionary) from the Auth0 config URL.
        This does NOT caches its data.
        """
        try:
            return requests.get(self.get_config_url()).json() or {}
        except Exception as e:
            logger.error(f"Exception fetching Auth0 config ({self.get_config_url()}): {get_error_message(e)}")
            return {}

    def get_client(self) -> str:
        return self.get_config_data()["client"]

    def get_domain(self) -> str:
        return self.get_config_data()["domain"]

    @staticmethod
    def get_secret() -> str:
        """
        Returns the Auth0 secret.
        Currently we get this environment variables setup from the GAC; see identity.py.
        """
        return os.environ.get("CLIENT_SECRET", os.environ.get("ENCODED_AUTH0_CLIENT"))

    @staticmethod
    def get_callback_url(request: dict) -> str:
        """
        Returns the URL for our authentication callback endpoint.
        Note this callback endpoint is (still) defined in the legacy Foursight routes.py.
        """
        domain = get_request_domain(request)
        # The context (route prefix) for the Auth0 callback is effectively hardcoded at Auth0.
        # but note different for running locally (localhost) and normal server operation.
        context = "/api/" if not is_running_locally(request) else "/"
        context = "/"
        headers = request.get("headers", {})
        scheme = headers.get("x-forwarded-proto", "http")
        return f"{scheme}://{domain}{context}callback/?react"

    def cache_clear(self) -> None:
        """
        Clears out the caches, so next call to get_config_data() and get_config_raw_data() get fresh data.
        """
        self._config_data = self._config_raw_data = {}
