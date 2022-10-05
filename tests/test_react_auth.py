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


def assert_authorized_response(response):
    assert response["authenticated"] == True
    assert response["authenticated_at"] == ISSUED_AT
    assert response["authenticated_until"] == EXPIRES_AT
    assert response["authorized"] == True
    assert response["user"] == EMAIL
    assert response["user_verified"] == True
    assert response["first_name"] == FIRST_NAME
    assert response["last_name"] == LAST_NAME
    assert response["known_envs"] == KNOWN_ENVS
    assert response["allowed_envs"] == ALLOWED_ENVS
    assert response["default_env"] == DEFAULT_ENV
    assert response["initial_env"] == INITIAL_ENV
    assert response["domain"] == DOMAIN
    assert response["aud"] == AUTH0_CLIENT_ID


def assert_unauthenticated_response(response):
    assert response["authenticated"] == False
    assert response["authorized"] == False


def assert_unauthorized_response(response):
    assert response["authenticated"] == True
    assert response["authorized"] == False


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
    assert_authorized_response(authtoken_decoded)


def test_react_authorize():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = create_test_authtoken_good()
    request = create_test_request(authtoken)
    response = auth.authorize(request, SOME_ALLOWED_ENV)
    assert_authorized_response(response)


def test_react_authorize_unauthorized():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = create_test_authtoken_good()
    request = create_test_request(authtoken)
    response = auth.authorize(request, SOME_DISALLOWED_ENV)
    assert_unauthorized_response(response)


def test_react_authorize_expired():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = create_test_authtoken_expired()
    request = create_test_request(authtoken)
    response = auth.authorize(request, SOME_ALLOWED_ENV)
    assert_unauthenticated_response(response)


def test_react_authorize_munged():
    auth = Auth(AUTH0_CLIENT_ID, AUTH0_SECRET, ENVS)
    authtoken = create_test_authtoken_munged()
    request = create_test_request(authtoken)
    response = auth.authorize(request, SOME_ALLOWED_ENV)
    assert_unauthenticated_response(response)
