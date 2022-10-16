import mock
from foursight_core.react.api import react_routes
from foursight_core.react.api.react_api import ReactApi
from test_react_auth_defs import *


def create_test_route_response_body(environ: str):
    return {"env": environ, "react-response-property": "react-response-value"}


def create_test_route_response(environ: str):
    response = ReactApi.create_success_response()
    response.body = create_test_route_response_body(environ)
    return response


def assert_authorized_response(response, environ: str):
    assert response.status_code == 200
    assert response.body == create_test_route_response_body(environ)


def assert_unauthenticated_response(response):
    assert response.status_code == 401
    assert response.body["authenticated"] == False
    assert response.body["authorized"] == False


def assert_unauthorized_response(response):
    assert response.status_code == 403
    assert response.body["authenticated"] == True
    assert response.body["authorized"] == False


class MockChaliceApp:

    class MockReactApi:
        def __init__(self):
            self.react_authorize = AUTH.authorize
            self.create_success_response = ReactApi.create_success_response

    class MockChaliceRequest:
        def __init__(self, request: dict) -> None:
            self._request = request
        def to_dict(self) -> dict:
            return self._request

    def __init__(self, current_request: dict):
        self._current_request = MockChaliceApp.MockChaliceRequest(current_request)
    @property
    def current_request(self) -> MockChaliceRequest:
        return self._current_request
    @property
    def core(self) -> MockReactApi:
        return MockChaliceApp.MockReactApi()


def test_react_authentication_decorator_good():
    request = create_test_request(create_test_authtoken_good())
    app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", app):
        @react_routes.route_requires_authorization
        def test_react_route(environ: str):
            return create_test_route_response(environ)
        response = test_react_route(environ=ALLOWED_ENV)
        assert_authorized_response(response, ALLOWED_ENV)


def test_react_authentication_decorator_unauthorized():
    request = create_test_request(create_test_authtoken_good())
    app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", app):
        @react_routes.route_requires_authorization
        def test_react_route(environ: str):
            return create_test_route_response(environ)
        response = test_react_route(environ=DISALLOWED_ENV)  # Note disallowed env
        assert_unauthorized_response(response)


def test_react_authentication_decorator_unauthenticated_expired():
    request = create_test_request(create_test_authtoken_expired())
    app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", app):
        @react_routes.route_requires_authorization
        def test_react_route(environ: str):
            return create_test_route_response(environ)
        response = test_react_route(environ=ALLOWED_ENV)
        assert_unauthenticated_response(response)


def test_react_authentication_decorator_unauthenticated_invalid_auth0_secret():
    request = create_test_request(create_test_authtoken_invalid_auth0_secret())
    app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", app):
        @react_routes.route_requires_authorization
        def test_react_route(environ: str):
            return create_test_route_response(environ)
        response = test_react_route(environ=ALLOWED_ENV)
        assert_unauthenticated_response(response)


def test_react_authentication_decorator_unauthenticated_munged():
    request = create_test_request(create_test_authtoken_munged())
    app = MockChaliceApp(request)
    with mock.patch.object(react_routes, "app", app):
        @react_routes.route_requires_authorization
        def test_react_route(environ: str):
            return create_test_route_response(environ)
        response = test_react_route(environ=ALLOWED_ENV)
        assert_unauthenticated_response(response)
