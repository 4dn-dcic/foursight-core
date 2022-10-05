from chalice import Chalice
import json
import mock
import os
import pytest
from random import randrange
import time
import uuid
from foursight_core.react.api import react_routes
from foursight_core.react.api.react_api import ReactApi
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
SOME_ALLOWED_ENV = "env-c-full-name"
SOME_DISALLOWED_ENV = "env-a-full-name"
DEFAULT_ENV = "env-a-full-name"
INITIAL_ENV = "env-b-full-name"

ISSUED_AT  = int(time.time())
EXPIRES_AT = int(time.time()) + (60 * 60 * 24)
EXPIRED_AT = int(time.time()) - (60 * 60 * 24)

ENVS = Envs(KNOWN_ENVS)
EMAIL = "some-email@some-domain.edu"
FIRST_NAME = "Herman"
LAST_NAME = "Melville"
DOMAIN = "some-domain"
# Mock out the call which create_authtoken makes Envs.get_user_auth_info
# to get the allowed environments and first/last name for the user.
ENVS.get_user_auth_info = lambda email: (ALLOWED_ENVS, FIRST_NAME, LAST_NAME)


def create_test_jwt_unencoded():
    return {
        "email": EMAIL,
        "email_verified": True,
        "some-property": "some-value",
        "another-property": "another-value",
        "iat": ISSUED_AT
    }


def create_test_jwt():
    return jwt_encode(create_test_jwt_unencoded(), AUTH0_CLIENT_ID, AUTH0_SECRET)


def create_test_authtoken(expires_or_expired_at: int):
    jwt = create_test_jwt()
    os.environ["ENV_NAME"] = DEFAULT_ENV
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = auth.create_authtoken(jwt, expires_or_expired_at, INITIAL_ENV, DOMAIN)
    return authtoken


def create_test_authtoken_good():
    return create_test_authtoken(EXPIRES_AT)


def create_test_authtoken_expired():
    return create_test_authtoken(EXPIRED_AT)


def create_test_authtoken_munged():
    authtoken = create_test_authtoken_good()
    authtoken = _change_random_character_within_string_ntimes(authtoken, 3)
    return authtoken


def create_test_authtoken_expired():
    authtoken = create_test_authtoken_good()
    authtoken = _change_random_character_within_string_ntimes(authtoken, 3)
    return authtoken


def create_test_request(authtoken: str):
    return {
        "headers": {
            "host": DOMAIN,
            "cookie": f"some-cookie=some-cookie-value; authtoken={authtoken}"
        }
    }


def _change_random_character_within_string_ntimes(value: str, n: int) -> str:
    for i in range(n):
        random_position = randrange(len(value))
        value = value[0:random_position] + "X" + value[random_position + 1:]
    return value
