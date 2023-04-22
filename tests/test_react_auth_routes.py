from unittest import mock
from foursight_core.react.api import auth as auth_module
from foursight_core.react.api import envs
from foursight_core.react.api import gac
from foursight_core.react.api import react_route_decorator
from foursight_core.react.api.react_api import ReactApi
from test_react_auth_defs import (
    ALLOWED_ENV,
    DISALLOWED_ENV,
    create_test_authtoken_expired,
    create_test_authtoken_good,
    create_test_authtoken_invalid_auth0_secret,
    create_test_authtoken_munged,
    create_test_request,
    mock_foursight_env_name,
    mock_short_env_name,
    MockChaliceApp
)


def create_test_route_response_body(env: str):
    return {"env": env, "react-response-property": "react-response-value"}


def create_test_route_response(env: str):
    with mock.patch.object(auth_module, "app", MockChaliceApp()):
        response = ReactApi.create_success_response()
        response.body = create_test_route_response_body(env)
        return response


def assert_authorized_response(response, env: str):
    assert response.status_code == 200
    assert response.body == create_test_route_response_body(env)


def assert_unauthenticated_response(response):
    assert response.status_code == 401
    assert response.body["authenticated"] is False
    assert response.body["authorized"] is False


def assert_unauthorized_response(response):
    assert response.status_code == 403
    assert response.body["authenticated"] is True
    assert response.body["authorized"] is False


def test_react_authentication_decorator_good():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            request = create_test_request(create_test_authtoken_good())
            with mock.patch.object(react_route_decorator, "app", MockChaliceApp(request)):

                @react_route_decorator.route("/{env}/dummy", authorize=True)
                def test_react_route(env: str):
                    return create_test_route_response(env)

                response = test_react_route(env=ALLOWED_ENV)
                assert_authorized_response(response, ALLOWED_ENV)


def test_react_authentication_decorator_unauthorized():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            request = create_test_request(create_test_authtoken_good())
            with mock.patch.object(react_route_decorator, "app", MockChaliceApp(request)):

                @react_route_decorator.route("/{env}/dummy", authorize=True)
                def test_react_route(env: str):
                    return create_test_route_response(env)

                response = test_react_route(env=DISALLOWED_ENV)  # Note disallowed env
                assert_unauthorized_response(response)


def test_react_authentication_decorator_unauthenticated_expired():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            request = create_test_request(create_test_authtoken_expired())
            with mock.patch.object(react_route_decorator, "app", MockChaliceApp(request)):

                @react_route_decorator.route("/{env}/dummy", authorize=True)
                def test_react_route(env: str):
                    return create_test_route_response(env)

                response = test_react_route(env=ALLOWED_ENV)
                assert_unauthenticated_response(response)


def test_react_authentication_decorator_unauthenticated_invalid_auth0_secret():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            request = create_test_request(create_test_authtoken_invalid_auth0_secret())

            @react_route_decorator.route("/{env}/dummy", authorize=True)
            def test_react_route(env: str):
                return create_test_route_response(env)

            with mock.patch.object(react_route_decorator, "app", MockChaliceApp(request)):
                with mock.patch.object(auth_module, "app", MockChaliceApp()):
                    response = test_react_route(env=ALLOWED_ENV)
                    assert_unauthenticated_response(response)


def test_react_authentication_decorator_unauthenticated_munged():
    with mock.patch.object(auth_module, "app", MockChaliceApp()):
        with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
            with mock.patch.object(gac, "short_env_name", mock_short_env_name):
                request = create_test_request(create_test_authtoken_munged())
                with mock.patch.object(react_route_decorator, "app", MockChaliceApp(request)):
                    @react_route_decorator.route("/{env}/dummy", authorize=True)
                    def test_react_route(env: str):
                        return create_test_route_response(env)
                    response = test_react_route(env=ALLOWED_ENV)
                    assert_unauthenticated_response(response)
