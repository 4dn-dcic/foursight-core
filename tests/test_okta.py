"""Offline auth tests. Run with --confcutdir=tests (root setup purges an AWS queue)."""
import copy
from http.cookies import SimpleCookie
import json
import time
from types import SimpleNamespace
from unittest.mock import Mock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from foursight_core.app_utils import AppUtils
from foursight_core.react.api import auth as auth_module, okta
from foursight_core.react.api.auth import Auth
from foursight_core.react.api.auth0_config import Auth0Config
from foursight_core.react.api.react_api import ReactApi
from foursight_core.react.api.jwt_utils import jwt_decode

ISSUER = "https://synthetic.okta.invalid/oauth2/default"
CLIENT = "synthetic-spa"
SECRET = "synthetic-server-signing-key-not-an-okta-client-secret"


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setenv("FOURSIGHT_OKTA_ISSUER", ISSUER)
    monkeypatch.setenv("FOURSIGHT_OKTA_CLIENT_ID", CLIENT)
    monkeypatch.setenv("FOURSIGHT_SESSION_SECRET", SECRET)
    for key in ("CLIENT_SECRET", "CLIENT_ID", "ENCODED_AUTH0_SECRET", "ENCODED_AUTH0_CLIENT", "REDIS_HOST"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr("requests.sessions.Session.request", Mock(side_effect=AssertionError("Network forbidden")))
    monkeypatch.setattr("boto3.session.Session.client", Mock(side_effect=AssertionError("AWS forbidden")))


@pytest.fixture
def key(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    client = SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=key.public_key()))
    monkeypatch.setattr(okta, "jwks_client", lambda issuer: client)
    return key


def token(key, **changes):
    now = int(time.time())
    claims = dict(iss=ISSUER, aud=CLIENT, sub="synthetic-user", iat=now, exp=now + 3600,
                  nonce="nonce", email="synthetic@example.invalid", email_verified=True)
    claims.update(changes)
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "synthetic-key"})


def request(path="/api/okta/session", origin="https://foursight.invalid"):
    return {"headers": {"host": "foursight.invalid", "origin": origin}, "context": {"path": path}}


def cookies(response):
    jar = SimpleCookie()
    for value in response.headers.get("Set-Cookie", []):
        jar.load(value)
    return jar


@pytest.fixture
def core(monkeypatch):
    envs = SimpleNamespace(get_user_auth_info=lambda email: (["allowed"], "Synthetic", "User"),
                           get_known_envs=lambda: ["allowed", "denied"], get_default_env=lambda: "allowed",
                           is_allowed_env=lambda env, allowed: env in allowed, is_known_env=lambda env: True)
    config = Auth0Config("https://portal.invalid")
    config.get_config_data.cache_clear() if hasattr(config.get_config_data, "cache_clear") else None
    core = SimpleNamespace(_auth0_config=config, _auth=Auth(CLIENT, SECRET, envs), APP_PACKAGE_NAME="foursight",
                           get_site_name=lambda: "foursight-test",
                           create_redirect_response=ReactApi.create_redirect_response,
                           create_success_response=ReactApi.create_success_response)
    monkeypatch.setattr(auth_module, "app", SimpleNamespace(core=core))
    return core


def establish(core, key):
    req = request()
    transaction = okta.handle(core, req, "transaction")
    req["headers"]["cookie"] = cookies(transaction).output(header="", sep=";").strip()
    payload = {"idToken": token(key, nonce=transaction.body["nonce"]), "csrf": transaction.body["csrf"]}
    return req, payload


def test_public_config_and_exact_paths():
    config = okta.public_config(request())
    assert config["redirectUri"] == "https://foursight.invalid/api/okta/callback"
    assert config["postLogoutRedirectUri"] == "https://foursight.invalid/api/okta/signed-out"
    assert set(config) == {"enabled", "issuer", "clientId", "scopes", "baseUrl", "redirectUri", "postLogoutRedirectUri"}
    assert SECRET not in json.dumps(config)
    assert okta.public_config(request("/stage/okta/config"))["redirectUri"].endswith("/stage/okta/callback")
    assert okta.public_config(request("/okta/config"))["redirectUri"].endswith(".invalid/okta/callback")


def test_local_paths(monkeypatch):
    monkeypatch.setattr(okta, "is_running_locally", lambda req: True)
    req = request()
    req["headers"]["host"] = "localhost:8000"
    assert okta.public_config(req)["redirectUri"] == "http://localhost:8000/api/okta/callback"


@pytest.mark.parametrize("setting,value", [
    ("FOURSIGHT_OKTA_ISSUER", "http://example.invalid"),
    ("FOURSIGHT_OKTA_ISSUER", ISSUER + "/"), ("FOURSIGHT_OKTA_ISSUER", ISSUER + "?q=x"),
    ("FOURSIGHT_OKTA_CLIENT_ID", ""), ("FOURSIGHT_OKTA_SCOPES", "openid"),
    ("FOURSIGHT_OKTA_SCOPES", "openid email offline_access")])
def test_invalid_config_fails_closed(monkeypatch, setting, value):
    monkeypatch.setenv(setting, value)
    assert okta.handle(None, request(), "config").status_code == 403


def test_legacy_template_keeps_auth0_fallback_and_shared_okta_entry():
    import jinja2
    templates = jinja2.Environment(loader=jinja2.FileSystemLoader('foursight_core/templates'), autoescape=True)
    for enabled in (False, True):
        rendered = templates.get_template('header.html').render(
            okta_enabled=enabled, context='/api/', request=request('/api/view/synthetic'),
            is_admin=False, user_record={'error': None}, logged_in_as={}, environments=[],
            env='synthetic', domain='foursight.invalid')
        assert 'onclick="foursight_login();"' in rendered
        if enabled:
            assert '/api/okta/login' in rendered and '/api/okta/logout' in rendered
            assert 'new Auth0Lock' not in rendered
        else:
            assert 'new Auth0Lock' in rendered and 'create_redir_cookie(); lock.show();' in rendered


def test_old_provider_when_absent(monkeypatch):
    monkeypatch.delenv("FOURSIGHT_OKTA_ISSUER")
    monkeypatch.delenv("FOURSIGHT_OKTA_CLIENT_ID")
    assert okta.public_config(request()) == {"enabled": False}
    assert okta.handle(None, request(), "transaction").status_code == 404
    monkeypatch.setenv("CLIENT_ID", "old-client")
    monkeypatch.setenv("CLIENT_SECRET", "old-secret")
    config = Auth0Config("https://portal.invalid")
    assert config.get_client() == "old-client"
    assert config.get_secret() == "old-secret"
    assert config.get_callback_url(request()).endswith("/api/callback/?react")


def test_public_provider_config_and_cognito_are_backward_compatible(core, monkeypatch):
    monkeypatch.delenv("FOURSIGHT_OKTA_ISSUER")
    monkeypatch.delenv("FOURSIGHT_OKTA_CLIENT_ID")
    result = ReactApi.reactapi_auth0_config(core, request('/api/reactapi/auth0_config'))
    assert result.body['okta'] == {'enabled': False}
    assert result.body['callback'].endswith('/api/callback/?react')
    assert 'callback' not in core._auth0_config.get_config_data()
    config = {'callback': 'https://foursight.invalid/api/react/cognito/callback'}
    monkeypatch.setattr('foursight_core.react.api.react_api.get_cognito_oauth_config', lambda req: config)
    assert ReactApi.reactapi_cognito_config(core, request()).body == config


def test_verify_real_rsa_id_token(key):
    assert okta.verify_id_token(token(key), "nonce")["email"] == "synthetic@example.invalid"


@pytest.mark.parametrize("changes", [
    dict(iss="https://other.invalid"), dict(aud="resource"),
    dict(aud=[CLIENT, "other"]), dict(exp=1), dict(iat=int(time.time()) + 3600), dict(nonce="wrong"),
    dict(email_verified=False), dict(email_verified="true"), dict(email=""), dict(email=None),
    dict(sub=""), dict(azp="other"), dict(scp=["openid"]), dict(cid=CLIENT), dict(token_use="access"),
    dict(exp=str(int(time.time()) + 3600))])
def test_invalid_token_claims(key, changes):
    with pytest.raises((jwt.PyJWTError, ValueError)):
        okta.verify_id_token(token(key, **changes), "nonce")


def test_wrong_signature_algorithm_and_missing_claims(key):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(jwt.InvalidSignatureError):
        okta.verify_id_token(token(other), "nonce")
    with pytest.raises(ValueError):
        okta.verify_id_token(jwt.encode({"email": "x"}, SECRET, algorithm="HS256"), "nonce")
    claims = jwt.decode(token(key), options={"verify_signature": False})
    del claims["nonce"]
    with pytest.raises(jwt.MissingRequiredClaimError):
        okta.verify_id_token(jwt.encode(claims, key, algorithm="RS256"), "nonce")


@pytest.mark.parametrize("origin", [None, "null", "https://attacker.invalid", "http://foursight.invalid"])
def test_csrf_origin_rejected(core, origin):
    for operation in ("transaction", "session", "logout"):
        assert okta.handle(core, request(origin=origin), operation, {}).status_code == 403


def test_backend_session_both_ui_contracts_and_warm_restoration(core, key, monkeypatch):
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 200
    jar = cookies(result)
    assert jar["c4_st"]["httponly"] and jar["c4_st"]["secure"]
    assert jar["c4_st"]["samesite"] == "Lax"
    assert payload["idToken"] not in str(result.body) + str(result.headers)
    identity = jwt_decode(jar["c4_st"].value, CLIENT, SECRET)
    assert identity["email_verified"] is True
    assert identity["sub"] == "okta|synthetic-user"
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    assert core._auth.authorize(req, "allowed")["authorized"] is True
    assert core._auth.authorize(req, "denied")["authorized"] is False
    assert core._auth.authorize(copy.deepcopy(req), "allowed")["authorized"] is True  # document reload
    # The legacy reader sees the exact existing signed identity contract.
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda env: SimpleNamespace(get_redis_base=lambda: None)
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    assert legacy.get_decoded_jwt_token("allowed", req)["email"] == identity["email"]
    logout = okta.handle(core, req, "logout")
    assert logout.status_code == 200
    for name in ("c4_st", "authtoken", okta.TRANSACTION_COOKIE):
        assert cookies(logout)[name].value == ""
    req["headers"]["cookie"] = ""
    assert core._auth.authorize(req, "allowed")["authenticated"] is False


def test_session_requires_matching_transaction_and_nonce(core, key):
    req, payload = establish(core, key)
    assert okta.handle(core, request(), "session", payload).status_code == 403
    assert okta.handle(core, req, "session", dict(payload, csrf="wrong")).status_code == 403
    assert okta.handle(core, req, "session", dict(payload, idToken=token(key))).status_code == 403
    req["headers"]["cookie"] = f'{okta.TRANSACTION_COOKIE}=' + jwt.encode(
        {"aud": okta.TRANSACTION_AUDIENCE, "exp": 1, "nonce": "nonce", "csrf": "csrf"}, SECRET, algorithm="HS256")
    assert okta.handle(core, req, "session", payload).status_code == 403


def test_redis_session_and_logout_preserve_namespace_and_ttl(core, key, monkeypatch):
    from dcicutils.redis_utils import RedisBase
    from dcicutils.redis_tools import RedisSessionToken
    storage = {}
    redis = Mock(spec=RedisBase)
    redis.set.side_effect = lambda name, value, exp=None: storage.update({name: value}) or True
    redis.get.side_effect = lambda name: storage.get(name)
    redis.ttl.return_value = 10800
    redis.delete.side_effect = lambda name: storage.pop(name, None)
    core._auth._redis = redis
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 200
    jar = cookies(result)
    assert not jar["c4_st"].value.startswith("ey")
    assert redis.set.call_args.kwargs["exp"] == RedisSessionToken(
        namespace="foursight", jwt="synthetic", email="synthetic@example.invalid").get_expiration()
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    assert core._auth.authorize(req, "allowed")["authorized"] is True
    assert okta.handle(core, req, "logout").status_code == 200
    assert core._auth.authorize(req, "allowed")["authenticated"] is False


def test_errors_do_not_reflect_credentials(core, key):
    req, payload = establish(core, key)
    payload["idToken"] = "SYNTHETIC-SECRET-SENTINEL"
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    assert "SENTINEL" not in str(result.body) + str(result.headers)
    assert result.headers["Cache-Control"] == "no-store"


def test_no_role_grants_for_unknown_user(core, key):
    core._auth._envs.get_user_auth_info = lambda email: ([], None, None)
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    jar = cookies(result)
    claims = core._auth.decode_authtoken(jar["authtoken"].value)
    assert claims["allowed_envs"] == []
    assert claims["authenticated_until"] == jwt.decode(payload["idToken"], options={"verify_signature": False})["exp"]


def test_legacy_portal_role_policy_unchanged(core, key, monkeypatch):
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    req["headers"]["cookie"] = "c4_st=" + cookies(result)["c4_st"].value
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda *args: SimpleNamespace(get_redis_base=lambda: None, ff_keys={})
    legacy.init_environments = lambda env: {env: {}}
    legacy.set_user_record = Mock()
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    for groups, permitted in [([], False), (["user"], False), (["foursight"], True), (["admin"], True)]:
        monkeypatch.setattr("foursight_core.app_utils.ff_utils.get_metadata", lambda *a, **kw: {"groups": groups})
        assert legacy.check_authorization(req, "allowed") is permitted


def test_react_logout_routes_through_shared_bridge(core):
    result = ReactApi.reactapi_logout(core, request("/api/reactapi/logout"), None)
    assert result.headers["Location"] == "https://foursight.invalid/api/okta/logout"


def test_cold_worker_and_unavailable_redis_fail_closed(core, key, monkeypatch):
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    jar = cookies(result)
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    monkeypatch.setenv("REDIS_HOST", "redis://synthetic.invalid")
    core._auth.get_redis_handler = Mock(return_value=None)
    assert core._auth.authorize(req, "allowed")["authenticated"] is False
    core._auth.get_redis_handler.assert_called_once()
    assert okta.handle(core, req, "session", payload).status_code == 403
    logout = okta.handle(core, req, "logout")
    assert logout.status_code == 403
    assert cookies(logout)["c4_st"].value == ""
    assert cookies(logout)["authtoken"].value == ""


def test_generated_bridge_is_served_by_actual_static_whitelist():
    from foursight_core.react.api.react_ui import ReactUi
    result = ReactUi(ReactApi).serve_static_file("okta-auth.js", [])
    assert result.status_code == 200
    assert result.headers["Content-Type"] == "text/javascript"
    assert "code_challenge" in result.body


def test_actual_chalice_route_methods_and_content_types():
    from foursight_core.app import app
    from foursight_core.route_prefixes import ROUTE_PREFIX
    routes = app.routes[ROUTE_PREFIX + "okta/{operation}"]
    assert set(routes) == {"GET", "POST"}
    assert routes["POST"].content_types == ["application/json"]
    assert not routes["POST"].cors


def test_discovery_checks_issuer_and_uses_expiring_jwks_cache(monkeypatch):
    # Real PyJWKClient, synthetic discovery transport only.
    metadata = {"issuer": ISSUER, "jwks_uri": ISSUER + "/v1/keys"}
    get = Mock(return_value=SimpleNamespace(raise_for_status=lambda: None, json=lambda: metadata))
    monkeypatch.setattr(okta.requests, "get", get)
    okta.jwks_client.cache_clear()
    client = okta.jwks_client(ISSUER)
    assert client.timeout == 5
    assert not hasattr(client.get_signing_key, "cache_info")  # no indefinite per-key LRU
    assert okta.jwks_client(ISSUER) is client
    assert get.call_count == 1
    assert get.call_args.kwargs["timeout"] == 5
    okta.jwks_client.cache_clear()
    metadata["issuer"] = "https://other.invalid"
    with pytest.raises(ValueError):
        okta.jwks_client(ISSUER)
    okta.jwks_client.cache_clear()
