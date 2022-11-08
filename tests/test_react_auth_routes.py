import mock
from foursight_core.react.api import envs
from foursight_core.react.api import react_route_decorator
from foursight_core.react.api.react_api import ReactApi
from test_react_auth_defs import (
    ALLOWED_ENV,
    AUTH,
    DEFAULT_ENV,
    DISALLOWED_ENV,
    create_test_authtoken_expired,
    create_test_authtoken_good,
    create_test_authtoken_invalid_auth0_secret,
    create_test_authtoken_munged,
    create_test_request,
    mock_foursight_env_name
)


def create_test_route_response_body(env: str):
    return {"env": env, "react-response-property": "react-response-value"}


def create_test_route_response(env: str):
    response = ReactApi.create_success_response()
    response.body = create_test_route_response_body(env)
    return response


def assert_authorized_response(response, env: str):
    assert response.status_code == 200
    assert response.body == create_test_route_response_body(env)


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
            self.create_response = ReactApi.create_response

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
    def route(self, path: str, **kwargs):
        def route_registration(wrapped_route_function):
            return wrapped_route_function
        return route_registration


def test_react_authentication_decorator_good():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        request = create_test_request(create_test_authtoken_good())
        app = MockChaliceApp(request)
        with mock.patch.object(react_route_decorator, "app", app):
            @react_route_decorator.route("/{env}/dummy", authorize=True)
            def test_react_route(env: str):
                return create_test_route_response(env)
            response = test_react_route(env=ALLOWED_ENV)
            assert_authorized_response(response, ALLOWED_ENV)


def test_react_authentication_decorator_unauthorized():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        request = create_test_request(create_test_authtoken_good())
        app = MockChaliceApp(request)
        with mock.patch.object(react_route_decorator, "app", app):
            @react_route_decorator.route("/{env}/dummy", authorize=True)
            def test_react_route(env: str):
                return create_test_route_response(env)
            response = test_react_route(env=DISALLOWED_ENV)  # Note disallowed env
            assert_unauthorized_response(response)


def test_react_authentication_decorator_unauthenticated_expired():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        request = create_test_request(create_test_authtoken_expired())
        app = MockChaliceApp(request)
        with mock.patch.object(react_route_decorator, "app", app):
            @react_route_decorator.route("/{env}/dummy", authorize=True)
            def test_react_route(enviroenv: str):
                return create_test_route_response(env)
            response = test_react_route(env=ALLOWED_ENV)
            assert_unauthenticated_response(response)


def test_react_authentication_decorator_unauthenticated_invalid_auth0_secret():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        request = create_test_request(create_test_authtoken_invalid_auth0_secret())
        app = MockChaliceApp(request)
        with mock.patch.object(react_route_decorator, "app", app):
            @react_route_decorator.route("/{env}/dummy", authorize=True)
            def test_react_route(env: str):
                return create_test_route_response(env)
            response = test_react_route(env=ALLOWED_ENV)
            assert_unauthenticated_response(response)


def test_react_authentication_decorator_unauthenticated_munged():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        request = create_test_request(create_test_authtoken_munged())
        app = MockChaliceApp(request)
        with mock.patch.object(react_route_decorator, "app", app):
            @react_route_decorator.route("/{env}/dummy", authorize=True)
            def test_react_route(env: str):
                return create_test_route_response(env)
            response = test_react_route(env=ALLOWED_ENV)
            assert_unauthenticated_response(response)
