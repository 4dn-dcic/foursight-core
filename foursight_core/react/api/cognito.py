import jwt as jwtlib
from jwt import PyJWKClient
import requests
from .encoding_utils import base64_encode, string_to_bytes

def get_cognito_oauth_config(include_secret: bool = False) -> object:
    #
    # TODO: Get this info from safe place.
    #
    response = {
        "client_id": "5d586se3r976435167nk8k8s4h",
        "user_pool_id": "us-east-1_h6I5IqQSs",
        "domain": "foursightc.auth.us-east-1.amazoncognito.com",
        "scope": "openid email",
        "connections": [ "Google" ],
        "callback": "http://localhost:8000/api/react/oauth/callback" # TODO: /api/react/oauth/cognito/callback
    }
    if include_secret:
        #
        # This is a temporary test account - no harm in checking in.
        #
        response["client_secret"] = "8caa9mn0f696ic1utvrg1ni5j48e5kap9l5rm5c785d7c7bdnjn"
    return response

def get_cognito_oauth_token_decoded(request_dict: dict) -> dict:
    token = _get_cognito_oauth_token(request_dict)
    decoded_token = decode_cognito_oauth_jwt(token)
    return decoded_token

def _get_cognito_oauth_token(request_dict: dict) -> str:
    response = _call_cognito_oauth_token_endpoint(request_dict)
    return response.get("id_token")

def _call_cognito_oauth_token_endpoint(request_dict: dict) -> dict:
    args = request_dict.get("query_params") or {}
    args_code = args.get("code")
    args_state = args.get("state")
    args_oauth_state = args.get("oauth_state")
    args_ouath_pkce_key = args.get("ouath_pkce_key") # sic wrt ouath spelling
    data = _get_cognito_oauth_token_endpoint_data(code=args_code, code_verifier=args_ouath_pkce_key)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {_get_cognito_oauth_token_endpoint_authorization()}"
    }
    url = _get_cognito_oauth_token_endpoint_url()
    cognito_auth_token_response = requests.post(url, headers=headers, data=data)
    cognito_auth_token_response_json = cognito_auth_token_response.json()
    return cognito_auth_token_response_json

def _get_cognito_oauth_token_endpoint_url() -> str:
    config = get_cognito_oauth_config()
    domain = config["domain"]
    return f"https://{domain}/oauth2/token"

def _get_cognito_oauth_token_endpoint_authorization() -> dict:
    config = get_cognito_oauth_config(include_secret=True)
    client_id = config["client_id"]
    client_secret = config["client_secret"]
    return base64_encode(f"{client_id}:{client_secret}")

def _get_cognito_oauth_token_endpoint_data(code: str, code_verifier: str) -> dict:
    config = get_cognito_oauth_config(include_secret=True)
    return {
        "grant_type": "authorization_code",
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": config["callback"]
    }

def decode_cognito_oauth_jwt(jwt: str) -> dict:
    config = get_cognito_oauth_config()
    client_id = config["client_id"]
    signing_key = get_cognito_oauth_signing_key(jwt)
    return jwtlib.decode(jwt, signing_key, audience=client_id, algorithms=["RS256"], options={"verify_signature": True, "verify_exp": False})

def get_cognito_oauth_signing_key(jwt: str) -> object:
    jwt = string_to_bytes(jwt)
    signing_key_client = get_cognito_oauth_signing_key_client()
    signing_key = signing_key_client.get_signing_key_from_jwt(jwt)
    return signing_key.key

def get_cognito_oauth_signing_key_client() -> object:
    config = get_cognito_oauth_config()
    user_pool_id = config["user_pool_id"]
    cognito_jwks_url = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    return PyJWKClient(cognito_jwks_url)
