import { OktaAuth, AuthSdkError, AuthApiError, OAuthError } from '@okta/okta-auth-js';

import { beginBridgeTransaction, callbackState, takeBridgeTransaction,
    clearBridgeTransaction, clearBridgeTransactions } from './okta-transaction';

const DIAGNOSTIC_STAGES = new Set([
    'config_fetch', 'config_parse', 'sdk_init', 'logout', 'login_transaction', 'login_redirect',
    'bridge_read', 'bridge_check', 'sdk_parse', 'id_token_check', 'session_submit', 'session_store', 'return'
]);
// Exact static literals from pinned SDK 7.14.5 only. Never extract fragments of
// dynamic messages (issuer/audience errors can contain identity/claim values).
const SDK_REASONS = new Map([
    ["OAuth flow response state doesn't match request state", 'sdk_state_mismatch'],
    ['Could not load PKCE codeVerifier from storage. This may indicate the auth flow has already completed or multiple auth flows are executing concurrently.', 'sdk_pkce_missing'],
    ['Unable to retrieve OAuth redirect params from storage', 'sdk_redirect_missing'],
    ["OAuth flow response nonce doesn't match request nonce", 'sdk_nonce_mismatch'],
    ['The token signature is not valid', 'sdk_signature_invalid'],
    ['Token hash verification failed', 'sdk_token_hash_invalid'],
    ['The JWT expired and is no longer valid', 'sdk_expired'],
    ['The JWT was issued in the future', 'sdk_issued_future'],
    ['The JWT expired before it was issued', 'sdk_lifetime_invalid']
]);
const OAUTH_REASONS = new Map([
    ['access_denied', 'oauth_access_denied'], ['invalid_grant', 'oauth_invalid_grant'],
    ['invalid_client', 'oauth_invalid_client'], ['invalid_request', 'oauth_invalid_request'],
    ['login_required', 'oauth_login_required'], ['interaction_required', 'oauth_interaction_required']
]);
const CLIENT_REASONS = new Set([
    'bridge_transaction_missing', 'redirect_not_recognized', 'id_token_missing', 'id_token_pending_remove',
    'bridge_nonce_mismatch', 'session_transport', 'session_timeout', 'session_http', 'session_invalid_json'
]);
const DIAGNOSTIC_REASONS = new Set([...SDK_REASONS.values(), ...OAUTH_REASONS.values(), ...CLIENT_REASONS]);
const DIAGNOSTIC_CLASSES = new Set(['AuthSdkError', 'AuthApiError', 'OAuthError']);

export function createDiagnostic() {
    return { stage: 'config_fetch', exception: 'unknown', reason: 'unknown', captured: false };
}

export function captureDiagnostic(diagnostic, error) {
    // Preserve the original classification when the entrypoint catches our
    // generic rethrow, or if cleanup itself fails. Keep no reference to error.
    if (diagnostic.captured) return;
    diagnostic.captured = true;
    diagnostic.exception = 'unknown';
    const knownGuard = CLIENT_REASONS.has(diagnostic.reason) ? diagnostic.reason : 'unknown';
    diagnostic.reason = 'unknown';
    if (error instanceof AuthSdkError) {
        diagnostic.exception = 'AuthSdkError';
        diagnostic.reason = SDK_REASONS.get(error.message) || 'unknown';
    } else if (error instanceof OAuthError) {
        diagnostic.exception = 'OAuthError';
        diagnostic.reason = OAUTH_REASONS.get(error.errorCode) || 'unknown';
    } else if (error instanceof AuthApiError) {
        diagnostic.exception = 'AuthApiError';
    }
    if (knownGuard !== 'unknown') diagnostic.reason = knownGuard;
}

export function formatDiagnostic(diagnostic) {
    // Re-allowlist at the presentation boundary; never stringify an error or
    // arbitrary field, even if a caller supplied a malformed diagnostic object.
    const stage = DIAGNOSTIC_STAGES.has(diagnostic.stage) ? diagnostic.stage : 'unknown';
    const exception = DIAGNOSTIC_CLASSES.has(diagnostic.exception) ? diagnostic.exception : 'unknown';
    const reason = DIAGNOSTIC_REASONS.has(diagnostic.reason) ? diagnostic.reason : 'unknown';
    return `stage=${stage} class=${exception} reason=${reason}`;
}

// Restrict navigation to UI routes in this deployment, never an auth endpoint.
export function safeReturn(value, base, fallback = `${base}/react`) {
    try {
        const url = new URL(value, window.location.origin);
        const root = new URL(base, window.location.origin);
        const prefix = root.pathname.replace(/\/$/, '');
        if (url.origin === root.origin && !url.username && !url.password &&
            [...String(value)].every(char => char.charCodeAt(0) > 32 && char !== '\\') &&
            ['react', 'view', 'history', 'info', 'users'].some(
                path => url.pathname === `${prefix}/${path}` || url.pathname.startsWith(`${prefix}/${path}/`)) &&
            !/\/(okta|callback|logout|login)(\/|$)/.test(url.pathname)) {
            return url.pathname + url.search + url.hash;
        }
    } catch (_) { /* Use the fixed safe default. */ }
    return new URL(fallback, window.location.origin).pathname;
}

// Abort covers the response body too, not just receipt of HTTP headers.
export async function fetchBounded(url, options = {}, timeout = 15000, diagnostic) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const result = await fetch(url, { ...options, signal: controller.signal });
        const text = await result.text();
        if (!result.ok) {
            if (diagnostic) diagnostic.reason = 'session_http';
            throw new Error('Authentication request failed');
        }
        return { result, text };
    } catch (error) {
        if (diagnostic && diagnostic.reason === 'unknown') {
            diagnostic.reason = controller.signal.aborted ? 'session_timeout' : 'session_transport';
        }
        throw error;
    } finally { clearTimeout(timer); }
}

export async function sdkTransport(method, url, args) {
    const headers = args.headers || {};
    let body = args.data;
    if (body && typeof body !== 'string') {
        body = (headers['Content-Type'] || headers['content-type'] || '').includes('application/json')
            ? JSON.stringify(body) : new URLSearchParams(body).toString();
    }
    const { result, text } = await fetchBounded(url, {
        method, headers, body, credentials: args.withCredentials ? 'include' : 'omit'
    });
    return { status: result.status, responseText: text, headers: Object.fromEntries(result.headers.entries()) };
}

export function createClient(config) {
    return new OktaAuth({
        issuer: config.issuer, clientId: config.clientId,
        redirectUri: config.redirectUri, postLogoutRedirectUri: config.postLogoutRedirectUri,
        scopes: config.scopes, pkce: true, responseType: ['code'], ignoreSignature: false,
        httpRequestClient: sdkTransport,
        tokenManager: { storage: 'localStorage', autoRenew: false, autoRemove: false },
        storageManager: { transaction: { storageType: 'sessionStorage', storageTypes: ['sessionStorage'] } },
        services: { autoRenew: false, autoRemove: false, syncStorage: false }
    });
}

async function api(base, operation, body, diagnostic) {
    const { text } = await fetchBounded(`${base}/okta/${operation}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    }, 15000, diagnostic);
    try { return JSON.parse(text); }
    catch (error) {
        if (diagnostic) diagnostic.reason = 'session_invalid_json';
        throw error;
    }
}

export async function fullLogout(client, clearSession, clearBridge = () => {}) {
    const tokens = client.tokenManager.getTokensSync();
    // Do not rely on SDK start() to remove pendingRemove tokens on a later page.
    client.tokenManager.clear();
    clearBridge();
    client.transactionManager.clear();
    try {
        await clearSession();
        if (!tokens.idToken || tokens.idToken.pendingRemove) return false;
        return await client.signOut({ ...tokens, clearTokensBeforeRedirect: true });
    } finally {
        client.tokenManager.clear();
        client.stop();
    }
}

export async function runBridge(diagnostic = createDiagnostic()) {
    const path = window.location.pathname;
    const base = path.slice(0, path.lastIndexOf('/okta/'));
    const operation = path.split('/').pop();
    diagnostic.stage = 'config_fetch';
    const { text } = await fetchBounded(`${base}/okta/config`, { credentials: 'same-origin' });
    diagnostic.stage = 'config_parse';
    const config = JSON.parse(text);
    if (!config.enabled) throw new Error('Okta is not configured');
    diagnostic.stage = 'sdk_init';
    const client = createClient(config);
    let activeState = null;
    // One owner, no background renewal service: the bridge uses explicit SDK APIs.
    try {
        if (operation === 'logout') {
            diagnostic.stage = 'logout';
            const redirected = await fullLogout(client, () => api(base, 'logout'),
                () => clearBridgeTransactions(config, base));
            if (!redirected) window.location.replace(config.postLogoutRedirectUri);
        } else if (operation === 'login') {
            diagnostic.stage = 'login_transaction';
            client.tokenManager.clear();
            client.transactionManager.clear();
            const target = safeReturn(new URLSearchParams(window.location.search).get('returnTo'), base);
            const transaction = await api(base, 'transaction');
            activeState = beginBridgeTransaction(config, base, transaction, target);
            // An explicit Foursight sign-in must not silently reuse portal SSO.
            diagnostic.stage = 'login_redirect';
            await client.signInWithRedirect({ state: activeState, nonce: transaction.nonce, prompt: 'login' });
        } else if (operation === 'callback') {
            // parseFromUrl verifies state/signature/issuer/audience/expiry using
            // the real SDK transaction/PKCE verifier, including its state-keyed
            // shared storage when the IdP returns in another same-origin tab.
            // Also bind the ID-token nonce explicitly (and independently on the
            // server); the SDK's code-exchange path need not propagate it.
            diagnostic.stage = 'bridge_read';
            const state = callbackState(window.location.search);
            const transaction = takeBridgeTransaction(config, base, state);
            if (transaction) activeState = state;
            diagnostic.stage = 'bridge_check';
            if (!transaction) {
                diagnostic.reason = 'bridge_transaction_missing';
                throw new Error('Missing transaction');
            }
            if (!client.isLoginRedirect()) {
                diagnostic.reason = 'redirect_not_recognized';
                throw new Error('Missing transaction');
            }
            let parsed;
            diagnostic.stage = 'sdk_parse';
            try { parsed = await client.token.parseFromUrl(); }
            finally { window.history.replaceState(null, '', path); }
            diagnostic.stage = 'id_token_check';
            const token = parsed.tokens.idToken;
            if (!token) {
                diagnostic.reason = 'id_token_missing';
                throw new Error('Invalid ID token transaction');
            }
            if (token.pendingRemove) {
                diagnostic.reason = 'id_token_pending_remove';
                throw new Error('Invalid ID token transaction');
            }
            if (token.claims.nonce !== transaction.nonce) {
                diagnostic.reason = 'bridge_nonce_mismatch';
                throw new Error('Invalid ID token transaction');
            }
            diagnostic.stage = 'session_submit';
            await api(base, 'session', { idToken: token.idToken, csrf: transaction.csrf }, diagnostic);
            // Retain only the ID token for explicit IdP logout; never use it to
            // silently recreate/extend a Foursight session on document reload.
            diagnostic.stage = 'session_store';
            client.tokenManager.setTokens({ idToken: token });
            diagnostic.stage = 'return';
            clearBridgeTransaction(config, base, activeState);
            window.location.replace(safeReturn(transaction.target, base));
        } else { throw new Error('Unknown operation'); }
    } catch (error) {
        captureDiagnostic(diagnostic, error);
        client.tokenManager.clear();
        // Never let an unrecognized callback erase another state's pending login.
        if (activeState) {
            client.transactionManager.clear({ state: activeState });
            clearBridgeTransaction(config, base, activeState);
        }
        window.history.replaceState(null, '', path);
        throw new Error('Sign-in or sign-out could not be completed. Return to Foursight and try again.');
    } finally { client.stop(); }
}
