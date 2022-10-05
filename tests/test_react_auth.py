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
from test_react_auth_defs import *


def test_jwt_encode_and_decode():
    jwt = create_test_jwt()
    jwt_decoded = jwt_decode(jwt, AUTH0_CLIENT_ID, AUTH0_SECRET)
    assert jwt_decoded["aud"] == AUTH0_CLIENT_ID
    assert jwt_decoded["some-property"] == create_test_jwt_unencoded()["some-property"]
    assert jwt_decoded["another-property"] == create_test_jwt_unencoded()["another-property"]


def test_react_create_and_decode_authtoken():

    authtoken = create_test_authtoken_good()
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
    authtoken = create_test_authtoken_good()
    request = create_test_request(authtoken)
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

def test_react_authenticate_failure():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = create_test_authtoken_munged()
    request = {
        "headers": {
            "host": "some-domain",
            "cookie": f"some-cookie=some-cookie-value; authtoken={authtoken}"
        }
    }
    authorize_response = auth.authorize(request, "env-b")
    assert authorize_response["authenticated"] == False
    assert authorize_response["authorized"] == False
