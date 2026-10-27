"""Public SPA authentication bridge shared by the legacy and React UIs.

The browser owns PKCE/state and code redemption; the server independently verifies
ID tokens and binds session creation to a short-lived, same-origin transaction.
No Okta secret, provider token, or authorization code enters a Foursight session.
"""
import datetime
from functools import lru_cache
import hmac
import os
import secrets
import time
from urllib.parse import urlsplit

from chalice import Response
from jinja2 import Environment, PackageLoader, select_autoescape
import jwt
import requests
from dcicutils.redis_tools import RedisSessionToken, SESSION_TOKEN_COOKIE

from ...app import app
from .auth import Auth, AUTH_TOKEN_COOKIE
from .cookie_utils import create_set_cookie_string, read_cookie
from .jwt_utils import jwt_encode
from .misc_utils import is_running_locally

TRANSACTION_COOKIE = "foursight_okta_transaction"
TRANSACTION_AUDIENCE = "foursight-okta-transaction"

# Chalice owns the handler/level used by the deployed application.
logger = app.log
# Names, never exception messages, inputs, arbitrary claim names or tracebacks.
# Unknown/custom exception names are also excluded (they can contain user data).
_DIAGNOSTIC_EXCEPTIONS = frozenset({
    "ValueError", "TypeError", "KeyError", "AttributeError", "RuntimeError",
    "InvalidTokenError", "DecodeError", "InvalidSignatureError", "ExpiredSignatureError",
    "InvalidAudienceError", "InvalidIssuerError", "InvalidIssuedAtError", "ImmatureSignatureError",
    "InvalidAlgorithmError", "MissingRequiredClaimError", "InvalidKeyError", "InvalidSubjectError",
    "PyJWKClientError", "PyJWKClientConnectionError", "PyJWKError", "PyJWKSetError",
    "ConnectionError", "ConnectionTimeout", "Timeout", "TimeoutError", "ReadTimeout",
    "ConnectTimeout", "SSLError", "HTTPError", "URLError", "RedisException", "ClientError",
    "OktaValidationError", "BadRequestError"
})
_DIAGNOSTIC_REASONS = frozenset({
    "configuration", "discovery_metadata", "id_token_input", "token_header", "token_audience",
    "token_type", "token_authorized_party", "token_nonce", "token_lifetime", "email_policy",
    "email_identity", "token_subject", "session_store_unavailable", "missing_session_signing_key",
    "invalid_request", "csrf_mismatch", "disabled", "origin", "unknown_operation",
    "missing_email_verified", "missing_required_claim"
})
_DIAGNOSTIC_OPERATIONS = frozenset({
    "config", "login", "callback", "logout", "signed-out", "transaction", "session"
})
_DIAGNOSTIC_STAGES = frozenset({
    "route_get", "route_post", "request_parse", "page", "configuration", "origin",
    "logout_session_store", "session_configuration", "transaction_create", "request",
    "transaction_verify", "csrf", "id_token_verify", "identity_normalize", "session_sign",
    "authtoken_create", "session_store", "response"
})


class Diagnostic:
    """Fixed vocabulary only; timings contain no request or identity data.

    Route failures are observed and re-raised unchanged. Controller failures keep
    the existing generic response. No exception object reaches the log handler.
    """

    def __init__(self, operation, stage):
        self.operation = operation if operation in _DIAGNOSTIC_OPERATIONS else "unknown"
        self.started = self.stage_started = time.monotonic()
        self.current = "unknown"
        self.stage(stage)

    def emit(self, outcome, status=0, reason="unspecified", error=None):
        exception = "none"
        if error is not None:
            exception = type(error).__name__
            if exception not in _DIAGNOSTIC_EXCEPTIONS:
                exception = "OtherError"
            if isinstance(error, OktaValidationError):
                reason = error.reason
            elif isinstance(error, jwt.MissingRequiredClaimError):
                reason = "missing_email_verified" if error.claim == "email_verified" else "missing_required_claim"
        reason = reason if isinstance(reason, str) and reason in _DIAGNOSTIC_REASONS else "unspecified"
        now = time.monotonic()
        # Chalice defaults to ERROR with debug=False. Use its configured handler
        # without lowering the app's level (which could expose unrelated logs).
        logger.error(
            "Okta diagnostic: operation=%s stage=%s outcome=%s status=%s exception=%s reason=%s "
            "elapsed_ms=%d stage_ms=%d",
            self.operation, self.current, outcome if outcome in ("enter", "pass", "return", "reject") else "unknown",
            status if type(status) is int and status in (0, 200, 400, 403, 404, 500) else 0,
            exception, reason, max(0, int((now - self.started) * 1000)),
            max(0, int((now - self.stage_started) * 1000)))

    def stage(self, stage):
        if self.current != "unknown":
            self.emit("pass")
        self.current = stage if stage in _DIAGNOSTIC_STAGES else "unknown"
        self.stage_started = time.monotonic()
        self.emit("enter")

    def complete(self, result, reason="unspecified", error=None):
        self.emit("reject" if result.status_code >= 400 else "return", result.status_code, reason, error)
        return result

    def response(self, body, status=200, cookies=None, reason="unspecified", error=None):
        return self.complete(response(body, status, cookies), reason, error)

    def __enter__(self):
        return self

    def __exit__(self, error_type, error, traceback):
        if error is not None:
            # Chalice owns conversion to its existing HTTP error response.
            from chalice import BadRequestError
            self.emit("reject", 400 if isinstance(error, BadRequestError) else 500, error=error)
        return False


class OktaValidationError(ValueError):
    """An existing ValueError rejection with a fixed, credential-free reason."""

    def __init__(self, reason, message):
        super().__init__(message)
        self.reason = reason


def settings():
    """Identity/GAC is applied to os.environ at app startup, as for Auth0."""
    issuer = os.environ.get("FOURSIGHT_OKTA_ISSUER", "")
    client = os.environ.get("FOURSIGHT_OKTA_CLIENT_ID", "")
    if not issuer and not client:
        return None
    parsed = urlsplit(issuer)
    scopes = os.environ.get("FOURSIGHT_OKTA_SCOPES", "openid email profile").split()
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or issuer.endswith("/") or not client
            or not {"openid", "email"}.issubset(scopes) or "offline_access" in scopes):
        raise OktaValidationError("configuration", "Invalid Okta SPA configuration")
    return {"issuer": issuer, "clientId": client, "scopes": scopes}


def base_url(request):
    """API Gateway's actual stage/base path, or the explicit local /api prefix."""
    headers = request.get("headers", {})
    path = request.get("context", {}).get("path", "")
    if "/okta/" in path:
        prefix = path.split("/okta/", 1)[0]
    elif "/reactapi/" in path:
        prefix = path.split("/reactapi/", 1)[0]
    else:
        prefix = "/api"
    if not prefix.startswith("/") or "//" in prefix:
        prefix = ""
    scheme = "http" if is_running_locally(request) else "https"
    return f"{scheme}://{headers.get('host')}{prefix}"


def public_config(request):
    config = settings()
    if config is None:
        return {"enabled": False}
    base = base_url(request)
    return dict(config, enabled=True, baseUrl=base,
                redirectUri=base + "/okta/callback", postLogoutRedirectUri=base + "/okta/signed-out")


def same_origin(request):
    origin = request.get("headers", {}).get("origin")
    base = urlsplit(base_url(request))
    return origin == f"{base.scheme}://{base.netloc}"


@lru_cache(maxsize=8)
def jwks_client(issuer):
    response = requests.get(issuer + "/.well-known/openid-configuration", timeout=5)
    response.raise_for_status()
    metadata = response.json()
    keys = urlsplit(metadata.get("jwks_uri", ""))
    if (metadata.get("issuer") != issuer or keys.scheme != "https" or not keys.hostname
            or keys.username or keys.password or keys.fragment):
        raise OktaValidationError("discovery_metadata", "Invalid Okta discovery")
    # No indefinite per-key cache: key withdrawal is bounded by the JWKS-set TTL.
    return jwt.PyJWKClient(metadata["jwks_uri"], timeout=5, lifespan=300, cache_keys=False)


def email_is_acceptable(claims):
    """Shared Okta email policy; only the exact deployment value 'false' opts out.

    Omission is unverified, not malformed; preserve it in Foursight sessions.
    Call only for verified Okta tokens or their signed, normalized identities.
    """
    verified = claims.get("email_verified", False)
    return verified is True or (
        verified is False and os.environ.get("FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL") == "false")


def verify_id_token(token, nonce):
    config = settings()
    if not config or not isinstance(token, str) or len(token) > 20000:
        raise OktaValidationError("id_token_input", "Invalid ID token")
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "RS256" or header.get("typ", "JWT") != "JWT":
        raise OktaValidationError("token_header", "Invalid ID token type")
    key = jwks_client(config["issuer"]).get_signing_key_from_jwt(token).key
    required_claims = ["iss", "aud", "sub", "iat", "exp", "nonce", "email"]
    if not email_is_acceptable({}):  # Strict policy requires the claim as well as boolean true.
        required_claims.append("email_verified")
    claims = jwt.decode(token, key, algorithms=["RS256"], audience=config["clientId"],
                        issuer=config["issuer"], options={"require": required_claims})
    # Okta access tokens carry scp/cid and target a resource audience, not this SPA.
    # Require the single client audience and nonce even if a resource is misconfigured.
    # Preserve the original rejection order/conditions; split only to classify
    # the known failing boundary without logging any claim name or value.
    if claims.get("aud") != config["clientId"]:
        raise OktaValidationError("token_audience", "Invalid ID token claims")
    if "scp" in claims or "cid" in claims or claims.get("token_use", "id") != "id":
        raise OktaValidationError("token_type", "Invalid ID token claims")
    if claims.get("azp", config["clientId"]) != config["clientId"]:
        raise OktaValidationError("token_authorized_party", "Invalid ID token claims")
    if not isinstance(claims.get("nonce"), str) or not hmac.compare_digest(claims["nonce"], nonce):
        raise OktaValidationError("token_nonce", "Invalid ID token claims")
    if (type(claims.get("iat")) is not int or type(claims.get("exp")) is not int
            or claims["exp"] <= claims["iat"]):
        raise OktaValidationError("token_lifetime", "Invalid ID token claims")
    if not email_is_acceptable(claims):
        raise OktaValidationError("email_policy", "Invalid ID token claims")
    if not isinstance(claims.get("email"), str) or not claims["email"].strip():
        raise OktaValidationError("email_identity", "Invalid ID token claims")
    if not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise OktaValidationError("token_subject", "Invalid ID token claims")
    return claims


def cookie(request, name, value="", expires=None, http_only=True):
    # Match existing domain/path so logout also removes pre-migration cookies.
    return create_set_cookie_string(request, name, value, request["headers"]["host"],
                                    expires=expires, http_only=http_only)


def response(body, status=200, cookies=None):
    headers = {"Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer"}
    if cookies:
        headers["Set-Cookie"] = cookies
    return Response(body=body, status_code=status, headers=headers)


def session_store(core):
    redis = core._auth.get_redis_handler()
    if core._auth.get_redis_url() and not redis:
        raise OktaValidationError("session_store_unavailable", "Session store unavailable")
    return redis


def handle(core, request, operation, body=None):
    """All mutating endpoints require an exact Origin and JSON (no CORS)."""
    # Assigned only fixed literals below, never the caller's operation/path.
    diagnostic = Diagnostic(operation, "configuration")
    try:
        if operation == "config":
            return diagnostic.response(public_config(request))
        if not settings():
            return diagnostic.response({"error": "Okta is not enabled."}, 404, reason="disabled")
        diagnostic.stage("origin")
        if not same_origin(request):
            return diagnostic.response({"error": "Forbidden."}, 403, reason="origin")
        if operation == "logout":
            diagnostic.stage("logout_session_store")
            redis = session_store(core)
            if redis:
                session = RedisSessionToken.from_redis(
                    redis_handler=redis, namespace=Auth.get_redis_namespace(None),
                    token=read_cookie(request, SESSION_TOKEN_COOKIE))
                if session:
                    session.delete_session_token(redis_handler=redis)
            return diagnostic.response({"loggedOut": True}, cookies=[cookie(request, name, expires=1)
                                       for name in [AUTH_TOKEN_COOKIE, SESSION_TOKEN_COOKIE, TRANSACTION_COOKIE]])
        diagnostic.stage("session_configuration")
        secret = core._auth0_config.get_secret()
        if not secret:
            raise OktaValidationError("missing_session_signing_key", "No server session signing key")
        if operation == "transaction":
            diagnostic.stage("transaction_create")
            now = int(time.time())
            transaction = {"nonce": secrets.token_urlsafe(32), "csrf": secrets.token_urlsafe(32),
                           "iat": now, "exp": now + 600}
            encoded = jwt_encode(transaction, TRANSACTION_AUDIENCE, secret)
            return diagnostic.response({"nonce": transaction["nonce"], "csrf": transaction["csrf"]},
                                       cookies=[cookie(request, TRANSACTION_COOKIE, encoded, now + 600)])
        diagnostic.stage("request")
        if operation != "session" or not isinstance(body, dict):
            raise OktaValidationError("invalid_request", "Invalid request")
        diagnostic.stage("transaction_verify")
        transaction = jwt.decode(read_cookie(request, TRANSACTION_COOKIE), secret, algorithms=["HS256"],
                                 audience=TRANSACTION_AUDIENCE, options={"require": ["exp", "nonce", "csrf"]})
        diagnostic.stage("csrf")
        csrf = body.get("csrf")
        if not isinstance(csrf, str) or not hmac.compare_digest(csrf, transaction["csrf"]):
            raise OktaValidationError("csrf_mismatch", "Invalid transaction")
        diagnostic.stage("id_token_verify")
        claims = verify_id_token(body.get("idToken"), transaction["nonce"])
        diagnostic.stage("identity_normalize")
        # Normalize only validated identity claims; never invent a verification flag.
        # Expiry is the provider expiry, never a fresh sliding lifetime.
        identity = {key: claims[key] for key in ("sub", "email", "iat", "exp")}
        if "email_verified" in claims:
            identity["email_verified"] = claims["email_verified"]
        identity["sub"] = "okta|" + identity["sub"]
        diagnostic.stage("session_sign")
        signed = jwt_encode(identity, core._auth0_config.get_client(), secret)
        domain = request["headers"]["host"]
        diagnostic.stage("authtoken_create")
        authtoken, email = core._auth.create_authtoken(signed, claims["exp"], domain, request=request)
        c4_st = signed
        expires = claims["exp"]
        diagnostic.stage("session_store")
        redis = session_store(core)
        if redis:
            session = RedisSessionToken(namespace=Auth.get_redis_namespace(None), jwt=signed, email=email)
            session.store_session_token(redis_handler=redis)
            c4_st = session.get_session_token()
            expires = datetime.datetime.utcnow() + session.get_expiration()
        diagnostic.stage("response")
        return diagnostic.response({"authenticated": True}, cookies=[
            cookie(request, AUTH_TOKEN_COOKIE, authtoken, claims["exp"], http_only=False),
            cookie(request, SESSION_TOKEN_COOKIE, c4_st, expires),
            cookie(request, TRANSACTION_COOKIE, expires=1)])
    except Exception as error:
        # Never reflect IdP errors, tokens, codes, claim values or exception text.
        names = [TRANSACTION_COOKIE]
        if operation == "logout" and same_origin(request):
            names += [AUTH_TOKEN_COOKIE, SESSION_TOKEN_COOKIE]
        return diagnostic.response({"error": "Unable to complete Okta authentication."}, 403,
                                   cookies=[cookie(request, name, expires=1) for name in names], error=error)


@lru_cache(maxsize=1)
def _page_template():
    return Environment(loader=PackageLoader("foursight_core", "templates"),
                       autoescape=select_autoescape(["html"])).get_template("okta.html")


def page(request, operation, package=None):
    # Match the existing app themes without loading user/session/header metadata.
    themes = {"foursight": ("fourfront", "4DN"), "foursight-cgap": ("cgap", "CGAP"),
              "foursight-smaht": ("smaht", "SMaHT")}
    theme, brand = themes.get(package, ("default", ""))
    result = response(_page_template().render(base=base_url(request), signed_out=operation == "signed-out",
                                              theme=theme, brand=brand))
    result.headers["Content-Type"] = "text/html; charset=utf-8"
    return result
