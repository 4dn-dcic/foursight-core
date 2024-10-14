# AWS Cognito authentication support functions.

# from cryptography.hazmat.backends.openssl.rsa import _RSAPublicKey as RSAPublicKey
# The above import no longer works with cryptography version 43.0.1; only used for type hint.
RSAPublicKey = object 
import jwt as jwtlib
from jwt import PyJWKClient
import requests
import os
from typing import Tuple
from typing_extensions import TypedDict
from dcicutils.common import REGION as AWS_REGION
from dcicutils.function_cache_decorator import function_cache
from foursight_core.react.api.encoding_utils import base64_encode
from foursight_core.react.api.envs import Envs
from foursight_core.react.api.gac import Gac
from foursight_core.react.api.jwt_utils import jwt_encode
from foursight_core.react.api.misc_utils import get_request_domain, get_request_origin


AWS_COGNITO_SERVICE_BASE_URL = f"https://cognito-idp.{AWS_REGION}.amazonaws.com"

KEY_REGION = "region"
KEY_DOMAIN = "domain"
KEY_USER_POOL_ID = "userpool"
KEY_CLIENT_ID = "client"
KEY_SCOPES = "scope"
KEY_CONNECTIONS = "connections"
KEY_CONFIG_URL = "config"
KEY_CALLBACK_URL = "callback"


class CognitoConfig(TypedDict):
    region: str
    domain: str
    userpool: str
    client: str
    scope: list
    connections: list
    config: str
    callback: str


def get_cognito_oauth_config(request: dict) -> CognitoConfig:
    """
    Returns all necessary configuration info for our AWS Cognito authentication server.
    Retrieved via (first) either environment variables or (second) via AWS Secrets Manager.
    :param request: Dictionary with HTTP request an backend API call (e.g. /api/reactapi/cognito_config).
    :returns: Dictionary with AWS Cognito configuration info.
    """
    config = _get_cognito_oauth_config_basic()
    #
    # We make this set-able via environment variable because it can be useful for running locally
    # in "cross-origin mode", where the React UI is running on its own on localhost:3000 (via npm)
    # and the Foursight app is running locally on localhost:8000, so that live React code updates can
    # be made and seen immediately on localhost:3000. In this case we set FOURSIGHT_COGNITO_CALLBACK
    # to localhost:3000, rather than to what the default would have been, localhost:8000.
    #
    config[KEY_CALLBACK_URL] = os.environ.get("FOURSIGHT_COGNITO_CALLBACK",
                                              f"{get_request_origin(request)}/api/react/cognito/callback")
    return config


@function_cache
def _get_cognito_oauth_config_basic() -> CognitoConfig:
    """
    Returns basic configuration info for our AWS Cognito authentication server.
    Retrieved via either environment variables of AWS Secrets Manager.
    :returns: Dictionary with basic AWS Cognito configuration info.
    """
    # This is separated from get_cognito_oauth_config just so we can cache these most commonly used
    domain = os.environ.get("FOURSIGHT_COGNITO_DOMAIN")
    if not domain:
        domain = Gac.get_secret_value("COGNITO_DOMAIN")
    user_pool_id = os.environ.get("FOURSIGHT_COGNITO_USER_POOL_ID")
    if not user_pool_id:
        user_pool_id = Gac.get_secret_value("COGNITO_USER_POOL_ID")
    client_id = os.environ.get("FOURSIGHT_COGNITO_CLIENT_ID")
    if not client_id:
        client_id = Gac.get_secret_value("COGNITO_CLIENT_ID")
    return { # noqa: TypedDict 'CognitoConfig' has missing keys et cetera - using KEY_XYZ constants
        KEY_REGION: AWS_REGION,
        KEY_DOMAIN: domain,
        KEY_USER_POOL_ID: user_pool_id,
        KEY_CLIENT_ID: client_id,
        KEY_SCOPES: ["openid", "email", "profile"],
        KEY_CONNECTIONS: ["Google"],
        KEY_CONFIG_URL: f"{AWS_COGNITO_SERVICE_BASE_URL}/{user_pool_id}/.well-known/openid-configuration",
        KEY_CALLBACK_URL: ""
    }


@function_cache
def _get_cognito_oauth_config_client_secret() -> str:
    """
    Returns the Cognito user pool client secret value.
    Note not returned by get_cognito_oauth_config and used only internally to this module.
    :returns: Cognito user pool client secret value.
    """
    client_secret = os.environ.get("FOURSIGHT_COGNITO_CLIENT_SECRET")
    if not client_secret:
        client_secret = Gac.get_secret_value("COGNITO_CLIENT_SECRET")
    return client_secret


def handle_cognito_oauth_callback(request: dict, envs: Envs, site: str,
                                  authtoken_audience: str, authtoken_secret: str) -> dict:
    """
    Called (ultimately) from react_routes for endpoint: GET /cognito/callback
    This is actually called from our primary frontend (React) callback /api/react/cognito/callback
    which is redirected to from Cognito so it can pick up the ouath_pkce_key (sic) which is written
    to browser session storage by the React authentication kickoff code (Amplify.federatedSignIn).
    That value (ouath_pkce_key) is passed to this API as the code_verifier argument, along with the
    code argument which is passed to our primary callback. FYI note known typo in ouath_pkce_key.
    Returns encoded authtoken and expires time suitable for cookie-ing the user on successful login.

    Note that for now at least we use the Auth0 audience (aka client ID) and secret to JWT encode the
    authtoken (for cookie-ing the user on successful login), for straightforward compatibilty with
    existing Auth0 code. I.e. once we've done the initial (login) authentication/authorization we
    act exactly like (as-if) previously implemented Auth0 based authentication.

    :param request: Dictionary with HTTP request for the Cognito authentication callback.
    :param envs: Envs object used to get environment and user info for authorization.
    :param site: Site name (foursight-cgap or foursight-fourfront) used in authtoken.
    :param authtoken_audience: Audience (aka client ID) with which to encode our authtoken JWT.
    :param authtoken_secret: Secret (aka client secret) with which to encode our authtoken JWT.
    :returns: Dictionary with authtoken and expires time which (React) caller will cookie user with.
    """
    # Retrieve (via /oauth2/token) and decode the OAuth (JWT) token, given code/code_verifier arguments.
    token = _retrieve_cognito_oauth_token(request)
    # Create our authtoken (to cookie user) based on the retrieved token.
    authtoken, expires = _create_cognito_authtoken(token, envs, get_request_domain(request), site)
    # Encode our authtoken using the given (Auth0 actually) audience (aka client ID) and secret.
    authtoken_encoded = jwt_encode(authtoken, audience=authtoken_audience, secret=authtoken_secret)
    return {"authtoken": authtoken_encoded, "expires": expires}


def _retrieve_cognito_oauth_token(request: dict) -> dict:
    """
    Calls the /oauth2/token endpoint with the code (and other relevant data from the given
    request, e.g. code_verifier) to retrieve the associated JWT token (id_token) and returns
    its decoded value. See: _call_cognito_oauth_token_endpoint for details on request arguments.

    Cognito configuration dependencies: domain, client ID, client secret.
    Cognito endpoint dependencies: Token i.e. /oauth2/token, JWKS i.e. /.well-known/jwks.json.
    Request arguments: code, code_verifier, state, oauth_state

    This is called from our backend authentication callback (i.e. /api/callback) which itself
    is redirected to from our frontend authentication callback (i.e. /api/react/oauth/callback).
    This is split into two pieces (a frontend and backend part) because we need the frontend
    callback to pick up the PKCE (Proof Key for Code Exchange) value (aka code_verifier) from
    browser local storage (which was written at the start of the authentication process, i.e.
    by Amplify.federatedSignIn), which obviously can only be done by frontend code; and the
    backend is needed to make the /oauth2/token (POST) call to the (Cognito) authentication
    server because it needs to pass to that call the (Cognito) client secret, which obviously
    must be done by backend code so as to not expose this secret outside of that secured context.

    https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-proof-key-for-code-exchange-pkce

    :param request: Dictionary with HTTP request for our Cognito authentication callback.
    :returns: Dictionary with decoded JWT token (id_token) from Cognito /oauth2/token endpoint call.
    """
    response = _call_cognito_oauth_token_endpoint(request)
    #
    # Note that we also get back from the /oauth2/token call above (in addition to the "id_token" JWT,
    # which we use) an "access_token" and a "refresh_token"; we do not currently use these; and trying
    # to decode the access_token gives us (unless we disable signature verification) an error because
    # there is no "aud" field there, and trying to decode the refresh_token gives us an invalid payload
    # padding error for some as yet unknown reason, but no matter for now as we don't use these.
    #
    # Note that we also get back from the /oauth2/token call above an "expires_in" (e.g. 3600, for an
    # hour from "now") but the JWT (id_token) also contains a "exp" field (a time_t value) which is
    # effectively the same thing; we will just use the latter (see: _create_cognito_authtoken).
    #
    token = response.get("id_token")
    decoded_token = _decode_cognito_oauth_token_jwt(token)
    return decoded_token


def _call_cognito_oauth_token_endpoint(request: dict) -> dict:
    """
    Calls the Cognito /oauth2/token endpoint to exchange an authorization code for a (JWT) token.
    This authorization "code" is an argument within the given request; this code, also along with
    a "state", was passed to our authentication callback from Cognito. This request also contains
    a "code_verifier" argument, which came from "ouath_pkce_key" (sic) which was stored in browser
    local storage by our client-side authentication initiation code (i.e. Amplify.federatedSignIn),
    together with "oauth_state" which should match the request state argument.

    Cognito configuration dependencies: domain, client ID, client secret.
    Cognito endpoint dependencies: Token i.e. /oauth2/token, JWKS i.e. /.well-known/jwks.json.
    Request arguments: code, code_verifier, state, oauth_state

    :param request: Dictionary with HTTP request for our Cognito authentication callback.
    :returns: Dictionary with HTTP response for Cognito /oauth2/token endpoint (POST) call.
    """
    args = request.get("query_params") or {}
    code = args.get("code")
    #
    # Note the odd/known misspelling of "ouath_pkce_key" browser local storage variable.
    # This, and the above "oauth_state", is set by the client-side code which initiated the
    # authentication process, i.e. e.g. Amplify.federatedSignIn. This is the "code_verifier"
    # which we pass as an argument, along with the given code, to the /oauth2/token endpoint.
    #
    code_verifier = args.get("code_verifier")
    data = _get_cognito_oauth_token_endpoint_data(request, code=code, code_verifier=code_verifier)
    #
    # Note that for the /oauth2/token endpoint call we need EITHER this authorization
    # header, containing the authentication server client secret, OR we need to pass
    # the client secret to the endpoint witin the (POST) data; so BOTH are NOT
    # required; but it is OK to pass both; but we just pass it in the header.
    #
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {_get_cognito_oauth_token_endpoint_authorization()}"
    }
    url = _get_cognito_oauth_token_endpoint_url()
    cognito_auth_token_response = requests.post(url, headers=headers, data=data)
    if cognito_auth_token_response.status_code != 200:
        raise Exception("Invalid response from /oauth2/token")
    cognito_auth_token_response_json = cognito_auth_token_response.json()
    return cognito_auth_token_response_json


def _get_cognito_oauth_token_endpoint_url() -> str:
    """
    Returns the URL for the POST to the Cognito /oauth2/token endpoint.
    Cognito configuration dependencies: domain.
    :returns: URL for Cognito /oauth2/token endpoint.
    """
    config = _get_cognito_oauth_config_basic()
    domain = config[KEY_DOMAIN]
    return f"https://{domain}/oauth2/token"


def _get_cognito_oauth_token_endpoint_authorization() -> str:
    """
    Returns the value for basic authorization value suitable
    for the header of a POST to the Cognito /oauth2/token endpoint.
    Cognito configuration dependencies: client ID, client secret.
    :returns: Authorization header value for Cognito /oauth2/token endpoint.
    """
    config = _get_cognito_oauth_config_basic()
    client_id = config[KEY_CLIENT_ID]
    client_secret = _get_cognito_oauth_config_client_secret()
    return base64_encode(f"{client_id}:{client_secret}")


def _get_cognito_oauth_token_endpoint_data(request: dict, code: str, code_verifier: str) -> dict:
    """
    Returns the data (dictionary) suitable as the payload for a POST to the /oauth2/token
    endpoint, given an authorization code and associated code_verifier passed to our
    our authentication callback.

    Cognito configuration dependencies: client ID, our authentication callback URL.

    :param code: Value passed from Cognito to our backend authentication callback.
    :param code_verifier: Value passed from Cognito to our backend authentication callback.
    :returns: Data suitable for POST payload for Cognito /oauth2/token endpoint.
    """
    config = get_cognito_oauth_config(request)
    client_id = config[KEY_CLIENT_ID]
    callback = config[KEY_CALLBACK_URL]
    return {
        "grant_type": "authorization_code",
        "client_id": client_id,
        #
        # Note that we do NOT pass the client secret here as we are passing
        # it in the header to the /oauth2/token endpoint (POST) call.
        # See: _get_cognito_oauth_token_endpoint_authorization.
        #
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": callback
    }


def _decode_cognito_oauth_token_jwt(jwt: str, verify_signature: bool = True, verify_expiration = True) -> dict:
    """
    Decodes and returns the dictionary for the given JWT (which is assumed to have been returned
    by the Cognito /auth2/token endpoint). To do this we use the signing key within the given JWT
    which we extract using info from the Cognito authentication server JWKA (JSON Web Key Sets) API.

    Note that this is different than how we decode the JWT for Auth0 (from its /oauth/token
    endpoint) which just uses the Auth0 client ID (aka aud) and associated secret.

    Also note that, as alluded to, this JWT is the one returned by the Cognito /oauth2/token endpoint.
    We create/use our own (entirely different) JWT which we use to cookie the user on successful login;
    this one is signed and encoded using the normal client ID (aka aud) and secret mechanism (i.e. not
    a signing key); and we use this same strategy for both Auth0 and Cognito; i.e once a user is
    authenticated via Cognito, the authentication/authorization flow is the same for Cognito and Auth0.

    Cognito configuration dependencies: user pool ID, client ID.
    Cognito endpoint dependencies: JWKS endpoint .../.well-known/jwks.json.

    :param jwt: JWT token value (id_token) retrieved from the /oauth2/token endpoint.
    :param verify_signature: Boolean (default True) indicating JWT signature verification.
    :param verify_expiration: Boolean (default True) indicating JWT expiration verification.
    :returns: Dictionary with decoded value of given JWT.
    """
    #
    # Example decoded (id_tokn) JWT:
    # {
    #     "at_hash": "C9sA39psH6zoRKXuLfQVGw",
    #     "sub": "7dca9b92-746b-4406-9f7d-3e58cd7b247f",
    #     "cognito:groups": [
    #         "us-east-1_h6I5IqQSs_Google"
    #     ],
    #     "email_verified": false,
    #     "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_h6I5IqQSs",
    #     "cognito:username": "google_117300206013007398924",
    #     "given_name": "David",
    #     "nonce": "Mm9KTFynPpG7J64FA9XxTBYnjmve5S0qjXPLQmGRE-ET-CETERA",
    #     "origin_jti": "04ee7dcf-a2ca-4df5-8790-604456609d69",
    #     "aud": "5d586se3r976435167nk8k8s4h",
    #     "identities": [
    #         {
    #             "userId": "117300206013007398924",
    #             "providerName": "Google",
    #             "providerType": "Google",
    #             "issuer": null,
    #             "primary": "true",
    #             "dateCreated": "1673913190125"
    #         }
    #     ],
    #     "token_use": "id",
    #     "auth_time": 1673913192,
    #     "exp": 1673916792,
    #     "iat": 1673913192,
    #     "family_name": "Michaels",
    #     "jti": "c2061278-c0cd-4bf6-ad77-1ffaeed2f626",
    #     "email": "david_michaels@hms.harvard.edu"
    # }
    #
    config = _get_cognito_oauth_config_basic()
    client_id = config[KEY_CLIENT_ID]
    signing_key = _get_cognito_oauth_signing_key(jwt)
    options = {
        "verify_signature": verify_signature,
        "verify_exp": verify_expiration
    }
    return jwtlib.decode(jwt, signing_key, audience=client_id, algorithms=["RS256"], options=options)


def _get_cognito_oauth_signing_key(jwt: str) -> RSAPublicKey:
    """
    Returns the signing key (object) from the given JWT.
    This is used to verify and decode the JWT (see: _decode_cognito_oauth_token_jwt).
    Actual type of returned object: cryptography.hazmat.backends.openssl.rsa._RSAPublicKey.

    Cognito configuration dependencies: user pool ID.
    Cognito endpoint dependencies: JWKS i.e. /.well-known/jwks.json.

    :param jwt: JWT token value (id_token) retrieved from the /oauth2/token endpoint.
    :returns: Object suitable for use as a signing key to decode a JWT.
    """
    signing_key_client = _get_cognito_oauth_signing_key_client()
    signing_key = signing_key_client.get_signing_key_from_jwt(jwt)
    return signing_key.key


def _get_cognito_oauth_signing_key_client() -> PyJWKClient:
    """
    Returns an object which can be used to extract a signing key from a JWT.
    The returned object will contain a "get_signing_key_from_jwt" method, which takes
    JWT string argument and returns a signing key object which has a "key" property.
    Hits the jwks.json (JSON Web Key Sets) API for the Cognito authentication server.
    Actual type of returned object: jwt.jwks_client.PyJWKClient

    Cognito configuration dependencies: user pool ID.
    Cognito endpoint dependencies: JWKS i.e. /.well-known/jwks.json.

    :returns: Object suitable for extracting a signing key from a JWT.
    """
    config = _get_cognito_oauth_config_basic()
    user_pool_id = config[KEY_USER_POOL_ID]
    cognito_jwks_url = f"{AWS_COGNITO_SERVICE_BASE_URL}/{user_pool_id}/.well-known/jwks.json"
    return PyJWKClient(cognito_jwks_url)


def _create_cognito_authtoken(token: dict, envs: Envs, domain: str, site: str) -> Tuple[dict, int]:
    """
    Creates from the given (decoded) JWT token, retrieved from the /oauth2/token endpoint, an
    authtoken suitable for use as a cookie to indicate the user has been authenticated (logged in).
    This is analagous to foursight_core.react.api.auth.create_authtoken used for Auth0 authentication.

    :param token: Decoded JWT token from the /oauth2/token endpoint.
    :param envs: An Envs object (from react_api_base.ReactApiBase).
    :param domain: Domain name of this instance of the application (i.e. Foursight server itself).
    :param site: Either foursight-cgap or foursignt-fourfront as appropriate.
    :returns: JWT-encoded "authtoken" dictionary suitable for cookie-ing the authenticated user.
    """
    email = token.get("email")
    default_env = envs.get_default_env()
    known_envs = envs.get_known_envs()
    allowed_envs, first_name, last_name = envs.get_user_auth_info(email)
    expires = token.get("exp")
    authtoken = {
        "authentication": "cognito",
        "authenticator": "google",  # TODO: get from identities
        "authenticated_at": token.get("iat"),
        "authenticated_until": expires,
        "authenticated": True,
        "user": email,
        "user_verified": token.get("email_verified"),
        "first_name": token.get("given_name") or first_name,
        "last_name": token.get("family_name") or last_name,
        "allowed_envs": allowed_envs,
        "known_envs": known_envs,
        "default_env": default_env,
        "domain": domain,
        "site": site
    }
    return authtoken, expires
