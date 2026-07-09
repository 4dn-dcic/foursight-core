from dcicutils.redis_tools import SESSION_TOKEN_COOKIE

from foursight_core.app_utils import append_session_cookie_security_attributes
from foursight_core.react.api.auth import AUTH_TOKEN_COOKIE
from foursight_core.react.api.cookie_utils import create_set_cookie_string
from test_react_auth_defs import DOMAIN


def test_create_set_cookie_string_adds_production_security_attributes():
    request = {"headers": {"host": DOMAIN}}

    cookie = create_set_cookie_string(request, name=AUTH_TOKEN_COOKIE, value="token", domain=DOMAIN)

    assert "Secure;" in cookie
    assert "SameSite=Lax;" in cookie
    assert "HttpOnly;" not in cookie


def test_create_set_cookie_string_adds_httponly_to_session_cookie_when_requested():
    request = {"headers": {"host": DOMAIN}}

    cookie = create_set_cookie_string(request, name=SESSION_TOKEN_COOKIE, value="token",
                                      domain=DOMAIN, http_only=True)

    assert "Secure;" in cookie
    assert "SameSite=Lax;" in cookie
    assert "HttpOnly;" in cookie


def test_create_set_cookie_string_does_not_force_secure_for_local_http():
    request = {
        "headers": {"host": "localhost:8000"},
        "context": {"identity": {"sourceIp": "127.0.0.1"}}
    }

    cookie = create_set_cookie_string(request, name=SESSION_TOKEN_COOKIE, value="token",
                                      domain="localhost", http_only=True)

    assert "Secure;" not in cookie
    assert "SameSite=Lax;" in cookie
    assert "HttpOnly;" in cookie


def test_legacy_session_cookie_attributes_include_httponly_and_secure_in_production():
    cookie = append_session_cookie_security_attributes("c4_st=token; Domain=example.org; Path=/;",
                                                       running_locally=False)

    assert "Secure;" in cookie
    assert "SameSite=Lax;" in cookie
    assert "HttpOnly;" in cookie


def test_legacy_session_cookie_attributes_do_not_force_secure_for_local_http():
    cookie = append_session_cookie_security_attributes("c4_st=token; Path=/;",
                                                       running_locally=True)

    assert "Secure;" not in cookie
    assert "SameSite=Lax;" in cookie
    assert "HttpOnly;" in cookie
