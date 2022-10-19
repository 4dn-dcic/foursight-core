import boto3
import logging
import requests
import time
from typing import Optional
from dcicutils.misc_utils import get_error_message

logging.basicConfig()
logger = logging.getLogger(__name__)


# Class to encapsulate Auth0 configuration parameters,
# e.g. from: https://cgap-mgb.hms.harvard.edu/auth0_config?format=json
#        or: https://data.4dnucleome.org/auth0_config?format=json
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
class Auth0Config:

    # Fallback values only because at least currently (2022-10-18) this is only returning auth0Client:
    # http://cgap-supertest-1972715139.us-east-1.elb.amazonaws.com/auth0_config?format=json
    FALLBACK_VALUES = {
        "domain": "hms-dbmi.auth0.com",
        "client": "DPxEwsZRnKDpk0VfVAxrStRKukN14ILB",
        "sso": False,
        "scope": "openid email",
        "prompt": "select_account",
        "connections": [ "github", "google-oauth2" ]
    }

    def __init__(self, portal_url: str) -> None:
        if not portal_url:
            raise ValueError("URL required for Auth0Config usage.")
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
        return {
            "domain": domain or Auth0Config.FALLBACK_VALUES["domain"],
            "client": client or Auth0Config.FALLBACK_VALUES["client"],
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

    def refresh(self) -> None:
        """
        Clears out the caches, so next call to get_config_data() and get_config_raw_data() get fresh data.
        """
        self._config_data = self._config_raw_data = {}

    def get_domain(self) -> Optional[str]:
        return self.get_config_data().get("domain")

    def get_client(self) -> Optional[str]:
        return self.get_config_data().get("client")

    def get_sso(self) -> Optional[str]:
        return self.get_config_data().get("sso")

    def get_scope(self) -> Optional[str]:
        return self.get_config_data().get("scope")

    def get_prompt(self) -> Optional[str]:
        return self.get_config_data().get("prompt")

    def get_connections(self) -> Optional[str]:
        return self.get_config_data().get("connections")


class Auth0ConfigPerEnv:

    def __init__(self) -> None:
        self._per_env_data = {}

    def define_auth0_config(self, env: str, portal_url: str) -> Auth0Config:
        if not env:
            raise ValueError("Invalid environment argument to Auth0ConfigPerEnv.")
        per_env_data = self._per_env_data.get(env)
        if not per_env_data:
            self._per_env_data[env] = Auth0Config(portal_url)
        return self._per_env_data[env]

    def get_portal_url(self, env: str) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_portal_url() if per_env_data else None

    def get_config_url(self, env: str) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_config_url() if per_env_data else None

    def get_config_data(self, env: str) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_config_data() if per_env_data else None

    def get_config_raw_data(self, env: str) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_config_raw_data() if per_env_data else None

    def get_config_raw_data(self, env: str) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_config_raw_data() if per_env_data else None

    def refresh(self) -> None:
        for per_env_data in self._per_env_data:
            per_env_data.refresh()
        self._per_env_data = {}

    def get_domain(self) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_domain() if per_env_data else None

    def get_client(self) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_client() if per_env_data else None

    def get_sso(self) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_sso() if per_env_data else None

    def get_scope(self) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_scope() if per_env_data else None

    def get_prompt(self) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_prompt() if per_env_data else None

    def get_connections(self) -> Optional[str]:
        per_env_data = self._per_env_data.get(env)
        return per_env_data.get_connections() if per_env_data else None

