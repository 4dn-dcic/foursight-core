from unittest import mock
from foursight_core.react.api.jwt_utils import jwt_decode
from foursight_core.react.api import envs
from foursight_core.react.api import gac
from test_react_auth_defs import (
    ALLOWED_ENV,
    ALLOWED_ENVS,
    AUTH0_CLIENT_ID,
    AUTH0_SECRET,
    AUTH,
    DEFAULT_ENV,
    DISALLOWED_ENV,
    DOMAIN,
    EMAIL,
    EXPIRES_AT,
    EXPIRED_AT,
    FIRST_NAME,
    LAST_NAME,
    ISSUED_AT,
    KNOWN_ENVS,
    create_test_authtoken_expired,
    create_test_authtoken_good,
    create_test_authtoken_invalid_auth0_secret,
    create_test_authtoken_munged,
    create_test_jwt,
    create_test_jwt_unencoded,
    create_test_request,
    mock_foursight_env_name,
    mock_short_env_name
)


def assert_authorized_response(response):
    assert response["authenticated"] == True
    assert response["authenticated_at"] == ISSUED_AT
    assert response["authenticated_until"] == EXPIRES_AT
    assert response["user"] == EMAIL
    assert response["user_verified"] == True
    assert response["first_name"] == FIRST_NAME
    assert response["last_name"] == LAST_NAME
    assert response["known_envs"] == KNOWN_ENVS
    assert response["allowed_envs"] == ALLOWED_ENVS
    assert response["default_env"] == DEFAULT_ENV
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
    authtoken_decoded = AUTH.decode_authtoken(authtoken)
    assert_authorized_response(authtoken_decoded)


def test_react_authorize():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            authtoken = create_test_authtoken_good()
            request = create_test_request(authtoken)
            response = AUTH.authorize(request, ALLOWED_ENV)
            assert_authorized_response(response)


def test_react_authorize_unauthorized():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            authtoken = create_test_authtoken_good()
            request = create_test_request(authtoken)
            response = AUTH.authorize(request, DISALLOWED_ENV) # Note disallowed env
            assert_unauthorized_response(response)


def test_react_authorize_expired():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            authtoken = create_test_authtoken_expired()
            request = create_test_request(authtoken)
            response = AUTH.authorize(request, ALLOWED_ENV)
            assert_unauthenticated_response(response)


def test_react_authorize_invalid_auth0_secret():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            authtoken = create_test_authtoken_invalid_auth0_secret()
            request = create_test_request(authtoken)
            response = AUTH.authorize(request, ALLOWED_ENV)
            assert_unauthenticated_response(response)


def test_react_authorize_munged():
    with mock.patch.object(envs, "foursight_env_name", mock_foursight_env_name):
        with mock.patch.object(gac, "short_env_name", mock_short_env_name):
            authtoken = create_test_authtoken_munged()
            request = create_test_request(authtoken)
            response = AUTH.authorize(request, ALLOWED_ENV)
            assert_unauthenticated_response(response)
