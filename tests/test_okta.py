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
OMITTED = object()


@pytest.fixture(autouse=True)
def offline(monkeypatch, caplog):
    # Chalice intentionally does not propagate to root; capture directly without
    # modifying its production level or replacing the real stream handler.
    monkeypatch.setattr(okta.logger, "handlers", [*okta.logger.handlers, caplog.handler])
    monkeypatch.setenv("FOURSIGHT_OKTA_ISSUER", ISSUER)
    monkeypatch.setenv("FOURSIGHT_OKTA_CLIENT_ID", CLIENT)
    monkeypatch.setenv("FOURSIGHT_SESSION_SECRET", SECRET)
    for key in ("CLIENT_SECRET", "CLIENT_ID", "ENCODED_AUTH0_SECRET", "ENCODED_AUTH0_CLIENT", "REDIS_HOST",
                "FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL"):
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
    claims = {name: value for name, value in claims.items() if value is not OMITTED}
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


def establish(core, key, **claims):
    req = request()
    transaction = okta.handle(core, req, "transaction")
    req["headers"]["cookie"] = cookies(transaction).output(header="", sep=";").strip()
    payload = {"idToken": token(key, nonce=transaction.body["nonce"], **claims), "csrf": transaction.body["csrf"]}
    return req, payload


@pytest.mark.parametrize("which_token,which_csrf,status", [
    ("first", "first", 403), ("first", "current", 403),
    ("current", "first", 403), ("current", "current", 200)])
def test_concurrent_bridge_records_cannot_mix_server_cookie_bindings(core, key, which_token, which_csrf, status):
    # Two independent snapshots, not a browser applying an earlier rejection's
    # cookie deletion: the single server transaction cookie still selects only
    # the latest nonce/CSRF pair, even if both client state records are retained.
    _, first = establish(core, key)
    req, current = establish(core, key)
    payloads = {"first": first, "current": current}
    result = okta.handle(core, req, "session", {
        "idToken": payloads[which_token]["idToken"], "csrf": payloads[which_csrf]["csrf"]})
    assert result.status_code == status
    assert result.body == ({"authenticated": True} if status == 200 else
                           {"error": "Unable to complete Okta authentication."})


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
@pytest.mark.parametrize("opt_out", [False, True])
def test_invalid_token_claims(key, changes, monkeypatch, opt_out):
    if opt_out:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
        if changes == dict(email_verified=False):
            assert okta.verify_id_token(token(key, **changes), "nonce")["email_verified"] is False
            return
    with pytest.raises((jwt.PyJWTError, ValueError)):
        okta.verify_id_token(token(key, **changes), "nonce")


@pytest.mark.parametrize("setting", [None, "true", "", "0", "False", "false", "typo"])
def test_unverified_email_session_requires_explicit_opt_out(core, key, monkeypatch, setting):
    if setting is not None:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", setting)
    req, payload = establish(core, key, email_verified=False)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == (200 if setting == "false" else 403)
    if setting != "false":
        assert "c4_st" not in cookies(result)
        assert "authtoken" not in cookies(result)
    # This is server policy, not browser-editable configuration.
    assert "requireVerifiedEmail" not in okta.public_config(req)


@pytest.mark.parametrize("setting", [None, "true", "", "0", "False", "false", "typo"])
def test_omitted_email_verified_session_requires_explicit_opt_out(core, key, monkeypatch, setting):
    if setting is not None:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", setting)
    req, payload = establish(core, key, email_verified=OMITTED)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == (200 if setting == "false" else 403)
    if setting == "false":
        identity = jwt_decode(cookies(result)["c4_st"].value, CLIENT, SECRET)
        assert "email_verified" not in identity  # Never manufacture verified status.
        auth = core._auth.decode_authtoken(cookies(result)["authtoken"].value)
        assert auth["user_verified"] is None
        assert auth["user"] == identity["email"] == "synthetic@example.invalid"
    else:
        assert result.body == {"error": "Unable to complete Okta authentication."}
        assert "c4_st" not in cookies(result)
        assert "authtoken" not in cookies(result)


@pytest.mark.parametrize("verified", [
    pytest.param(OMITTED, id="omitted"), True, False, None, "true", "false", "", 0, 1, 0.0, 1.0, [], [True], {}])
@pytest.mark.parametrize("opt_out", [False, True])
def test_session_email_claim_matrix(core, key, monkeypatch, verified, opt_out):
    if opt_out:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=verified)
    result = okta.handle(core, req, "session", payload)
    accepted = verified is True or (opt_out and (verified is False or verified is OMITTED))
    assert result.status_code == (200 if accepted else 403)
    if not accepted:
        assert "c4_st" not in cookies(result)
        assert "authtoken" not in cookies(result)


@pytest.mark.parametrize("failure", ["issuer", "audience", "signature", "expiry", "nonce", "csrf", "email"])
def test_omitted_email_claim_does_not_bypass_session_validation(core, key, monkeypatch, failure):
    monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=OMITTED)
    claims = jwt.decode(payload["idToken"], options={"verify_signature": False})
    changes = {"issuer": {"iss": "https://other.invalid"}, "audience": {"aud": "other"},
               "expiry": {"exp": 1}, "nonce": {"nonce": "wrong"}, "email": {"email": ""}}
    claims.update(changes.get(failure, {}))
    signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048) if failure == "signature" else key
    payload["idToken"] = jwt.encode(claims, signing_key, algorithm="RS256")
    if failure == "csrf":
        payload["csrf"] = "wrong"
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    assert "c4_st" not in cookies(result)
    assert "authtoken" not in cookies(result)


@pytest.mark.parametrize("opt_out", [False, True])
def test_wrong_signature_algorithm_and_missing_claims(key, monkeypatch, opt_out):
    if opt_out:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(jwt.InvalidSignatureError):
        okta.verify_id_token(token(other), "nonce")
    with pytest.raises(ValueError):
        okta.verify_id_token(jwt.encode({"email": "x"}, SECRET, algorithm="HS256"), "nonce")
    claims = jwt.decode(token(key), options={"verify_signature": False})
    for name in ("nonce", "email", "email_verified"):
        missing = {k: v for k, v in claims.items() if k != name}
        if name == "email_verified" and opt_out:
            assert "email_verified" not in okta.verify_id_token(jwt.encode(missing, key, algorithm="RS256"), "nonce")
            continue
        with pytest.raises(jwt.MissingRequiredClaimError):
            okta.verify_id_token(jwt.encode(missing, key, algorithm="RS256"), "nonce")


@pytest.mark.parametrize("origin", [None, "null", "https://attacker.invalid", "http://foursight.invalid"])
@pytest.mark.parametrize("opt_out", [False, True])
def test_csrf_origin_rejected(core, origin, monkeypatch, opt_out):
    if opt_out:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    for operation in ("transaction", "session", "logout"):
        assert okta.handle(core, request(origin=origin), operation, {}).status_code == 403


@pytest.mark.parametrize("redis_host", [None, "", "disabled", "False"])
@pytest.mark.parametrize("verified", [True, False, pytest.param(OMITTED, id="omitted")])
def test_backend_session_both_ui_contracts_and_warm_restoration(core, key, monkeypatch, verified, redis_host):
    if redis_host is not None:
        monkeypatch.setenv("REDIS_HOST", redis_host)
    if verified is not True:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=verified)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 200
    jar = cookies(result)
    assert jar["c4_st"]["httponly"] and jar["c4_st"]["secure"]
    assert jar["c4_st"]["samesite"] == "Lax"
    assert payload["idToken"] not in str(result.body) + str(result.headers)
    identity = jwt_decode(jar["c4_st"].value, CLIENT, SECRET)
    expected_verified = None if verified is OMITTED else verified
    assert identity.get("email_verified") is expected_verified
    assert core._auth.decode_authtoken(jar["authtoken"].value)["user_verified"] is expected_verified
    assert identity["sub"] == "okta|synthetic-user"
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    assert core._auth.authorize(req, "allowed")["authorized"] is True
    assert core._auth.authorize(req, "denied")["authorized"] is False
    assert core._auth.authorize(copy.deepcopy(req), "allowed")["authorized"] is True  # document reload
    # The legacy reader sees the exact existing signed identity contract.
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda env, **kwargs: SimpleNamespace(get_redis_base=lambda: None)
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    assert legacy.get_decoded_jwt_token("allowed", req)["email"] == identity["email"]
    logout = okta.handle(core, req, "logout")
    assert logout.status_code == 200
    for name in ("c4_st", "authtoken", okta.TRANSACTION_COOKIE):
        assert cookies(logout)[name].value == ""
    req["headers"]["cookie"] = ""
    assert core._auth.authorize(req, "allowed")["authenticated"] is False


@pytest.mark.parametrize("opt_out", [False, True])
def test_session_requires_matching_transaction_and_nonce(core, key, monkeypatch, opt_out):
    if opt_out:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=OMITTED if opt_out else True)
    assert okta.handle(core, request(), "session", payload).status_code == 403
    assert okta.handle(core, req, "session", dict(payload, csrf="wrong")).status_code == 403
    assert okta.handle(core, req, "session", dict(payload, idToken=token(key))).status_code == 403
    req["headers"]["cookie"] = f'{okta.TRANSACTION_COOKIE}=' + jwt.encode(
        {"aud": okta.TRANSACTION_AUDIENCE, "exp": 1, "nonce": "nonce", "csrf": "csrf"}, SECRET, algorithm="HS256")
    assert okta.handle(core, req, "session", payload).status_code == 403


@pytest.mark.parametrize("verified", [True, False, pytest.param(OMITTED, id="omitted")])
def test_redis_session_and_logout_preserve_namespace_and_ttl(core, key, monkeypatch, verified):
    from dcicutils.redis_utils import RedisBase
    from dcicutils.redis_tools import RedisSessionToken
    opaque_token = "ey-synthetic-opaque-session-token"
    monkeypatch.setattr("dcicutils.redis_tools.make_session_token", lambda: opaque_token)
    storage = {}
    redis = Mock(spec=RedisBase)
    redis.set.side_effect = lambda name, value, exp=None: storage.update({name: value}) or True
    redis.get.side_effect = lambda name: storage.get(name)
    redis.ttl.return_value = 10800
    redis.delete.side_effect = lambda name: storage.pop(name, None)
    core._auth._redis = redis
    if verified is not True:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=verified)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 200
    jar = cookies(result)
    # Opaque random tokens may start with 'ey'; check the actual Redis contract.
    assert jar["c4_st"].value == opaque_token
    stored = RedisSessionToken.from_redis(redis_handler=redis, namespace="foursight", token=opaque_token)
    assert jwt_decode(stored.get_jwt(), CLIENT, SECRET)["email"] == "synthetic@example.invalid"
    assert redis.set.call_args.kwargs["exp"] == RedisSessionToken(
        namespace="foursight", jwt="synthetic", email="synthetic@example.invalid").get_expiration()
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    assert core._auth.authorize(req, "allowed")["authorized"] is True
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda env, **kwargs: SimpleNamespace(get_redis_base=lambda: redis)
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    assert legacy.get_decoded_jwt_token("allowed", req)["email"] == "synthetic@example.invalid"
    assert okta.handle(core, req, "logout").status_code == 200
    assert core._auth.authorize(req, "allowed")["authenticated"] is False
    assert legacy.get_decoded_jwt_token("allowed", req) is None


def test_errors_do_not_reflect_credentials(core, key):
    req, payload = establish(core, key)
    payload["idToken"] = "SYNTHETIC-SECRET-SENTINEL"
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    assert "SENTINEL" not in str(result.body) + str(result.headers)
    assert result.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("verified", [True, False, pytest.param(OMITTED, id="omitted")])
def test_no_role_grants_for_unknown_user(core, key, monkeypatch, verified):
    if verified is not True:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    core._auth._envs.get_user_auth_info = lambda email: ([], None, None)
    req, payload = establish(core, key, email_verified=verified)
    result = okta.handle(core, req, "session", payload)
    jar = cookies(result)
    claims = core._auth.decode_authtoken(jar["authtoken"].value)
    assert claims["allowed_envs"] == []
    assert claims["authenticated_until"] == jwt.decode(payload["idToken"], options={"verify_signature": False})["exp"]


@pytest.mark.parametrize("verified", [True, False, pytest.param(OMITTED, id="omitted")])
def test_legacy_portal_role_policy_unchanged(core, key, monkeypatch, verified):
    if verified is not True:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=verified)
    result = okta.handle(core, req, "session", payload)
    req["headers"]["cookie"] = "c4_st=" + cookies(result)["c4_st"].value
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda *args, **kwargs: SimpleNamespace(get_redis_base=lambda: None, ff_keys={})
    legacy.init_environments = lambda env: {env: {}}
    legacy.set_user_record = Mock()
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    for groups, permitted in [([], False), (["user"], False), (["foursight"], True), (["admin"], True)]:
        monkeypatch.setattr("foursight_core.app_utils.ff_utils.get_metadata", lambda *a, **kw: {"groups": groups})
        assert legacy.check_authorization(req, "allowed") is permitted
    if verified is not True:
        # An Okta-only exception must not relax the existing Auth0 email gate.
        identity = jwt_decode(cookies(result)["c4_st"].value, CLIENT, SECRET)
        legacy.get_decoded_jwt_token = lambda *args: dict(identity, sub="auth0|synthetic-user")
        assert legacy.check_authorization(req, "allowed") is False
        legacy.get_decoded_jwt_token = lambda *args: identity
        monkeypatch.delenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL")
        assert legacy.check_authorization(req, "allowed") is False


def test_react_logout_routes_through_shared_bridge(core):
    result = ReactApi.reactapi_logout(core, request("/api/reactapi/logout"), None)
    assert result.headers["Location"] == "https://foursight.invalid/api/okta/logout"


@pytest.mark.parametrize("redis_host", ["redis://synthetic.invalid", "rediss://synthetic.invalid"])
def test_cold_worker_and_unavailable_redis_fail_closed(core, key, monkeypatch, caplog, redis_host):
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    jar = cookies(result)
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    # Keep the actual valid transaction cookie: rejection must be at storage,
    # not the earlier missing-transaction branch.
    session_req, session_payload = establish(core, key)
    monkeypatch.setenv("REDIS_HOST", redis_host)
    core._auth.get_redis_handler = Mock(return_value=None)
    assert core._auth.authorize(req, "allowed")["authenticated"] is False
    core._auth.get_redis_handler.assert_called_once()
    rejected = okta.handle(core, session_req, "session", session_payload)
    assert rejected.status_code == 403
    assert "c4_st" not in cookies(rejected) and "authtoken" not in cookies(rejected)
    assert "reason=session_store_unavailable" in rejection_records(caplog)[-1].getMessage()
    logout = okta.handle(core, req, "logout")
    assert logout.status_code == 403
    assert cookies(logout)["c4_st"].value == ""
    assert cookies(logout)["authtoken"].value == ""


@pytest.mark.parametrize("redis_host", ["redis://synthetic.invalid", "rediss://synthetic.invalid"])
@pytest.mark.parametrize("error", ["ConnectionError", "TimeoutError"])
def test_selected_redis_connection_failure_is_not_jwt_mode(core, key, monkeypatch, caplog, redis_host, error):
    import redis

    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    jar = cookies(result)
    authenticated = request()
    authenticated["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    monkeypatch.setenv("REDIS_HOST", redis_host)
    factory = Mock(side_effect=getattr(redis.exceptions, error)("synthetic outage"))
    monkeypatch.setattr(auth_module, "create_redis_client", factory)
    assert core._auth.get_redis_handler() is None
    assert core._auth.authorize(authenticated, "allowed")["status"] == "session-store-unavailable"
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    assert "reason=session_store_unavailable" in rejection_records(caplog)[-1].getMessage()
    assert "c4_st" not in cookies(result) and "authtoken" not in cookies(result)
    result = okta.handle(core, authenticated, "logout")
    assert result.status_code == 403
    assert cookies(result)["c4_st"].value == cookies(result)["authtoken"].value == ""
    assert factory.call_count == 4


@pytest.mark.parametrize("failure", ["write", "read", "delete"])
def test_selected_redis_operation_failure_is_not_jwt_mode(core, key, monkeypatch, failure):
    from dcicutils.redis_tools import RedisBase
    from redis.exceptions import ConnectionError

    monkeypatch.setenv("REDIS_HOST", "rediss://synthetic.invalid")
    storage = {}
    redis = Mock(spec=RedisBase)
    redis.set.side_effect = lambda name, value, exp=None: storage.update({name: value}) or True
    redis.get.side_effect = lambda name: storage.get(name)
    redis.ttl.return_value = 10800
    redis.delete.side_effect = lambda name: int(storage.pop(name, None) is not None)
    core._auth._redis = redis
    req, payload = establish(core, key)
    if failure == "write":
        redis.set.side_effect = ConnectionError("synthetic outage")
        result = okta.handle(core, req, "session", payload)
        assert result.status_code == 403
        assert "c4_st" not in cookies(result) and "authtoken" not in cookies(result)
        return
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 200
    jar = cookies(result)
    req["headers"]["cookie"] = "; ".join(f"{name}={jar[name].value}" for name in ("c4_st", "authtoken"))
    assert core._auth.authorize(req, "allowed")["authorized"] is True
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda env, **kwargs: SimpleNamespace(get_redis_base=lambda: redis)
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    if failure == "read":
        redis.get.side_effect = ConnectionError("synthetic outage")
        assert core._auth.authorize(req, "allowed")["authenticated"] is False
        assert legacy.get_decoded_jwt_token("allowed", req) is None
    else:
        redis.delete.side_effect = ConnectionError("synthetic outage")
    result = okta.handle(core, req, "logout")
    assert result.status_code == 403  # No claim of confirmed server revocation.
    assert cookies(result)["c4_st"].value == cookies(result)["authtoken"].value == ""


@pytest.mark.parametrize("invalid", ["signature", "audience", "expiry"])
def test_no_selected_redis_does_not_accept_arbitrary_session_jwt(core, key, monkeypatch, invalid):
    from foursight_core.react.api.jwt_utils import jwt_encode

    monkeypatch.setenv("REDIS_HOST", "disabled")
    req, payload = establish(core, key)
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 200
    jar = cookies(result)
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy.init_connection = lambda env, **kwargs: SimpleNamespace(get_redis_base=lambda: None)
    monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
    changed = {}
    for name in ("c4_st", "authtoken"):
        claims = jwt_decode(jar[name].value, CLIENT, SECRET)
        if invalid == "expiry":
            claims["exp"] = claims["authenticated_until"] = int(time.time()) - 120
        changed[name] = jwt_encode(claims, "wrong-client" if invalid == "audience" else CLIENT,
                                   "wrong-key" if invalid == "signature" else SECRET)
    req["headers"]["cookie"] = "; ".join(f"{name}={value}" for name, value in changed.items())
    assert core._auth.authorize(req, "allowed")["authenticated"] is False
    assert legacy.get_decoded_jwt_token("allowed", req) is None
    # Existing valid cookies cannot substitute for a valid new IdP transaction/token.
    req["headers"]["cookie"] = "; ".join(f"{name}={m.value}" for name, m in jar.items())
    assert okta.handle(core, req, "session", payload).status_code == 403


@pytest.mark.parametrize("redis_host", [None, "", "disabled", "False"])
@pytest.mark.parametrize("ui", ["react", "legacy"])
def test_auth0_no_redis_reference_callback(core, monkeypatch, redis_host, ui):
    """Known-good Auth0 issuance selects JWT mode by handler, not host truthiness."""
    from foursight_core.app import app
    from foursight_core.react.api.jwt_utils import jwt_encode

    if redis_host is not None:
        monkeypatch.setenv("REDIS_HOST", redis_host)
    legacy = object.__new__(AppUtils)
    legacy._auth0_config = core._auth0_config
    legacy._auth = core._auth
    legacy.auth0_domain = "synthetic.auth0.invalid"
    legacy.init_connection = Mock(return_value=SimpleNamespace(get_redis_base=lambda: None, ff_keys={}))
    monkeypatch.setattr(app, "core", legacy, raising=False)
    monkeypatch.setattr(core._auth0_config, "get_domain", lambda: "synthetic.auth0.invalid")
    now = int(time.time())
    signed = jwt_encode(dict(sub="auth0|synthetic", email="synthetic@example.invalid",
                             email_verified=True, iat=now, exp=now + 3600), CLIENT, SECRET)
    post = Mock(return_value=SimpleNamespace(json=lambda: dict(id_token=signed, expires_in=3600)))
    monkeypatch.setattr("requests.post", post)
    req = request("/api/callback/")
    req["query_params"] = {"code": "synthetic-code"}
    if ui == "react":
        req["query_params"]["react"] = ""
    result = legacy.auth0_callback(SimpleNamespace(to_dict=lambda: req), "allowed")
    assert result.status_code == 302
    post.assert_called_once()
    jar = SimpleCookie()
    values = result.headers["Set-Cookie"]
    for value in values if isinstance(values, list) else [values]:
        jar.load(value)
    req["headers"]["cookie"] = "; ".join(f"{name}={m.value}" for name, m in jar.items())
    assert core._auth.get_redis_handler() is None
    if ui == "react":
        # Auth0 has already issued a cryptographically valid signed authtoken.
        assert core._auth.decode_authtoken(jar["authtoken"].value)["authenticated"] is True
        assert core._auth.authorize(req, "allowed")["authorized"] is True
    else:
        monkeypatch.setattr("foursight_core.app_utils.full_env_name", lambda env: env)
        assert legacy.get_decoded_jwt_token("allowed", req)["sub"] == "auth0|synthetic"
        assert all(call.kwargs == {"use_es": False} for call in legacy.init_connection.call_args_list)


def rejection_records(caplog):
    return [record for record in caplog.records
            if record.name == okta.logger.name and "outcome=reject" in record.getMessage()]


@pytest.mark.parametrize("failure,stage,exception,reason", [
    ("secret", "session_configuration", "OktaValidationError", "missing_session_signing_key"),
    ("body", "request", "OktaValidationError", "invalid_request"),
    ("cookie", "transaction_verify", "DecodeError", "unspecified"),
    ("csrf", "csrf", "OktaValidationError", "csrf_mismatch"),
    ("jwks", "id_token_verify", "PyJWKClientConnectionError", "unspecified"),
    ("normalize", "identity_normalize", "KeyError", "unspecified"),
    ("sign", "session_sign", "RuntimeError", "unspecified"),
    ("authtoken", "authtoken_create", "RuntimeError", "unspecified"),
    ("redis", "session_store", "ConnectionError", "unspecified"),
    ("response", "response", "ValueError", "unspecified"),
    ("custom-exception", "id_token_verify", "OtherError", "unspecified"),
    ("custom-reason", "id_token_verify", "OktaValidationError", "unspecified")])
def test_rejection_diagnostic_stages_never_log_sensitive_data(
        core, key, monkeypatch, caplog, failure, stage, exception, reason):
    sentinel = "PRIVATE-identity-code-token-cookie-header-endpoint-secret"
    req, payload = establish(core, key, email=sentinel + "@example.invalid")
    req["headers"]["x-sensitive-fixture"] = sentinel
    req["context"]["path"] += "?code=" + sentinel
    payload["ignored"] = sentinel
    if failure == "secret":
        monkeypatch.setattr(core._auth0_config, "get_secret", lambda: None)
    elif failure == "body":
        payload = sentinel
    elif failure == "cookie":
        req["headers"]["cookie"] = "foursight_okta_transaction=" + sentinel
    elif failure == "csrf":
        payload["csrf"] = sentinel
    elif failure in ("jwks", "custom-exception"):
        error = (jwt.PyJWKClientConnectionError(sentinel) if failure == "jwks"
                 else type(sentinel, (Exception,), {})(sentinel))
        monkeypatch.setattr(okta, "jwks_client", Mock(side_effect=error))
    elif failure == "custom-reason":
        monkeypatch.setattr(okta, "verify_id_token", Mock(side_effect=okta.OktaValidationError(sentinel, sentinel)))
    elif failure == "normalize":
        monkeypatch.setattr(okta, "verify_id_token", lambda *args: {})
    elif failure == "sign":
        monkeypatch.setattr(okta, "jwt_encode", Mock(side_effect=RuntimeError(sentinel)))
    elif failure == "authtoken":
        monkeypatch.setattr(core._auth, "create_authtoken", Mock(side_effect=RuntimeError(sentinel)))
    elif failure == "redis":
        monkeypatch.setattr(core._auth, "get_redis_handler", Mock(side_effect=ConnectionError(sentinel)))
    elif failure == "response":
        real_cookie = okta.cookie

        def cookie(*args, **kwargs):
            if args[1] == "authtoken":
                raise ValueError(sentinel)
            return real_cookie(*args, **kwargs)

        monkeypatch.setattr(okta, "cookie", cookie)
    caplog.clear()
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    assert result.body == {"error": "Unable to complete Okta authentication."}
    assert set(cookies(result)) == {okta.TRANSACTION_COOKIE}
    records = rejection_records(caplog)
    assert len(records) == 1
    assert (f"operation=session stage={stage} outcome=reject status=403 "
            f"exception={exception} reason={reason} elapsed_ms=") in records[0].getMessage()
    assert records[0].exc_info is None and records[0].stack_info is None
    for private in (sentinel, SECRET, "synthetic@example.invalid", "https://synthetic.okta.invalid"):
        assert private not in caplog.text
    assert "Traceback" not in caplog.text
    if isinstance(payload, dict):
        assert payload["idToken"] not in caplog.text


@pytest.mark.parametrize("changes,reason", [
    ({"aud": [CLIENT, "resource"]}, "token_audience"),
    ({"scp": ["openid"]}, "token_type"),
    ({"cid": CLIENT}, "token_type"),
    ({"token_use": "access"}, "token_type"),
    ({"azp": "PRIVATE-other-client"}, "token_authorized_party"),
    ({"nonce": "PRIVATE-wrong-nonce"}, "token_nonce"),
    ({"iat": str(int(time.time()))}, "token_lifetime"),
    ({"email_verified": False}, "email_policy"),
    ({"email_verified": "PRIVATE-malformed"}, "email_policy"),
    ({"email": ""}, "email_identity"),
    ({"sub": ""}, "token_subject")])
def test_known_claim_rejections_have_safe_specific_reasons(core, key, caplog, changes, reason):
    req, payload = establish(core, key, **{name: value for name, value in changes.items() if name != "nonce"})
    if "nonce" in changes:
        payload["idToken"] = token(key, **changes)
    caplog.clear()
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    assert result.body == {"error": "Unable to complete Okta authentication."}
    records = rejection_records(caplog)
    assert len(records) == 1
    assert ("stage=id_token_verify outcome=reject status=403 "
            f"exception=OktaValidationError reason={reason} elapsed_ms=") in records[0].getMessage()
    assert "PRIVATE" not in caplog.text and payload["idToken"] not in caplog.text


@pytest.mark.parametrize("claim,reason", [
    ("email_verified", "missing_email_verified"),
    ("email", "missing_required_claim"),
    ("PRIVATE-arbitrary-claim-name", "missing_required_claim")])
def test_missing_claim_diagnostic_uses_fixed_reason_codes(core, key, monkeypatch, caplog, claim, reason):
    req, payload = establish(core, key)
    if claim.startswith("PRIVATE"):
        monkeypatch.setattr(okta, "verify_id_token", Mock(side_effect=jwt.MissingRequiredClaimError(claim)))
    else:
        req, payload = establish(core, key, **{claim: OMITTED})
    caplog.clear()
    result = okta.handle(core, req, "session", payload)
    assert result.status_code == 403
    records = rejection_records(caplog)
    assert len(records) == 1
    assert ("stage=id_token_verify outcome=reject status=403 "
            f"exception=MissingRequiredClaimError reason={reason} elapsed_ms=") in records[0].getMessage()
    assert "PRIVATE" not in caplog.text and payload["idToken"] not in caplog.text


@pytest.mark.parametrize("verified,opt_out", [(True, False), (False, True), (OMITTED, True)])
def test_successful_session_has_no_rejection_diagnostic(core, key, monkeypatch, caplog, verified, opt_out):
    if opt_out:
        monkeypatch.setenv("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL", "false")
    req, payload = establish(core, key, email_verified=verified)
    caplog.clear()
    assert okta.handle(core, req, "session", payload).status_code == 200
    assert not rejection_records(caplog)
    assert any("stage=response outcome=return status=200" in record.getMessage() for record in caplog.records)


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


@pytest.mark.parametrize("method,operation,body,status,marker", [
    ("GET", "config", None, 200, "stage=configuration outcome=return status=200"),
    ("GET", "login", None, 200, "stage=page outcome=return status=200"),
    ("GET", "callback", None, 200, "stage=page outcome=return status=200"),
    ("GET", "logout", None, 200, "stage=page outcome=return status=200"),
    ("GET", "signed-out", None, 200, "stage=page outcome=return status=200"),
    ("GET", "PRIVATE-unknown-operation", None, 404, "reason=unknown_operation"),
    ("POST", "PRIVATE-unknown-operation", "{}", 404, "reason=unknown_operation"),
    ("POST", "transaction", "{}", 200, "stage=transaction_create outcome=return status=200"),
    ("POST", "session", "{PRIVATE-invalid-json", 400, "stage=request_parse outcome=reject status=400"),
    ("POST", "session", "{}", 403, "stage=transaction_verify outcome=reject status=403"),
    ("POST", "logout", "{}", 200, "stage=logout_session_store outcome=return status=200")])
def test_actual_chalice_handler_emits_safe_route_markers(
        core, monkeypatch, caplog, method, operation, body, status, marker):
    from io import StringIO
    from chalice.test import Client as ChaliceClient
    from foursight_core.app import app
    from foursight_core.route_prefixes import ROUTE_PREFIX
    stream = StringIO()
    assert okta.logger is app.log
    handlers = [handler for handler in app.log.handlers if handler is not caplog.handler]
    assert handlers  # Actual Chalice wiring, not a mock error or root caplog handler.
    for handler in handlers:
        monkeypatch.setattr(handler, "stream", stream)
    monkeypatch.setattr(app.log, "propagate", False)
    monkeypatch.setattr(app, "core", core, raising=False)
    path = ROUTE_PREFIX + "okta/" + operation + "?code=PRIVATE-code&state=PRIVATE-state"
    with ChaliceClient(app) as client:
        result = client.http.request(method, path,
                                     headers={"host": "foursight.invalid", "origin": "http://foursight.invalid",
                                              "content-type": "application/json", "x-private": "PRIVATE-header",
                                              "cookie": "PRIVATE-cookie"}, body=body)
    assert result.status_code == status
    output = stream.getvalue()
    assert "stage=route_" + method.lower() + " outcome=enter status=0" in output
    assert marker in output
    assert "PRIVATE" not in output and SECRET not in output and ISSUER not in output
    assert "Traceback" not in output


@pytest.mark.parametrize("disabled,origin,reason,status", [
    (True, "https://foursight.invalid", "disabled", 404),
    (False, "https://PRIVATE.invalid", "origin", 403)])
def test_early_rejections_are_visible(core, monkeypatch, caplog, disabled, origin, reason, status):
    if disabled:
        monkeypatch.delenv("FOURSIGHT_OKTA_ISSUER")
        monkeypatch.delenv("FOURSIGHT_OKTA_CLIENT_ID")
    result = okta.handle(core, request(origin=origin), "session", {})
    assert result.status_code == status
    assert len(rejection_records(caplog)) == 1
    assert f"reason={reason}" in rejection_records(caplog)[0].getMessage()
    assert "PRIVATE" not in caplog.text


def test_diagnostic_allowlists_and_elapsed_timings(monkeypatch, caplog):
    import itertools
    ticks = itertools.count(step=0.125)
    monkeypatch.setattr(okta.time, "monotonic", lambda: next(ticks))
    diagnostic = okta.Diagnostic("PRIVATE-operation", "PRIVATE-stage")
    diagnostic.emit("PRIVATE-outcome", "PRIVATE-status", "PRIVATE-reason",
                    type("PRIVATE-exception", (Exception,), {})("PRIVATE-message"))
    diagnostic.stage("csrf")
    diagnostic.response({}, 403, reason="csrf_mismatch")
    records = [r for r in caplog.records if r.name == okta.logger.name]
    assert len(records) == 4  # Unknown stage is not reported as a completed known stage.
    assert "operation=unknown stage=unknown outcome=unknown status=0 exception=OtherError" in records[1].getMessage()
    assert "elapsed_ms=250 stage_ms=125" in records[0].getMessage()
    assert "elapsed_ms=750 stage_ms=250" in records[-1].getMessage()
    assert all(r.exc_info is None and r.stack_info is None for r in records)
    assert "PRIVATE" not in caplog.text


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
