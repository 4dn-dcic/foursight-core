# Okta SPA login (React and legacy Foursight)

Okta is **opt-in**. Without `FOURSIGHT_OKTA_ISSUER` and
`FOURSIGHT_OKTA_CLIENT_ID`, the existing Auth0 login and optional Cognito flow
remain in place. No identity application, AWS resource, secret, or deployment
is created by this code.

## Configuration and operator prerequisites

Supply these through the existing Global Application Configuration (GAC)
loading path (`foursight_core/identity.py` applies GAC values to the environment),
or as environment variables for local development. These keys retain their
names; no new Secrets Manager lookup happens on a login request.

| Setting | Value |
| --- | --- |
| `FOURSIGHT_OKTA_ISSUER` | Exact HTTPS issuer, **no trailing slash**, e.g. `https://example.okta.com/oauth2/default` or the org issuer `https://example.okta.com`. |
| `FOURSIGHT_OKTA_CLIENT_ID` | Public SPA application's client ID. |
| `FOURSIGHT_OKTA_SCOPES` | Space-separated scopes; default `openid email profile`. Must include `openid email`. `offline_access` is deliberately not supported: this flow does not introduce refresh/renewal policy. |
| `FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL` | Server-only policy, enforced by default. Only the exact string `false` permits an Okta ID token with boolean `email_verified: false` or an omitted verification claim; malformed values still fail. See the temporary exception below. |
| `FOURSIGHT_SESSION_SECRET` | Server-only signing key for the existing HMAC session contract, needed only when the existing `CLIENT_SECRET` / `ENCODED_AUTH0_SECRET` is absent. Use an independently generated high-entropy application signing key, **not an Okta client secret**. Never expose it to the browser. |

Existing Auth0 session-signing credentials take precedence when present, so
adding Okta does not invalidate those sessions or change Cognito's signing
contract. In an Okta-only installation the internal session audience defaults
to the SPA client ID. Keep the server signing key stable across workers; its
rotation invalidates existing signed sessions. Do not remove existing Auth0
credentials merely to enable Okta.

The tenant administrator must configure a **Single-Page Application / public
client**, Authorization Code with **PKCE S256**, token endpoint authentication
**none**. No client secret is sent in browser configuration or token exchange.
The issuer must issue RS256 ID tokens with the SPA client audience, `sub`,
`iat`, `exp`, `nonce`, `email`, and boolean **`email_verified: true`**. Configure
the email scope/claims accordingly. Access tokens are not accepted as identity
credentials. If the tenant does not assert verified email, login fails closed
by default.

### Temporary deployment-scoped unverified-email exception

For the SRCE integration test only, the deployment operator may set
`FOURSIGHT_OKTA_REQUIRE_VERIFIED_EMAIL` to the exact string `false` through the
same deployment environment/GAC loading path. Unset it (or set `true`) to restore
the strict policy. Other values, including empty strings, `0`, and `False`, do
not opt out. This does not require changing the Okta application's claims.

The exception is owned by the shared backend and applies to both React session
establishment and legacy authorization of signed `okta|` identities. It accepts
boolean `email_verified: false` or an omitted verification claim, but never null,
numeric, string, array or object values. A usable email is still required. False
remains false and omission remains absent in the signed identity; neither is
represented as verified in either UI. This temporarily trusts the issuer's unverified email for the
**existing email-based account lookup**, so restrict it to the intended test
deployment and remove it after testing. It neither provisions accounts nor
changes environment/group grants, Auth0/Cognito behavior, or other token,
transaction and session checks. Existing React sessions retain their normal
expiry; removing the exception is not a global session-revocation operation.

This document is not approval to update a CloudFormation stack or replace a
Secrets Manager document. Deployment/configuration changes remain operator-owned.

### Register these exact URLs for every Foursight origin

The existing Chalice deployment sets `api_gateway_stage: api` in
`foursight_core/deploy.py`. For an origin `https://foursight.example.org`:

| Purpose | Exact URL |
| --- | --- |
| Okta sign-in redirect (both UIs) | `https://foursight.example.org/api/okta/callback` |
| Okta sign-out redirect (both UIs) | `https://foursight.example.org/api/okta/signed-out` |
| React/legacy login bridge | `https://foursight.example.org/api/okta/login` |
| React/legacy logout bridge | `https://foursight.example.org/api/okta/logout` |
| Public configuration | `https://foursight.example.org/api/okta/config` |

**No trailing slash, no `?react`, and no environment name** in either registered
redirect. Both UIs share one callback, transaction, SDK implementation, and
backend session establishment. The return destination is browser transaction
state, not part of the registered callback.

Configure the application's sign-in/sign-out URI allowlists and, as required
by the tenant's CORS policy, an Okta **Trusted Origin** for the exact Foursight
origin (scheme, host and port, without `/api`), with CORS/redirect permissions.
The browser must reach discovery, token, JWKS and end-session endpoints. The
backend must reach issuer discovery and JWKS over verified HTTPS. Allow these
connections in any downstream CSP/proxy policy. Keep API Gateway/proxy access
logs from recording callback query strings, authorization headers, cookies,
request bodies or referrers. The callback response is `no-store` and
`Referrer-Policy: no-referrer`, but application code cannot redact upstream
access logs.

A dedicated stage-aware signed-out page is intentional. Unlike the portal's
origin-root `/` landing page, Foursight's API Gateway deployment need not serve
an application at the origin root. Register the Foursight URLs above, **not**
the portal's `/okta/callback` and origin-root logout URLs. Backend bridge URLs
use the request's actual base path; the existing React router/assets still
assume `/api/react`. A custom base-path mapping needs matching downstream
routing and registrations, not an arbitrary public callback override.

### Local development

Run the built frontend and Chalice at the **same origin** with
`CHALICE_LOCAL=true`; local routes explicitly include `/api`. Register:

- `http://localhost:8000/api/okta/callback`
- `http://localhost:8000/api/okta/signed-out`
- Trusted Origin `http://localhost:8000`, if required by the tenant.

HTTP is only for loopback development; Okta's issuer still requires HTTPS.
The existing Auth0 local callback `/callback/` is unchanged. The existing
Cognito callback `/api/react/cognito/callback` is also unchanged.

The separate CRA development origin `http://localhost:3000` is **not** an
allowed Okta session/return origin. Use `make react` and serve the generated
UI on the backend, or a same-origin development proxy that preserves `/api`
routing. Do not add credentialed cross-origin session POSTs to work around
this restriction.

## Session, authorization and lifecycle

1. Either UI navigates to the shared login bridge, with a candidate `returnTo`.
   Only same-origin UI paths in this deployment are allowed; authentication
   endpoints and external URLs fall back to the React landing page.
2. An exact-Origin, JSON POST obtains a ten-minute signed HttpOnly transaction
   cookie and a random nonce/CSRF value. The real pinned Okta Auth JS **7.14.5**
   owns the PKCE verifier and OAuth state in tab-scoped transaction storage.
   Each deliberate sign-in requests hosted interactive authentication with
   `prompt=login`, even if the portal already has an Okta SSO session. This
   applies only to sign-in, not restoration, callback processing or logout.
3. The browser redeems the authorization code without a secret. The SDK checks
   state and token validity; the bridge explicitly compares the ID-token nonce
   to its saved transaction as well. The backend independently verifies the
   nonce, RS256 signature, issuer, single client audience, token type, expiry,
   required identity claims and the deployment's email-verification policy before
   creating any session.
4. Validated identity is normalized into the existing HMAC session format.
   Legacy uses `c4_st`; React uses `authtoken` plus `c4_st` when Redis is enabled.
   The same cookies permit switching UIs. Provider ID/access/refresh tokens are
   not placed in backend session cookies or Redis. Existing portal user/group
   lookups still determine access: no users are created and no roles granted.
5. Provider expiry remains the identity/session expiry; Redis uses its existing
   default expiration. Cold workers initialize the configured Redis validator,
   and an unavailable configured store fails closed rather than bypassing it.
6. Warm/cold page restoration uses existing Foursight cookies. A stored Okta ID
   token **never silently recreates or extends** an expired/deleted Foursight
   session. No background SDK renewal service is started. Only the ID token is
   retained in SDK local storage for explicit IdP logout; access/refresh tokens
   are not retained.
7. Logout clears local SDK tokens, deletes Foursight cookies and the Redis
   session, then invokes Okta sign-out with `clearTokensBeforeRedirect: true`.
   Pending-removal tokens are not reused. Local tokens stay cleared on errors;
   if the session store cannot be reached, cookies are still cleared but the
   UI reports failure instead of claiming confirmed server revocation. If no
   ID token remains, logout can clear Foursight but cannot guarantee ending an
   existing IdP SSO session. It never automatically signs back in on reload.

All new session mutations require same-origin JSON requests and have no CORS
exception. `c4_st` and transaction cookies are HttpOnly, SameSite=Lax, and Secure
outside local HTTP development. React's existing readable, signed `authtoken`
format is retained. Callback query parameters are removed promptly; errors are
fixed text, never provider exception text. Caught backend rejections log only a
fixed stage, allowlisted exception class (`OtherError` for unknown classes), and
fixed reason for known validation failures (for example `token_nonce`, `email_policy`,
`csrf_mismatch`, or `missing_email_verified`; unknown failures use `unspecified`).
No exception message/traceback, arbitrary claim name, identity or request data is
added to this diagnostic. Successful sessions do not emit rejection diagnostics.
Browser HTTP requests (including
response bodies) abort after 15 seconds; backend discovery/JWKS requests have
five-second timeouts. The bounded multi-step flow always ends in navigation or
an error with a return link, not an unbounded session-properties spinner.

## Build and offline validation

The protocol bridge source is `react/src/auth/okta.js`; `scripts/react_build.sh`
bundles its standalone entry with the pinned esbuild and copies it, along with
the normal CRA build, into `foursight_core/react/ui/`. Both legacy and React use
this same generated `okta-auth.js`. Do not hand-edit generated assets.

```sh
# In a Python 3.11 environment with the project's test dependencies:
AWS_EC2_METADATA_DISABLED=true PYTHONPATH=tests:. python -m pytest \
  --confcutdir=tests -o addopts='' -q tests/test_okta.py \
  tests/test_react_auth.py tests/test_react_auth_routes.py \
  tests/test_cookie_utils.py tests/test_jwt_utils.py
cd react
CI=true npm test -- --watchAll=false --runInBand src/auth/okta.test.js
cd ..
sh scripts/react_build.sh
```

**Do not drop `--confcutdir=tests` in an offline validation run:** the root
`conftest.py` has an autouse fixture that purges an AWS SQS queue. The focused
Okta tests explicitly deny AWS/network clients and use synthetic RSA keys/users.
The JavaScript tests execute the real locked browser SDK, not a mock of its
PKCE, verification or sign-out implementation.

Local Chrome acceptance used the actual generated React UI, rendered legacy
header, shared bridge, backend session/authorization functions, and a synthetic
loopback HTTPS OIDC issuer validating S256 code redemption. Covered both UI
entrypoints, callback/return, cold/warm cookie restoration, logout/reload,
missing transaction, bad state/nonce/signature/expiry, provider error,
unauthorized existing user, and an external return URL. Portal/Redis/cloud
services were synthetic; no real users, credentials or AWS calls were used.

Reference reviewed: current head `ea2ed0bfa97a553de107d0eb5d0cc1306047ac19` of
https://github.com/smaht-dac/smaht-portal/pull/729, including its corrected
pendingRemove logout behavior. This implementation does not copy its unbounded
session-properties wait; unverified email requires the explicit server-side
exception described above.

**Live acceptance still requires operator registration/configuration** above,
a downstream app deployment, and designated tenant login/logout testing. None
of those external configuration changes or an environment deployment is performed
by this change. Pin **`foursight-core==5.10.5.1b4`** for explicit interactive sign-in
and credential-free rejection classification. The immutable `5.10.5.1b3` already
accepts an omitted verification claim under the opt-out, but contains neither the
interactive prompt nor rejection diagnostic. Interactive login is not a fix for a
backend session request exceeding the existing browser budget. The earlier immutable beta `5.10.5.1b2` accepts
boolean false only; `5.10.5.1b1` has no opt-out. Package availability is not a
claim of deployment or live login success. Rollback of the provider selection is removal of both Okta
issuer/client settings while retaining existing Auth0/Cognito configuration;
normal session expiry and signing-key policy continue to apply.

### Optional immutable-source packaging

The existing `pyproject.toml` defines the Poetry Core PEP 517 build backend and
includes `foursight_core`, including checked-in generated UI assets and legacy
templates. A wheel can therefore be built locally from an exact source commit;
no PyPI publication or tag change is required:

```sh
# In a deployment worker's isolated build directory, using the validated full SHA:
git clone https://github.com/4dn-dcic/foursight-core.git foursight-core-source
cd foursight-core-source
git checkout --detach <validated-full-commit-sha>
python -m pip wheel --no-deps --wheel-dir ../core-wheels .
# In the downstream application's existing dependency environment:
python -m pip install --no-deps --force-reinstall ../core-wheels/foursight_core-5.10.5.1b4-py3-none-any.whl
```

Resolve the downstream application's normal dependencies first (including its
Chalice runtime). Keep the source SHA and wheel SHA-256 with the deployment
receipt: a local build retains the source's version but is not the downloaded
PyPI artifact, and a subsequent dependency sync from PyPI can overwrite it.
Do not upload this wheel or reuse/move the published release tag. A dependency
tool supporting Git revisions may instead pin the full source commit directly.
The already committed assets need no Node rebuild in the downstream packaging
step; they were regenerated and validated with `scripts/react_build.sh`.
