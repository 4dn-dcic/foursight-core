import json
import os
import pytest
from foursight_core.react.api.auth import Auth
from foursight_core.react.api.envs import Envs
from foursight_core.react.api.jwt_utils import jwt_decode, jwt_encode
import uuid


AUTH0_CLIENT_ID = str(uuid.uuid4())
AUTH0_SECRET = str(uuid.uuid4())

def _get_test_jwt_unencoded():
    return {
        "email": "some-email@some-domain.edu",
        "email_verified": True,
        "some-property": "some-value",
        "another-property": "another-value"
    }

def _get_test_jwt():
    return jwt_encode(_get_test_jwt_unencoded(), AUTH0_CLIENT_ID, AUTH0_SECRET)

def test_jwt_encode_decode():
    jwt = _get_test_jwt()
    jwt_decoded = jwt_decode(jwt, AUTH0_CLIENT_ID, AUTH0_SECRET)
    assert jwt_decoded["aud"] == AUTH0_CLIENT_ID
    assert jwt_decoded["some-property"] == "some-value"
    assert jwt_decoded["another-property"] == "another-value"


def test_react_auth():

    envs = Envs(["env-a", "env-b", "env-c"])
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, envs)
    jwt = _get_test_jwt()

    initial_env = "some-initial-env"
    default_env = "some-default-env"
    os.environ["ENV_NAME"] = default_env
    allowed_envs = ["some-allowed-env", "another-allowed-env"]
    first_name = "Herman"
    last_name = "Melville"
    domain = "some-domain"
    # Mock out the call which create_authtoken makes to get the allowed environments and first/last name for the user.
    envs.get_user_auth_info = lambda email: (allowed_envs, first_name, last_name)
    authtoken = auth.create_authtoken(jwt, initial_env, domain)
    authtoken_decoded = auth.decode_authtoken(authtoken)

    assert authtoken_decoded["authenticated"] == True
    assert authtoken_decoded["authorized"] == True
    assert authtoken_decoded["user"] == _get_test_jwt_unencoded()["email"]
    assert authtoken_decoded["user_verified"] == True
    assert authtoken_decoded["first_name"] == first_name
    assert authtoken_decoded["last_name"] == last_name
    assert authtoken_decoded["known_envs"] == envs.get_known_envs()
    assert authtoken_decoded["allowed_envs"] == allowed_envs
    assert authtoken_decoded["initial_env"] == initial_env
    assert authtoken_decoded["default_env"] == default_env
    assert authtoken_decoded["domain"] == "some-domain"
    print(authtoken_decoded)
