import json
import mock
import os
import pytest
from random import randrange
import time
import uuid
from foursight_core.react.api.auth import Auth
from foursight_core.react.api import auth as auth_module
from foursight_core.react.api.envs import Envs
from foursight_core.react.api.jwt_utils import jwt_decode, jwt_encode
from foursight_core.react.api import cookie_utils # import read_cookie


AUTH0_CLIENT_ID = str(uuid.uuid4())
AUTH0_SECRET = str(uuid.uuid4())
KNOWN_ENVS = [
    { "name": "env-a",
      "full_name": "env-a-full-name",
      "short_name": "env-a-short-name",
      "public_name": "env-a-public-name",
      "foursight_name": "env-a-foursight-name" },
    { "name": "env-b",
      "full_name": "env-b-full-name",
      "short_name": "env-b-short-name",
      "public_name": "env-b-public-name",
      "foursight_name": "env-b-foursight-name" },
    { "name": "env-c",
      "full_name": "env-c-full-name",
      "short_name": "env-c-short-name",
      "public_name": "env-c-public-name",
      "foursight_name": "env-c-foursight-name" }
]
ALLOWED_ENVS = ["env-b-full-name", "env-c-full-name"]
DEFAULT_ENV = "env-a-full-name"
INITIAL_ENV = "env-b-full-name"

ISSUED_AT  = int(time.time())
EXPIRES_IN = (60 * 60 * 24)
EXPIRES_AT = int(time.time()) + EXPIRES_IN

ENVS = Envs(KNOWN_ENVS)
EMAIL = "some-email@some-domain.edu"
FIRST_NAME = "Herman"
LAST_NAME = "Melville"
DOMAIN = "some-domain"
# Mock out the call which create_authtoken makes Envs.get_user_auth_info
# to get the allowed environments and first/last name for the user.
ENVS.get_user_auth_info = lambda email: (ALLOWED_ENVS, FIRST_NAME, LAST_NAME)


def _create_test_jwt_unencoded():
    return {
        "email": EMAIL,
        "email_verified": True,
        "some-property": "some-value",
        "another-property": "another-value",
        "iat": ISSUED_AT
    }


def _create_test_jwt():
    return jwt_encode(_create_test_jwt_unencoded(), AUTH0_CLIENT_ID, AUTH0_SECRET)


def _create_test_authtoken():
    jwt = _create_test_jwt()
    os.environ["ENV_NAME"] = DEFAULT_ENV
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = auth.create_authtoken(jwt, EXPIRES_AT, INITIAL_ENV, DOMAIN)
    return authtoken


def test_jwt_encode_and_decode():
    jwt = _create_test_jwt()
    jwt_decoded = jwt_decode(jwt, AUTH0_CLIENT_ID, AUTH0_SECRET)
    assert jwt_decoded["aud"] == AUTH0_CLIENT_ID
    assert jwt_decoded["some-property"] == _create_test_jwt_unencoded()["some-property"]
    assert jwt_decoded["another-property"] == _create_test_jwt_unencoded()["another-property"]


def test_react_create_and_decode_authtoken():

    authtoken = _create_test_authtoken()
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken_decoded = auth.decode_authtoken(authtoken)
    assert authtoken_decoded["authenticated"] == True
    assert authtoken_decoded["authenticated_at"] == ISSUED_AT
    assert authtoken_decoded["authenticated_until"] == EXPIRES_AT
    assert authtoken_decoded["authorized"] == True
    assert authtoken_decoded["user"] == EMAIL
    assert authtoken_decoded["user_verified"] == True
    assert authtoken_decoded["first_name"] == FIRST_NAME
    assert authtoken_decoded["last_name"] == LAST_NAME
    assert authtoken_decoded["known_envs"] == KNOWN_ENVS
    assert authtoken_decoded["allowed_envs"] == ALLOWED_ENVS
    assert authtoken_decoded["default_env"] == DEFAULT_ENV
    assert authtoken_decoded["initial_env"] == INITIAL_ENV
    assert authtoken_decoded["domain"] == DOMAIN
    assert authtoken_decoded["aud"] == AUTH0_CLIENT_ID

def test_react_authenticate():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = _create_test_authtoken()
    request = {
        "headers": {
            "host": "some-domain",
            "cookie": f"some-cookie=some-cookie-value; authtoken={authtoken}"
        }
    }
    authorize_response = auth.authorize(request, "env-b")
    assert authorize_response["authenticated"] == True
    assert authorize_response["authenticated_at"] == ISSUED_AT
    assert authorize_response["authenticated_until"] == EXPIRES_AT
    assert authorize_response["authorized"] == True
    assert authorize_response["user"] == EMAIL
    assert authorize_response["user_verified"] == True
    assert authorize_response["first_name"] == FIRST_NAME
    assert authorize_response["last_name"] == LAST_NAME
    assert authorize_response["known_envs"] == KNOWN_ENVS
    assert authorize_response["allowed_envs"] == ALLOWED_ENVS
    assert authorize_response["default_env"] == DEFAULT_ENV
    assert authorize_response["initial_env"] == INITIAL_ENV
    assert authorize_response["domain"] == DOMAIN
    assert authorize_response["aud"] == AUTH0_CLIENT_ID

def _change_random_character_within_string_ntimes(value: str, n: int) -> str:
    for i in range(n):
        random_position = randrange(len(value))
        value = value[0:random_position] + "X" + value[random_position + 1:]
    return value

def test_react_authenticate_failure():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = _create_test_authtoken()
    # Munging the authtoken a bit should cause the signature verification to fail.
    authtoken = _change_random_character_within_string_ntimes(authtoken, 3)
    print(authtoken)
    request = {
        "headers": {
            "host": "some-domain",
            "cookie": f"some-cookie=some-cookie-value; authtoken={authtoken}"
        }
    }
    authorize_response = auth.authorize(request, "env-b")
    assert authorize_response["authenticated"] == False
    assert authorize_response["authorized"] == False
