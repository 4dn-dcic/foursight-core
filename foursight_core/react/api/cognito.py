import jwt as jwtlib
from jwt import PyJWKClient
import requests
import os
from typing import Tuple
from foursight_core.react.api.encoding_utils import base64_encode, string_to_bytes
from foursight_core.react.api.jwt_utils import jwt_encode
from foursight_core.react.api.envs import Envs
from foursight_core.react.api.gac import Gac
from foursight_core.react.api.misc_utils import get_request_origin, memoize


def get_cognito_oauth_config(request: dict) -> dict:
    """
    Returns all necessary configuration info for our AWS Coginito authentication server.
    Retrieved via either environment variables of AWS Secrets Manager.
    :returns: Dictionary containing AWS Cognito configuration info.
    """
    #
    # TODO
    # Could maybe read this from the AWS Cognito configuration directly.
    #
    config = _get_cognito_oauth_config_base()
    config["callback"] = os.environ.get("FOURSIGHT_COGNITO_CALLBACK", f"{get_request_origin(request)}/api/react/cognito/callback")
    return config


@memoize
def _get_cognito_oauth_config_base() -> dict:
    domain = os.environ.get("FOURSIGHT_COGNITO_DOMAIN", Gac.get_secret_value("COGNITO_DOMAIN"))
    user_pool_id = os.environ.get("FOURSIGHT_COGNITO_USER_POOL_ID", Gac.get_secret_value("COGNITO_USER_POOL_ID"))
    client_id = os.environ.get("FOURSIGHT_COGNITO_CLIENT_ID", Gac.get_secret_value("COGNITO_CLIENT_ID"))
    return {
        "region": "us-east-1",
        "domain": domain,
        "user_pool_id": user_pool_id,
        "client_id": client_id,
        "scope": [ "openid", "email", "profile" ],
        "connections": [ "Google" ]
    }


@memoize
def _get_cognito_oauth_config_client_secret() -> dict:
    #
    # This is a temporary test account - no harm in checking in.
    #
    client_secret = os.environ.get("FOURSIGHT_COGNITO_CLIENT_SECRET", Gac.get_secret_value("COGNITO_CLIENT_SECRET"))
    if not client_secret:
        client_secret = "8caa9mn0f696ic1utvrg1ni5j48e5kap9l5rm5c785d7c7bdnjn"
    return client_secret


def retrieve_cognito_oauth_token(request: dict) -> dict:
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

    :param request: Dictionary containing the HTTP request for our Cognito authentication callback.
    :returns: Dictionary containing decoded JWT token (id_token) from the /oauth2/token endpoint call.
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
    # effectively the same thing; we will just use the latter (see: create_cognito_authtoken).
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

    :param request: Dictionary containing the HTTP request for our Cognito authentication callback.
    :returns: Dictionary containing the HTTP response for the /oauth2/token endpoint (POST) call.
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
    print('xyzzy/_call_cognito_oauth_token_endpoint')
    print(request)
    print(args)
    print(code)
    print(code_verifier)
    data = _get_cognito_oauth_token_endpoint_data(request, code=code, code_verifier=code_verifier)
    print('xyzzy/_call_cognito_oauth_token_endpoint/2')
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
    print('xyzzy/_call_cognito_oauth_token_endpoint/posting')
    print(url)
    print(headers)
    print(data)
    cognito_auth_token_response = requests.post(url, headers=headers, data=data)
    print('xyzzy/_call_cognito_oauth_token_endpoint/posting/after')
    print(cognito_auth_token_response)
    print(cognito_auth_token_response.status_code)
    if cognito_auth_token_response.status_code != 200:
        raise Exception("Invalid response from /oauth2/token")
    cognito_auth_token_response_json = cognito_auth_token_response.json()
    print(cognito_auth_token_response_json)
    return cognito_auth_token_response_json


def _get_cognito_oauth_token_endpoint_url() -> str:
    """
    Returns the URL for the POST to the /oauth2/token endpoint.
    Cognito configuration dependencies: domain.
    :returns: URL for /oauth2/token endpoint.
    """
    config = _get_cognito_oauth_config_base()
    domain = config["domain"]
    return f"https://{domain}/oauth2/token"


def _get_cognito_oauth_token_endpoint_authorization() -> dict:
    """
    Returns the value for basic authorization value suitable
    for the header of a POST to the /oauth2/token endpoint.
    Cognito configuration dependencies: client ID, client secret.
    :returns: Authorization header value for /oauth2/token endpoint.
    """
    config = _get_cognito_oauth_config_base()
    client_id = config["client_id"]
    client_secret = _get_cognito_oauth_config_client_secret()
    return base64_encode(f"{client_id}:{client_secret}")


def _get_cognito_oauth_token_endpoint_data(request: dict, code: str, code_verifier: str) -> dict:
    """
    Returns the data (dictionary) suitable as the payload for a POST to the /oauth2/token
    endpoint, given an authorization code and associated code_verifier passed to our
    our authentication callback.

    Cognito configuration dependencies: client ID, our authentication callback URL.

    :param code: Value passed to our backend authentication callback.
    :param code_verifier: Value passed to our backend authentication callback.
    :returns: Data suitable for POST payload for /oauth2/token endpoint.
    """
    config = get_cognito_oauth_config(request)
    client_id = config["client_id"]
    callback = config["callback"]
    return {
        "grant_type": "authorization_code",
        "client_id": client_id,
        #
        # Note that do NOT pass the client secret here as we are passing it in the header
        # to the /oauth2/token endpoint (POST) call. Though it would do no harm to do so.
        # See: _get_cognito_oauth_token_endpoint_authorization.
        #
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": callback
    }


def _decode_cognito_oauth_token_jwt(jwt: str, verify_signature: bool = True, verify_expiration = True) -> dict:
    """
    Decodes and returns the dictionary for the given JWT.
    To do this we use the signing key within the given JWT which we extract
    using info from the Cognito authentication server JWKA (JSON Web Key Sets) API.
    Cognito configuration dependencies: user pool ID, client ID.
    Cognito endpoint dependencies: JWKS endpoint .../.well-known/jwks.json.

    :param jwt: JWT token value (id_token) retrieved from the /oauth2/token endpoint.
    :param verify_signature: Boolean (default True) indicating JWT signature verification.
    :param verify_expiration: Boolean (default True) indicating JWT expiration verification.
    :returns: Dictionary containing decoded value of the given JWT.
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
    # TODO: Better understand why it is okay not to require to use the client secret to verify
    # the JWT as we had to do for Auth0; i.e. this JWT is publicly VERIFIABLE by anyone; which
    # I suppose is reasonable; being a JWT, it is ALREADY publicly READABLE by anyone.
    #
    config = _get_cognito_oauth_config_base()
    client_id = config["client_id"]
    signing_key = _get_cognito_oauth_signing_key(jwt)
    options = {
        "verify_signature": verify_signature,
        "verify_exp": verify_expiration
    }
    return jwtlib.decode(jwt, signing_key, audience=client_id, algorithms=["RS256"], options=options)


def _get_cognito_oauth_signing_key(jwt: str) -> object:
    """
    Returns the signing key (object) from the given JWT.
    Actual type of returned object: cryptography.hazmat.backends.openssl.rsa._RSAPublicKey.

    Cognito configuration dependencies: user pool ID.
    Cognito endpoint dependencies: JWKS i.e. /.well-known/jwks.json.

    :param jwt: JWT token value (id_token) retrieved from the /oauth2/token endpoint.
    :returns: Object suitable for use as a signing key to decode a JWT.
    """
    signing_key_client = _get_cognito_oauth_signing_key_client()
    signing_key = signing_key_client.get_signing_key_from_jwt(string_to_bytes(jwt))
    return signing_key.key


def _get_cognito_oauth_signing_key_client() -> object:
    """
    Returns an object which can be used to extract a signing key from a JWT.
    The returned object will contain a "get_signing_key_from_jwt" method, which takes
    JWT (as bytes) argument and returns a signing key object which has a "key" property.
    Hits the jwks.json (JSON Web Key Sets) API for the Cognito authentication server.
    Actual type of returned object: jwt.jwks_client.PyJWKClient

    Cognito configuration dependencies: user pool ID.
    Cognito endpoint dependencies: JWKS i.e. /.well-known/jwks.json.

    :returns: Object suitable for extracting a signing key from a JWT.
    """
    config = _get_cognito_oauth_config_base()
    user_pool_id = config["user_pool_id"]
    cognito_jwks_url = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    return PyJWKClient(cognito_jwks_url)


def create_cognito_authtoken(token: dict, env: str, envs: Envs, domain: str, site: str) -> Tuple[dict, int]:
    """
    Creates from the given (decoded) JWT token, retrieved from the /oauth2/token endpoint, an
    authtoken suitable for use as a cookie to indicate the user has been authenticated (logged in).
    This is analagous to foursight_core.react.api.auth.create_authtoken used for Auth0 authentication.

    :param token: Decoded JWT token from the /oauth2/token endpoint.
    :returns: JWT-encoded "authtoken" dictionary suitable for cookie-ing the authenticated user.
    """
    email = token.get("email")
    allowed_envs, first_name, last_name = envs.get_user_auth_info(email)
    expires = token.get("exp")
    authtoken = {
        "authentication": "cognito",
        "authenticator": "google", # TODO: get from identities
        "authenticated": True,
        "authenticated_at": token.get("iat"),
        "authenticated_until": expires,
        "user": email,
        "user_verified": token.get("email_verified"),
        "first_name": token.get("given_name") or first_name,
        "last_name": token.get("family_name") or last_name,
        "allowed_envs": allowed_envs,
        "known_envs": envs.get_known_envs(),
        "default_env": envs.get_default_env(),
        "initial_env": env,
        "domain": domain,
        "site": site
    }
    return authtoken, expires


def cognito_cache_clear():
    _get_cognito_oauth_config_base.cache_clear()
    _get_cognito_oauth_config_client_secret.cache_clear()
