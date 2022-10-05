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


class MockChaliceApp:

    class MockReactApi:
        def __init__(self, auth0_secret = None):
            if not auth0_secret:
                auth0_secret = AUTH0_SECRET
            self.react_authorize = Auth(AUTH0_CLIENT_ID, auth0_secret, ENVS).authorize
            self.create_standard_response = ReactApi.create_standard_response

    class MockChaliceRequest:
        def __init__(self, request: dict) -> None:
            self._request = request
        def to_dict(self) -> None:
            return self._request

    def __init__(self, current_request: dict, use_invalid_auth0_secret: bool = False):
        self._current_request = MockChaliceApp.MockChaliceRequest(current_request)
        self._use_invalid_auth0_secret = use_invalid_auth0_secret
    @property
    def current_request(self) -> None:
        return self._current_request
    @property
    def core(self) -> None:
        return MockChaliceApp.MockReactApi("invalid-auth0-secret" if self._use_invalid_auth0_secret else None)


def test_react_authentication_decorator_good():
    request = create_test_request(create_test_authtoken_good())
    chalice_app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", chalice_app):
        test_response_body = {"react-response-property": "react-response-value"}
        @react_routes.route_requires_authorization
        def test_react_route(environ: str, **kwargs):
            response = ReactApi.create_standard_response()
            response.body = test_response_body
            return response
        response = test_react_route(environ=SOME_ALLOWED_ENV)
        assert response.status_code == 200
        assert response.body == test_response_body


def test_react_authentication_decorator_unauthorized():
    request = create_test_request(create_test_authtoken_good())
    chalice_app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", chalice_app):
        test_response_body = {"react-response-property": "react-response-value"}
        @react_routes.route_requires_authorization
        def test_react_route(environ: str, **kwargs):
            response = ReactApi.create_standard_response()
            response.body = test_response_body
            return response
        response = test_react_route(environ=SOME_DISALLOWED_ENV) # Note disallowed env
        assert response.status_code == 403
        assert response.body["authenticated"] == True
        assert response.body["authorized"] == False


def test_react_authentication_decorator_unauthenticated_expired():
    request = create_test_request(create_test_authtoken_expired())
    chalice_app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", chalice_app):
        test_response_body = {"react-response-property": "react-response-value"}
        @react_routes.route_requires_authorization
        def test_react_route(environ: str, **kwargs):
            response = ReactApi.create_standard_response()
            response.body = test_response_body
            return response
        response = test_react_route(environ=SOME_ALLOWED_ENV)
        assert response.status_code == 401
        assert response.body["authenticated"] == False
        assert response.body["authorized"] == False


def test_react_authentication_decorator_unauthenticated_invalid_auth0_secret():
    request = create_test_request(create_test_authtoken_good())
    chalice_app = MockChaliceApp(request, use_invalid_auth0_secret=True)
    with mock.patch.object(react_routes, "app", chalice_app):
        test_response_body = {"react-response-property": "react-response-value"}
        @react_routes.route_requires_authorization
        def test_react_route(environ: str, **kwargs):
            response = ReactApi.create_standard_response()
            response.body = test_response_body
            return response
        response = test_react_route(environ=SOME_ALLOWED_ENV)
        assert response.status_code == 401
        assert response.body["authenticated"] == False
        assert response.body["authorized"] == False


def test_react_authentication_decorator_unauthenticated_munged():
    authtoken = create_test_authtoken_munged()
    request = create_test_request(authtoken)
    chalice_app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", chalice_app):
        test_response_body = {"react-response-property": "react-response-value"}
        @react_routes.route_requires_authorization
        def test_react_route(environ: str, **kwargs):
            response = ReactApi.create_standard_response()
            response.body = test_response_body
            return response
        response = test_react_route(environ=SOME_ALLOWED_ENV)
        assert response.status_code == 401
        assert response.body["authenticated"] == False
        assert response.body["authorized"] == False
