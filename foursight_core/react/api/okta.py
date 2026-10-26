"""Public SPA authentication bridge shared by the legacy and React UIs.

The browser owns PKCE/state and code redemption; the server independently verifies
ID tokens and binds session creation to a short-lived, same-origin transaction.
No Okta secret, provider token, or authorization code enters a Foursight session.
"""
import datetime
from functools import lru_cache
import html
import hmac
import os
import secrets
import time
from urllib.parse import urlsplit

from chalice import Response
import jwt
import requests
from dcicutils.redis_tools import RedisSessionToken, SESSION_TOKEN_COOKIE

from .auth import Auth, AUTH_TOKEN_COOKIE
from .cookie_utils import create_set_cookie_string, read_cookie
from .jwt_utils import jwt_encode
from .misc_utils import is_running_locally

TRANSACTION_COOKIE = "foursight_okta_transaction"
TRANSACTION_AUDIENCE = "foursight-okta-transaction"


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
        raise ValueError("Invalid Okta SPA configuration")
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
        raise ValueError("Invalid Okta discovery")
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
        raise ValueError("Invalid ID token")
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "RS256" or header.get("typ", "JWT") != "JWT":
        raise ValueError("Invalid ID token type")
    key = jwks_client(config["issuer"]).get_signing_key_from_jwt(token).key
    required_claims = ["iss", "aud", "sub", "iat", "exp", "nonce", "email"]
    if not email_is_acceptable({}):  # Strict policy requires the claim as well as boolean true.
        required_claims.append("email_verified")
    claims = jwt.decode(token, key, algorithms=["RS256"], audience=config["clientId"],
                        issuer=config["issuer"], options={"require": required_claims})
    # Okta access tokens carry scp/cid and target a resource audience, not this SPA.
    # Require the single client audience and nonce even if a resource is misconfigured.
    if (claims.get("aud") != config["clientId"] or "scp" in claims or "cid" in claims
            or claims.get("token_use", "id") != "id"
            or claims.get("azp", config["clientId"]) != config["clientId"]
            or not isinstance(claims.get("nonce"), str) or not hmac.compare_digest(claims["nonce"], nonce)
            or type(claims.get("iat")) is not int or type(claims.get("exp")) is not int
            or claims["exp"] <= claims["iat"]
            or not email_is_acceptable(claims) or not isinstance(claims.get("email"), str)
            or not claims["email"].strip() or not isinstance(claims.get("sub"), str) or not claims["sub"]):
        raise ValueError("Invalid ID token claims")
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
    if os.environ.get("REDIS_HOST") and not redis:
        raise ValueError("Session store unavailable")
    return redis


def handle(core, request, operation, body=None):
    """All mutating endpoints require an exact Origin and JSON (no CORS)."""
    try:
        if operation == "config":
            return response(public_config(request))
        if not settings():
            return response({"error": "Okta is not enabled."}, 404)
        if not same_origin(request):
            return response({"error": "Forbidden."}, 403)
        if operation == "logout":
            redis = session_store(core)
            if redis:
                session = RedisSessionToken.from_redis(
                    redis_handler=redis, namespace=Auth.get_redis_namespace(None),
                    token=read_cookie(request, SESSION_TOKEN_COOKIE))
                if session:
                    session.delete_session_token(redis_handler=redis)
            return response({"loggedOut": True}, cookies=[cookie(request, name, expires=1)
                            for name in [AUTH_TOKEN_COOKIE, SESSION_TOKEN_COOKIE, TRANSACTION_COOKIE]])
        secret = core._auth0_config.get_secret()
        if not secret:
            raise ValueError("No server session signing key")
        if operation == "transaction":
            now = int(time.time())
            transaction = {"nonce": secrets.token_urlsafe(32), "csrf": secrets.token_urlsafe(32),
                           "iat": now, "exp": now + 600}
            encoded = jwt_encode(transaction, TRANSACTION_AUDIENCE, secret)
            return response({"nonce": transaction["nonce"], "csrf": transaction["csrf"]},
                            cookies=[cookie(request, TRANSACTION_COOKIE, encoded, now + 600)])
        if operation != "session" or not isinstance(body, dict):
            raise ValueError("Invalid request")
        transaction = jwt.decode(read_cookie(request, TRANSACTION_COOKIE), secret, algorithms=["HS256"],
                                 audience=TRANSACTION_AUDIENCE, options={"require": ["exp", "nonce", "csrf"]})
        csrf = body.get("csrf")
        if not isinstance(csrf, str) or not hmac.compare_digest(csrf, transaction["csrf"]):
            raise ValueError("Invalid transaction")
        claims = verify_id_token(body.get("idToken"), transaction["nonce"])
        # Normalize only validated identity claims; never invent a verification flag.
        # Expiry is the provider expiry, never a fresh sliding lifetime.
        identity = {key: claims[key] for key in ("sub", "email", "iat", "exp")}
        if "email_verified" in claims:
            identity["email_verified"] = claims["email_verified"]
        identity["sub"] = "okta|" + identity["sub"]
        signed = jwt_encode(identity, core._auth0_config.get_client(), secret)
        domain = request["headers"]["host"]
        authtoken, email = core._auth.create_authtoken(signed, claims["exp"], domain, request=request)
        c4_st = signed
        expires = claims["exp"]
        redis = session_store(core)
        if redis:
            session = RedisSessionToken(namespace=Auth.get_redis_namespace(None), jwt=signed, email=email)
            session.store_session_token(redis_handler=redis)
            c4_st = session.get_session_token()
            expires = datetime.datetime.utcnow() + session.get_expiration()
        return response({"authenticated": True}, cookies=[
            cookie(request, AUTH_TOKEN_COOKIE, authtoken, claims["exp"], http_only=False),
            cookie(request, SESSION_TOKEN_COOKIE, c4_st, expires),
            cookie(request, TRANSACTION_COOKIE, expires=1)])
    except Exception:
        # Never reflect IdP errors, tokens, codes, claim values or exception text.
        names = [TRANSACTION_COOKIE]
        if operation == "logout" and same_origin(request):
            names += [AUTH_TOKEN_COOKIE, SESSION_TOKEN_COOKIE]
        return response({"error": "Unable to complete Okta authentication."}, 403,
                        cookies=[cookie(request, name, expires=1) for name in names])


def page(request, operation):
    base = base_url(request)
    if operation == "signed-out":
        content = '<h1>Signed out</h1><a href="' + html.escape(base + '/react', quote=True) + '">Foursight</a>'
    else:
        content = ('<h1 id="status">Completing sign-in…</h1><a id="retry" hidden href="'
                   + html.escape(base + '/react', quote=True) + '">Return to Foursight</a>'
                   + '<script src="' + html.escape(base + '/react/okta-auth.js', quote=True) + '" defer></script>')
    result = response('<!doctype html><html><head><meta charset="utf-8"><title>Foursight authentication</title>'
                      '<meta name="referrer" content="no-referrer"></head><body>' + content + '</body></html>')
    result.headers["Content-Type"] = "text/html; charset=utf-8"
    return result
