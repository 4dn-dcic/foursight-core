"""Offline bootstrap regressions; run with --confcutdir=tests (no root AWS fixtures)."""
from io import BytesIO
import json
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.error import HTTPError

import pytest

from dcicutils import s3_utils
from foursight_core import app_utils, environment
from foursight_core.app import app
from foursight_core.react.api import auth0_config, okta
from foursight_core.react.api.jwt_utils import jwt_encode

PORTAL = "https://synthetic-portal.invalid"
CLIENT = "synthetic-spa"
SECRET = "synthetic-bootstrap-session-key-not-a-real-secret"


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    for name in ("CLIENT_ID", "CLIENT_SECRET", "ENCODED_AUTH0_CLIENT", "ENCODED_AUTH0_SECRET", "REDIS_HOST"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ENV_NAME", "synthetic")
    monkeypatch.setenv("FOURSIGHT_OKTA_ISSUER", "https://synthetic.okta.invalid/oauth2/default")
    monkeypatch.setenv("FOURSIGHT_OKTA_CLIENT_ID", CLIENT)
    monkeypatch.setenv("FOURSIGHT_SESSION_SECRET", SECRET)
    monkeypatch.setattr(auth0_config, "PULL_AUTH0_INFO_FROM_PORTAL", False)
    for target in ("boto3.session.Session.client", "boto3.session.Session.resource",
                   "requests.sessions.Session.request", "urllib.request.urlopen", "socket.create_connection"):
        monkeypatch.setattr(target, Mock(side_effect=AssertionError("External I/O forbidden")))
    app_utils.AppUtilsCore.get_portal_url.cache_clear()
    auth0_config.Auth0Config.get_config_data.cache_clear()
    auth0_config.Auth0Config.get_config_raw_data.cache_clear()
    yield
    app_utils.AppUtilsCore.get_portal_url.cache_clear()
    auth0_config.Auth0Config.get_config_data.cache_clear()
    auth0_config.Auth0Config.get_config_raw_data.cache_clear()


@pytest.mark.parametrize("portal_url", [None, ""])
def test_optional_portal_url_uses_environment_credentials(portal_url):
    config = auth0_config.Auth0Config(portal_url)
    assert config.get_portal_url() == portal_url
    assert config.get_portal_config_url() is None
    assert config.get_client() == CLIENT
    assert config.get_secret() == SECRET
    assert config.get_config_raw_data() == {}  # No HTTP request for the unused URL.


@pytest.mark.parametrize("portal_url", [None, ""])
def test_required_portal_url_remains_required(monkeypatch, portal_url):
    monkeypatch.setattr(auth0_config, "PULL_AUTH0_INFO_FROM_PORTAL", True)
    with pytest.raises(ValueError, match="Portal URL required"):
        auth0_config.Auth0Config(portal_url)


@pytest.mark.parametrize("portal_url", [PORTAL, PORTAL + "/"])
@pytest.mark.parametrize("required", [False, True])
def test_configured_portal_url_construction_unchanged(monkeypatch, portal_url, required):
    monkeypatch.setattr(auth0_config, "PULL_AUTH0_INFO_FROM_PORTAL", required)
    config = auth0_config.Auth0Config(portal_url)
    assert config.get_portal_url() == portal_url
    assert config.get_portal_config_url() == PORTAL + "/auth0_config?format=json"


@pytest.mark.parametrize("variables,client,secret", [
    ({"CLIENT_ID": "local-client", "ENCODED_AUTH0_CLIENT": "gac-client",
      "CLIENT_SECRET": "local-secret", "ENCODED_AUTH0_SECRET": "gac-secret"}, "local-client", "local-secret"),
    ({"ENCODED_AUTH0_CLIENT": "gac-client", "ENCODED_AUTH0_SECRET": "gac-secret"}, "gac-client", "gac-secret"),
    ({}, CLIENT, SECRET)])
def test_optional_url_preserves_credential_precedence(monkeypatch, variables, client, secret):
    for name, value in variables.items():
        monkeypatch.setenv(name, value)
    config = auth0_config.Auth0Config(None)
    assert config.get_client() == client
    assert config.get_secret() == secret


@pytest.fixture
def bootstrap(monkeypatch):
    """Real singleton/React/Auth0 chain; only cloud/check setup is synthetic."""
    monkeypatch.setattr(app, "core", None, raising=False)
    monkeypatch.setattr(app_utils.AppUtilsCore, "_singleton", None)
    monkeypatch.setattr(app_utils.AppUtilsCore, "DEFAULT_ENV", "synthetic", raising=False)
    monkeypatch.setattr(app_utils, "Stage", lambda *args: SimpleNamespace(get_stage=lambda: "prod"))
    monkeypatch.setattr(app_utils, "SQS", lambda *args: SimpleNamespace())
    monkeypatch.setattr(app_utils, "CheckHandler", lambda *args: SimpleNamespace(
        CHECK_SETUP={}, CheckResult=object, ActionResult=object))
    monkeypatch.setattr(app_utils.AppUtilsCore, "_locate_check_setup_file", lambda *args: "synthetic-check-setup")
    monkeypatch.setattr(environment.Environment, "__init__", lambda self, *args: setattr(self, "prefix", "synthetic"))
    monkeypatch.setattr(environment.Environment, "list_unique_environment_names", lambda self: ["synthetic"])
    monkeypatch.setattr(environment, "get_foursight_bucket", lambda **kwargs: "synthetic-results")
    for name in ("short_env_name", "full_env_name", "public_env_name"):
        monkeypatch.setattr(app_utils, name, lambda value: value)
    monkeypatch.setattr(app_utils, "infer_foursight_from_env", lambda envname: envname)
    monkeypatch.setattr(s3_utils, "full_env_name", lambda value: value)
    monkeypatch.setattr(s3_utils, "get_env_real_url", lambda value: PORTAL)

    def s3_init(self, *args, **kwargs):
        self.url = PORTAL
        self._health_json_url = None
        self._health_json = None

    # Keep real synthetic-env resolution, health parsing, get_portal_url and
    # caching. Do not mock resolve_auth0_config or Auth0Config itself.
    monkeypatch.setattr(s3_utils.s3Utils, "__init__", s3_init)
    state = {"response": 200, "calls": 0}

    def urlopen(url, *args, **kwargs):
        assert url == PORTAL + "/health?format=json"
        state["calls"] += 1
        if state["response"] == 200:
            return BytesIO(json.dumps({"elasticsearch": "https://synthetic-es.invalid:443"}).encode())
        if state["response"] == "invalid-json":
            return BytesIO(b"invalid synthetic response")
        raise HTTPError(PORTAL, state["response"], "synthetic health failure", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    return state


@pytest.mark.parametrize("health", [200, 403, 404, 503, "invalid-json"])
def test_bootstrap_health_failure_cannot_crash_optional_auth_config(bootstrap, health):
    bootstrap["response"] = health
    core = app_utils.AppUtilsCore.singleton()
    assert core is app.core
    assert bootstrap["calls"] == (1 if health == 200 else 2)  # Failed URL is not cached.
    assert core._auth0_config.get_portal_url() == (PORTAL if health == 200 else None)
    assert core._auth0_config.get_client() == CLIENT
    assert core._auth0_config.get_secret() == SECRET
    # Actual environment-based session signer/validator, not an invented grant.
    payload = {"exp": 4102444800, "authenticated": True}
    signed = jwt_encode(payload, CLIENT, SECRET)
    assert core._auth.decode_authtoken(signed)["authenticated"] is True
    with pytest.raises(Exception, match="Signature verification failed"):
        core._auth.decode_authtoken(jwt_encode(payload, CLIENT, "wrong-synthetic-signing-key"))
    req = {"headers": {"host": "foursight.invalid", "origin": "https://foursight.invalid"},
           "context": {"path": "/api/okta/transaction"}}
    assert okta.handle(core, req, "transaction").status_code == 200
    rejected = okta.handle(core, req, "session", {})
    assert rejected.status_code == 403
    assert rejected.body == {"error": "Unable to complete Okta authentication."}


def test_bootstrap_required_portal_mode_still_fails_closed(bootstrap, monkeypatch):
    bootstrap["response"] = 403
    monkeypatch.setattr(auth0_config, "PULL_AUTH0_INFO_FROM_PORTAL", True)
    with pytest.raises(ValueError, match="Portal URL required"):
        app_utils.AppUtilsCore.singleton()
    assert bootstrap["calls"] == 2


@pytest.mark.parametrize("redis_host", [None, "disabled", "redis://synthetic.invalid", "rediss://synthetic.invalid"])
@pytest.mark.parametrize("groups", [["foursight"], ["admin"], ["user"]])
def test_smaht_0811_session_routes_restore_and_logout(bootstrap, monkeypatch, redis_host, groups):
    """Actual downstream subclass/bootstrap/routes; only external services are fixtures."""
    import importlib
    import importlib.metadata
    from http.cookies import SimpleCookie
    from chalice import Response
    from chalice.test import Client
    from cryptography.hazmat.primitives.asymmetric import rsa
    from dcicutils.redis_tools import RedisBase
    from foursight_core import fs_connection
    from foursight_core.react.api import auth, envs
    from foursight_core.route_prefixes import ROUTE_PREFIX
    from test_okta import token

    pytest.importorskip("chalicelib_smaht")
    assert importlib.metadata.version("foursight-smaht") == "0.8.11"
    monkeypatch.setenv("ES_HOST", "https://synthetic-es.invalid")
    monkeypatch.setattr("foursight_core.identity.apply_identity_globally", lambda: None)
    downstream = importlib.import_module("chalicelib_smaht.app_utils")
    core = app_utils.AppUtilsCore.singleton(downstream.AppUtils)
    assert type(core) is downstream.AppUtils
    assert app.core is core and core.APP_PACKAGE_NAME == "foursight-smaht"
    if redis_host is not None:
        monkeypatch.setenv("REDIS_HOST", redis_host)

    # Real handler selection on a cold worker; synthetic Redis transport only.
    storage = {}
    redis = Mock(spec=RedisBase)
    redis.set.side_effect = lambda name, value, exp=None: storage.update({name: value}) or True
    redis.get.side_effect = lambda name: storage.get(name)
    redis.ttl.return_value = 10800
    redis.delete.side_effect = lambda name: int(storage.pop(name, None) is not None)
    factory = Mock(return_value=redis)
    monkeypatch.setattr(auth, "create_redis_client", factory)
    monkeypatch.setattr(auth, "RedisBase", lambda client: client)
    monkeypatch.setattr(fs_connection, "create_redis_client", factory)
    monkeypatch.setattr(fs_connection, "RedisBase", lambda client: client)
    monkeypatch.setattr(fs_connection, "S3Connection", lambda *args: None)
    monkeypatch.setattr(fs_connection, "full_env_name", lambda name: name)
    monkeypatch.setattr(fs_connection, "is_stg_or_prd_env", lambda name: False)
    connection = fs_connection.FSConnection(
        "synthetic", dict(fourfront=PORTAL, ff_env="synthetic", es="synthetic-es", bucket="synthetic"),
        test=True, use_es=False)
    monkeypatch.setattr(core, "init_connection", lambda *args: connection)
    monkeypatch.setattr(core, "init_environments", lambda name: {name: {}})
    monkeypatch.setattr(envs, "foursight_env_name", lambda name: name)
    monkeypatch.setattr(core._envs, "get_known_envs_with_gac_names", core._envs.get_known_envs)
    # Keep both real Envs and legacy user/group authorization, not a grant stub.
    monkeypatch.setattr(app_utils.ff_utils, "get_metadata", lambda *args, **kwargs: {"groups": groups})
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(okta, "jwks_client", lambda issuer: SimpleNamespace(
        get_signing_key_from_jwt=lambda encoded: SimpleNamespace(key=key.public_key())))
    # Endpoints still execute their actual auth guards; only protected content is a stub.
    monkeypatch.setattr(core, "reactapi_info", lambda *args: Response(body={"protected": True}))
    monkeypatch.setattr(core, "view_run_check", lambda *args: Response(body={"protected": True}))
    jar = SimpleCookie()

    def send(client, method, path, body=None):
        headers = {"host": "foursight.invalid", "origin": "http://foursight.invalid",
                   "content-type": "application/json",
                   "cookie": "; ".join(f"{name}={m.value}" for name, m in jar.items() if m.value)}
        result = client.http.request(method, ROUTE_PREFIX + path, headers=headers,
                                     body=json.dumps(body) if body is not None else None)
        values = result.headers.get("set-cookie", result.headers.get("Set-Cookie", []))
        for value in values if isinstance(values, list) else [values]:
            jar.load(value)
        return result

    paths = ["reactapi/synthetic/info", "view_run/synthetic/check/check"]
    with Client(app) as client:
        assert all(send(client, "GET", path).status_code != 200 for path in paths)
        transaction = send(client, "POST", "okta/transaction", {})
        assert transaction.status_code == 200
        payload = dict(idToken=token(key, nonce=transaction.json_body["nonce"]),
                       csrf=transaction.json_body["csrf"])
        result = send(client, "POST", "okta/session", payload)
        assert result.status_code == 200
        use_redis = redis_host in ("redis://synthetic.invalid", "rediss://synthetic.invalid")
        assert bool(factory.call_count) is use_redis
        if not use_redis:
            assert core._auth.decode_authtoken(jar["authtoken"].value)["authentication"] == "okta"
            assert jar["c4_st"].value.count(".") == 2
        for cold in (False, True):
            if cold:
                core._auth._redis = None  # Separate worker must select the same mode.
            for path in paths:
                response = send(client, "GET", path)
                assert response.status_code == (200 if groups != ["user"] else 403)
        result = send(client, "POST", "okta/logout", {})
        assert result.status_code == 200
        for name in ("c4_st", "authtoken", okta.TRANSACTION_COOKIE):
            assert jar[name].value == ""
        assert not storage
        assert all(send(client, "GET", path).status_code != 200 for path in paths)


def test_warm_singleton_and_successful_url_cache_mask_later_health_failure(bootstrap):
    core = app_utils.AppUtilsCore.singleton()
    assert bootstrap["calls"] == 1
    bootstrap["response"] = 403
    assert app_utils.AppUtilsCore.singleton() is core
    assert core.get_portal_url("synthetic") == PORTAL
    assert bootstrap["calls"] == 1
