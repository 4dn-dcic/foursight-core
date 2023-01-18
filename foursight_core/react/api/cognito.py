import jwt as jwtlib
from jwt import PyJWKClient
import requests
from typing import Tuple
from foursight_core.react.api.encoding_utils import base64_encode, string_to_bytes
from foursight_core.react.api.jwt_utils import jwt_encode
from foursight_core.react.api.envs import Envs

def get_cognito_oauth_config() -> dict:
    """
    Returns all necessary configuration info for our AWS Coginito authentication server.
    :returns: Dictionary containing AWS Cognito configuration info.
    """
    #
    # TODO: Get this info from safe place.
    # Need to figure our which pieces go where and if they are per Foursight instance or what et cetera.
    # I guess it's just the use pool ID, client ID, and domain. 
    # Do we use one user pool (and associaetd client) for all or one per Foursight instance(s)?
    # Simpler but probably not technically ideal.
    #
    response = {
        "client_id": "5d586se3r976435167nk8k8s4h",
        "user_pool_id": "us-east-1_h6I5IqQSs",
        "domain": "foursightc.auth.us-east-1.amazoncognito.com",
        "scope": "openid email profile",
        "connections": [ "Google" ],
      # "callback": "http://localhost:8000/api/react/oauth/callback" # TODO: /api/react/oauth/cognito/callback
      # "callback": "http://localhost:8000/callback" # TODO: /api/react/oauth/cognito/callback
        "callback": "http://localhost:8000/api/reactapi/cognito/callback"
    }
    return response

def _get_cognito_oauth_client_secret() -> dict:
    #
    # This is a temporary test account - no harm in checking in.
    #
    return "8caa9mn0f696ic1utvrg1ni5j48e5kap9l5rm5c785d7c7bdnjn"

def retrieve_cognito_oauth_token(request: dict) -> dict:
    """
    Calls the /oauth2/token endpoint with the code (and other relevant data from the given
    request, e.g. code_verifier) to retrieve the associated JWT token (id_token) and returns
    its decoded value. See: call_cognito_oauth_token_endpoint for details on request arguments.

    Cognito configuration dependencies: domain, client ID, client secret.
    Cognito endpoint dependencies: Token i.e. /oauth2/token, JWKS i.e. /.well-known/jwks.json.

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
    response = call_cognito_oauth_token_endpoint(request)
    #
    # Note that we also get back from the /oauth2/token call above (in addition to the "id_token" JWT,
    # which we use) an "access_token" and a "refresh_token"; we do not currently use these; and trying
    # to decode the access_token gives us (unless we disable signature verification) an error because
    # there is no "aud" field there, and trying to decode the refresh_token gives us an invalid payload 
    # padding error for some as yet unknown reason, but no matter for now as we don't use these.
    #
    # Note that we also get back from the /oauth2/token call above an "expires_in" (e.g. 3600, for an
    # hour from "now") but the JWT (id_token) also contains a "exp" field (a time_t value) which is
    # effectively the same thing; we will just use the latter (see: create_cognito_auth_token).
    #
    token = response.get("id_token")
    decoded_token = decode_cognito_oauth_token_jwt(token)
    return decoded_token

def call_cognito_oauth_token_endpoint(request: dict) -> dict:
    """
    Calls the Cognito /oauth2/token endpoint to exchange an authorization code for a (JWT) token.
    This authorization "code" is an argument within the given request; this code, also along with
    a "state", was passed to our authenticaiton callback from Cognito. This request also contains
    a "code_verifier" argument, which came from "ouath_pkce_key" (sic) which was stored in browser
    local storage by our client-side authentication initiation code (i.e. Amplify.federatedSignIn),
    together with "oauth_state" which should match the request state argument.

    Cognito configuration dependencies: domain, client ID, client secret.
    Cognito endpoint dependencies: Token i.e. /oauth2/token, JWKS i.e. /.well-known/jwks.json.

    :param request: Dictionary containing the HTTP request for our Cognito authentication callback.
    :returns: Dictionary containing the HTTP response for the /oauth2/token endpoint (POST) call.
    """
    args = request.get("query_params") or {}
    code = args.get("code")
    state = args.get("state")
    client_side_state = args.get("oauth_state")
    #
    # Note the odd/known misspelling of "ouath_pkce_key" browser local storage variable.
    # This, and the above "oauth_state", is set by the client-side code which initiated the
    # authentication process, i.e. e.g. Amplify.federatedSignIn. This is the "code_verifier"
    # which we pass as an argument, along with the given code, to the /oauth2/token endpoint.
    #
    code_verifier = args.get("ouath_pkce_key")
    if not code_verifier:
        code_verifier = args.get("code_verifier")
    if state != client_side_state:
        raise Exception("Authentication state value mismatch.")
    data = _get_cognito_oauth_token_endpoint_data(code=code, code_verifier=code_verifier)
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
    print('xyzzy/cognito_auth_token_response_json/calling-oauth-token2-endpoint')
    print(headers)
    print(data)
    cognito_auth_token_response = requests.post(url, headers=headers, data=data)
    cognito_auth_token_response_json = cognito_auth_token_response.json()
    print('xyzzy/cognito_auth_token_response_json/a')
    print(cognito_auth_token_response_json)
    return cognito_auth_token_response_json

def _get_cognito_oauth_token_endpoint_url() -> str:
    """
    Returns the URL for the POST to the /oauth2/token endpoint.
    Cognito configuration dependencies: domain.
    :returns: URL for /oauth2/token endpoint.
    """
    config = get_cognito_oauth_config()
    domain = config["domain"]
    return f"https://{domain}/oauth2/token"

def _get_cognito_oauth_token_endpoint_authorization() -> dict:
    """
    Returns the value for basic authorization value suitable
    for the header of a POST to the /oauth2/token endpoint.
    Cognito configuration dependencies: client ID, client secret.
    :returns: Authorization header value for /oauth2/token endpoint.
    """
    config = get_cognito_oauth_config()
    client_id = config["client_id"]
    client_secret = _get_cognito_oauth_client_secret()
    return base64_encode(f"{client_id}:{client_secret}")

def _get_cognito_oauth_token_endpoint_data(code: str, code_verifier: str) -> dict:
    """
    Returns the data (dictionary) suitable as the payload for a POST to the /oauth2/token
    endpoint, given an authorization code and associated code_verifier passed to our
    our authentication callback.

    Cognito configuration dependencies: client ID, our authentication callback URL.

    :param code: Value passed to our backend authentication callback.
    :param code_verifier: Value passed to our backend authentication callback.
    :returns: Data suitable for POST payload for /oauth2/token endpoint.
    """
    config = get_cognito_oauth_config()
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

def decode_cognito_oauth_token_jwt(jwt: str, verify_signature: bool = True, verify_expiration = True) -> dict:
    """
    Decodes and returns the dictionary for the given JWT.
    To do this we use the signing key within the given JWT which we extract
    using info from the Cognito authentication server JWKA (JSON Web Key Sets) API.
    Cognito configuration dependencies: user pool ID, client ID.
    Cognito endpoint dependencies: JWKS i.e. /.well-known/jwks.json.

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
    config = get_cognito_oauth_config()
    client_id = config["client_id"]
    signing_key = get_cognito_oauth_signing_key(jwt)
    options = {
        "verify_signature": verify_signature,
        "verify_exp": verify_expiration
    }
    return jwtlib.decode(jwt, signing_key, audience=client_id, algorithms=["RS256"], options=options)

def get_cognito_oauth_signing_key(jwt: str) -> object:
    """
    Returns the signing key (object) from the given JWT.
    Actual type of returned object: cryptography.hazmat.backends.openssl.rsa._RSAPublicKey.

    Cognito configuration dependencies: user pool ID.
    Cognito endpoint dependencies: JWKS i.e. /.well-known/jwks.json.

    :param jwt: JWT token value (id_token) retrieved from the /oauth2/token endpoint.
    :returns: Object suitable for use as a signing key to decode a JWT.
    """
    signing_key_client = get_cognito_oauth_signing_key_client()
    signing_key = signing_key_client.get_signing_key_from_jwt(string_to_bytes(jwt))
    return signing_key.key

def get_cognito_oauth_signing_key_client() -> object:
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
    config = get_cognito_oauth_config()
    user_pool_id = config["user_pool_id"]
    cognito_jwks_url = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    return PyJWKClient(cognito_jwks_url)

def create_cognito_auth_token(token: dict, env: str, envs: Envs, domain: str, site: str) -> Tuple[dict, int]:
    """
    Creates from the given (decoded) JWT token, retrieved from the /oauth2/token endpoint, an
    authtoken suitable for use as a cookie to indicate the user has been authenticated (logged in).
    This is analagous to foursight_core.react.api.auth.create_authtoken used for Auth0 authentication.

    Cognito configuration dependencies: client ID, client secret.

    :param token: Decoded JWT token from the /oauth2/token endpoint.
    :returns: JWT-encoded "authtoken" dictionary suitable for cookie-ing the authenticated user.
    """
    config = get_cognito_oauth_config()
    client_id = config["client_id"]
    client_secret = _get_cognito_oauth_client_secret()
    email = token.get("email")
    print('xyzzy/create_cognito_auth_token/CALLING-GET-USER-AUTH-INFO')
    print(email)
    allowed_envs, first_name, last_name = envs.get_user_auth_info(email)
    print('xyzzy/create_cognito_auth_token/CALLED-GET-USER-AUTH-INFO')
    print(allowed_envs)
    print(first_name)
    print(last_name)
    expires_at = token.get("exp")
    authtoken = {
        "authentication": "cognito",
        "authenticator": "google", # TODO: get from identities
        "authenticated": True,
        "authenticated_at": token.get("iat"),
        "authenticated_until": expires_at,
        "user": token.get("email"),
        "user_verified": token.get("email_verified"),
        "first_name": token.get("first_name"),
        "last_name": token.get("last_name"),
        "allowed_envs": allowed_envs,
        "known_envs": envs.get_known_envs(),
        "default_env": envs.get_default_env(),
        "initial_env": env,
        "domain": domain,
        "site": site
    }
    authtoken_encoded = jwt_encode(authtoken, audience=client_id, secret=client_secret)
    return authtoken_encoded, expires_at
