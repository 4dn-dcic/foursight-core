import os
from random import randrange
import time
from typing import Optional
import uuid
from foursight_core.react.api.auth import Auth
from foursight_core.react.api.envs import Envs
from foursight_core.react.api.jwt_utils import jwt_encode

AUTH0_CLIENT_ID = str(uuid.uuid4())
AUTH0_SECRET = str(uuid.uuid4())
AUTH0_SECRET_INVALID = str(uuid.uuid4())
KNOWN_ENV_A = {
    "name": "env-a",
    "full_name": "env-a-full-name",
    "short_name": "env-a-short-name",
    "public_name": "env-a-public-name",
    "foursight_name": "env-a-foursight-name"
}
KNOWN_ENV_B = {
    "name": "env-b",
    "full_name": "env-b-full-name",
    "short_name": "env-b-short-name",
    "public_name": "env-b-public-name",
    "foursight_name": "env-b-foursight-name"
}
KNOWN_ENV_C = {
    "name": "env-c",
    "full_name": "env-c-full-name",
    "short_name": "env-c-short-name",
    "public_name": "env-c-public-name",
    "foursight_name": "env-c-foursight-name"
}
KNOWN_ENVS = [
    KNOWN_ENV_A,
    KNOWN_ENV_B,
    KNOWN_ENV_C,
]
ALLOWED_ENVS = ["env-b-full-name", "env-c-full-name"]
ALLOWED_ENV = "env-c-full-name"
DISALLOWED_ENV = "env-a-full-name"
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

AUTH = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)


def create_test_jwt_unencoded():
    return {
        "email": EMAIL,
        "email_verified": True,
        "some-property": "some-value",
        "another-property": "another-value",
        "iat": ISSUED_AT
    }


def create_test_jwt(use_invalid_auth0_secret: bool = False):
    return jwt_encode(create_test_jwt_unencoded(), AUTH0_CLIENT_ID, AUTH0_SECRET_INVALID if use_invalid_auth0_secret else AUTH0_SECRET)


def create_test_authtoken(expires_or_expired_at: int = EXPIRES_AT, use_invalid_auth0_secret: bool = False):
    jwt = create_test_jwt(use_invalid_auth0_secret)
    os.environ["ENV_NAME"] = DEFAULT_ENV
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET_INVALID if use_invalid_auth0_secret else AUTH0_SECRET, ENVS)
    authtoken = auth.create_authtoken(jwt, expires_or_expired_at, INITIAL_ENV, DOMAIN)
    return authtoken


def create_test_authtoken_good():
    return create_test_authtoken(EXPIRES_AT)


def create_test_authtoken_expired():
    return create_test_authtoken(EXPIRED_AT)


def create_test_authtoken_invalid_auth0_secret():
    return create_test_authtoken(EXPIRES_AT, use_invalid_auth0_secret=True)


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
    # TODO: This is rather lame. Just want to randomly munge the string
    # a bit without changing it entirely; come up with something better.
    for i in range(n):
        random_position = randrange(len(value))
        value = value[0:random_position] + "X" + value[random_position + 1:]
    return value


def mock_foursight_env_name(env: str) -> Optional[str]:
    known_env = [known_env for known_env in KNOWN_ENVS if env in known_env.values()]
    return known_env[0].get("foursight_name") if len(known_env) == 1 else None


def mock_short_env_name(env: str) -> Optional[str]:
    known_env = [known_env for known_env in KNOWN_ENVS if env in known_env.values()]
    return known_env[0].get("short_name") if len(known_env) == 1 else None
