import { OktaAuth } from '@okta/okta-auth-js';

const TRANSACTION = 'foursight-okta-transaction';

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
export async function fetchBounded(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const result = await fetch(url, { ...options, signal: controller.signal });
        const text = await result.text();
        if (!result.ok) throw new Error('Authentication request failed');
        return { result, text };
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

async function api(base, operation, body) {
    const { text } = await fetchBounded(`${base}/okta/${operation}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
    return JSON.parse(text);
}

export async function fullLogout(client, clearSession) {
    const tokens = client.tokenManager.getTokensSync();
    // Do not rely on SDK start() to remove pendingRemove tokens on a later page.
    client.tokenManager.clear();
    sessionStorage.removeItem(TRANSACTION);
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

export async function runBridge() {
    const path = window.location.pathname;
    const base = path.slice(0, path.lastIndexOf('/okta/'));
    const operation = path.split('/').pop();
    const { text } = await fetchBounded(`${base}/okta/config`, { credentials: 'same-origin' });
    const config = JSON.parse(text);
    if (!config.enabled) throw new Error('Okta is not configured');
    const client = createClient(config);
    // One owner, no background renewal service: the bridge uses explicit SDK APIs.
    try {
        if (operation === 'logout') {
            const redirected = await fullLogout(client, () => api(base, 'logout'));
            if (!redirected) window.location.replace(config.postLogoutRedirectUri);
        } else if (operation === 'login') {
            client.tokenManager.clear();
            client.transactionManager.clear();
            const target = safeReturn(new URLSearchParams(window.location.search).get('returnTo'), base);
            const transaction = await api(base, 'transaction');
            sessionStorage.setItem(TRANSACTION, JSON.stringify({ ...transaction, target }));
            await client.signInWithRedirect({ nonce: transaction.nonce });
        } else if (operation === 'callback') {
            // parseFromUrl verifies state/signature/issuer/audience/expiry using
            // the real SDK transaction and PKCE verifier from this browser tab.
            // Also bind the ID-token nonce explicitly (and independently on the
            // server); the SDK's code-exchange path need not propagate it.
            const transaction = JSON.parse(sessionStorage.getItem(TRANSACTION) || 'null');
            if (!transaction || !client.isLoginRedirect()) throw new Error('Missing transaction');
            let parsed;
            try { parsed = await client.token.parseFromUrl(); }
            finally { window.history.replaceState(null, '', path); }
            const token = parsed.tokens.idToken;
            if (!token || token.pendingRemove || token.claims.nonce !== transaction.nonce) {
                throw new Error('Invalid ID token transaction');
            }
            await api(base, 'session', { idToken: token.idToken, csrf: transaction.csrf });
            // Retain only the ID token for explicit IdP logout; never use it to
            // silently recreate/extend a Foursight session on document reload.
            client.tokenManager.setTokens({ idToken: token });
            sessionStorage.removeItem(TRANSACTION);
            window.location.replace(safeReturn(transaction.target, base));
        } else { throw new Error('Unknown operation'); }
    } catch (error) {
        client.tokenManager.clear();
        client.transactionManager.clear();
        sessionStorage.removeItem(TRANSACTION);
        window.history.replaceState(null, '', path);
        throw new Error('Sign-in or sign-out could not be completed. Return to Foursight and try again.');
    } finally { client.stop(); }
}
