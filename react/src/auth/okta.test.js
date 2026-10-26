import { createClient, fullLogout, safeReturn, sdkTransport, fetchBounded, runBridge } from './okta';
import { webcrypto, generateKeyPairSync, createSign, createHash } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

// CRA's Jest 27 resolver predates Node package exports; execute the real browser
// distribution instead of its Node crypto fallback (not a mocked SDK).
jest.mock('@okta/okta-auth-js', () => {
    Object.defineProperty(global.window, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    global.TextEncoder = require('util').TextEncoder;
    global.TextDecoder = require('util').TextDecoder;
    const sdk = jest.requireActual('@okta/okta-auth-js/umd/default.js');
    return { OktaAuth: sdk.OktaAuth || sdk };
});

const config = {
    issuer: 'https://synthetic.okta.invalid/oauth2/default', clientId: 'synthetic-spa',
    redirectUri: 'http://localhost/api/okta/callback',
    postLogoutRedirectUri: 'http://localhost/api/okta/signed-out', scopes: ['openid', 'email', 'profile']
};
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic', use: 'sig', alg: 'RS256' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function idToken(changes = {}) {
    const claims = { iss: config.issuer, aud: config.clientId, sub: 'synthetic', nonce: 'nonce',
        email: 'synthetic@example.invalid', email_verified: true,
        iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...changes };
    const data = encode({ alg: 'RS256', kid: 'synthetic' }) + '.' + encode(claims);
    const jwt = data + '.' + createSign('RSA-SHA256').update(data).sign(privateKey).toString('base64url');
    return { idToken: jwt, claims, issuer: config.issuer, clientId: config.clientId,
        expiresAt: claims.exp, scopes: config.scopes };
}
const metadata = {
    issuer: config.issuer, authorization_endpoint: config.issuer + '/v1/authorize',
    token_endpoint: config.issuer + '/v1/token', jwks_uri: config.issuer + '/v1/keys',
    end_session_endpoint: config.issuer + '/v1/logout', code_challenge_methods_supported: ['S256']
};

beforeAll(() => {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
});
beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    global.fetch = jest.fn(async url => ({ ok: true, status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify(url.endsWith('/keys') ? { keys: [jwk] } : metadata) }));
});
afterEach(() => { jest.restoreAllMocks(); });

test.each(['//attacker.invalid', 'https://attacker.invalid/api/react', '/api/okta/callback?code=sentinel',
    '/api/react/user/login', '/api/react/cognito/callback', '/api/react/logout',
    '/api/react\\evil', '/api/view\nfoo', '/other/react', 'javascript:alert(1)'])( // eslint-disable-line no-script-url
    'return navigation rejects %s', target => {
        expect(safeReturn(target, '/api')).toBe('/api/react');
    });
test.each(['/api/react/synthetic/checks?tab=1#result', '/api/view/synthetic', '/api/history/synthetic/check',
    '/api/info/synthetic', '/api/users/synthetic'])(
    'return navigation permits %s', target => expect(safeReturn(target, '/api')).toBe(target));

test.each(['/api/react/synthetic/checks?tab=1#result', '/api/view/synthetic'])(
    'each deliberate login to %s requests interactive auth despite existing SDK/SSO state', async target => {
        const oldLocation = window.location;
        const assign = jest.fn();
        delete window.location;
        window.location = { ...oldLocation, assign, pathname: '/api/okta/login',
            search: '?returnTo=' + encodeURIComponent(target) };
        const existing = createClient(config);
        const transport = global.fetch;
        global.fetch = jest.fn(async (url, options) => {
            if (url === '/api/okta/config' || url === '/api/okta/transaction') {
                return { ok: true, text: async () => JSON.stringify(url.endsWith('/config')
                    ? { ...config, enabled: true } : { nonce: 'nonce', csrf: 'csrf' }) };
            }
            return transport(url, options);
        });
        // Synthetic hosted-issuer policy: an SSO cookie alone normally skips its
        // screen. Inspect the REAL SDK redirect, not a spy on signInWithRedirect.
        const hostedIssuer = (url, hasSsoSession) =>
            url.searchParams.get('prompt') === 'login' || !hasSsoSession ? 'interactive' : 'sso';
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                existing.tokenManager.setTokens({ idToken: idToken() });
                existing.transactionManager.save({ state: 'previous', nonce: 'previous' });
                await runBridge();
                expect(assign).toHaveBeenCalledTimes(attempt + 1);
                const authorize = new URL(assign.mock.calls[attempt][0]);
                expect(authorize.origin + authorize.pathname).toBe(metadata.authorization_endpoint);
                expect(authorize.searchParams.get('prompt')).toBe('login');
                expect(hostedIssuer(authorize, true)).toBe('interactive');
                const defaultRequest = new URL(authorize);
                defaultRequest.searchParams.delete('prompt');
                expect(hostedIssuer(defaultRequest, true)).toBe('sso');
                expect(authorize.searchParams.get('nonce')).toBe('nonce');
                expect(authorize.searchParams.get('state')).toBeTruthy();
                expect(authorize.searchParams.get('state')).not.toBe('previous');
                expect(authorize.searchParams.get('response_type')).toBe('code');
                expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
                expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
                expect(authorize.searchParams.get('redirect_uri')).toBe(config.redirectUri);
                expect(authorize.searchParams.get('client_id')).toBe(config.clientId);
                expect(authorize.searchParams.get('scope')).toBe(config.scopes.join(' '));
                expect(JSON.parse(sessionStorage.getItem('foursight-okta-transaction')))
                    .toEqual({ nonce: 'nonce', csrf: 'csrf', target });
                expect(existing.tokenManager.getTokensSync()).toEqual({});
            }
            expect(new URL(assign.mock.calls[0][0]).searchParams.get('state'))
                .not.toBe(new URL(assign.mock.calls[1][0]).searchParams.get('state'));
            // Constructing the SDK on a fresh document does not authorize or
            // silently recreate the server session from a retained logout token.
            existing.tokenManager.setTokens({ idToken: idToken() });
            const restored = createClient(config);
            expect(restored.tokenManager.getTokensSync().idToken).toBeDefined();
            expect(assign).toHaveBeenCalledTimes(2);
            expect(fetch.mock.calls.some(([url]) => url.endsWith('/session'))).toBe(false);
            restored.stop();
        } finally {
            existing.stop();
            window.location = oldLocation;
        }
    });

test('real pinned SDK verifies synthetic signed ID token', async () => {
    const client = createClient(config);
    await expect(client.token.verify(idToken(), { nonce: 'nonce' })).resolves.toBeDefined();
    client.stop();
});

test.each([{ nonce: 'other' }, { iss: 'https://wrong.invalid' }, { aud: 'other' }, { exp: 1 }])(
    'SDK rejects invalid identity claims %s', async changes => {
        const client = createClient(config);
        await expect(client.token.verify(idToken(changes), { nonce: 'nonce' })).rejects.toBeDefined();
        client.stop();
    });

test.each([
    ['/api/react/synthetic/checks', false], ['/api/view/synthetic', false],
    ['/api/react/synthetic/checks', true], ['/api/view/synthetic', true]
])('unverified email callback to %s obeys backend acceptance %s', async (target, accepted) => {
    const oldLocation = window.location;
    const assign = jest.fn();
    const replace = jest.fn();
    delete window.location;
    window.location = { ...oldLocation, assign, replace, pathname: '/api/okta/callback' };
    const sessionRequests = [];
    const unverified = idToken({ email_verified: false });
    global.fetch = jest.fn(async (url, options = {}) => {
        let body = metadata;
        let ok = true;
        if (url.endsWith('/keys')) body = { keys: [jwk] };
        if (url.endsWith('/token')) body = { id_token: unverified.idToken,
            access_token: idToken({ aud: 'resource', scp: ['openid'] }).idToken,
            token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile' };
        if (url === '/api/okta/config') body = { ...config, enabled: true };
        if (url === '/api/okta/session') {
            sessionRequests.push(JSON.parse(options.body));
            ok = accepted; // Transport boundary: Python tests exercise the actual server policy.
            body = accepted ? { authenticated: true } : { error: 'Unable to complete Okta authentication.' };
        }
        return { ok, status: ok ? 200 : 403, headers: new Map(), text: async () => JSON.stringify(body) };
    });
    const client = createClient(config);
    try {
        await client.signInWithRedirect({ nonce: 'nonce' });
        const state = new URL(assign.mock.calls[0][0]).searchParams.get('state');
        window.history.replaceState(null, '', '/api/okta/callback?code=synthetic&state=' + state);
        window.location.search = '?code=synthetic&state=' + state;
        window.location.href = config.redirectUri + window.location.search;
        sessionStorage.setItem('foursight-okta-transaction', JSON.stringify({ nonce: 'nonce', csrf: 'csrf', target }));
        const outcome = await runBridge().then(() => 'accepted', error => error.message);
        expect(outcome).toBe(accepted ? 'accepted' :
            'Sign-in or sign-out could not be completed. Return to Foursight and try again.');
        expect(replace.mock.calls).toEqual(accepted ? [[target]] : []);
        expect(assign).toHaveBeenCalledTimes(1); // Callback never starts a new authorization.
        const stored = client.tokenManager.getTokensSync();
        expect(Object.keys(stored)).toEqual(accepted ? ['idToken'] : []);
        expect(stored.idToken?.claims.email_verified).toBe(accepted ? false : undefined);
        expect(sessionRequests).toEqual([{ idToken: unverified.idToken, csrf: 'csrf' }]);
        expect(sessionStorage.getItem('foursight-okta-transaction')).toBeNull();
    } finally {
        client.stop();
        window.location = oldLocation;
        window.history.replaceState(null, '', '/');
    }
});

test('SDK rejects tampered signature', async () => {
    const client = createClient(config);
    const token = idToken();
    const parts = token.idToken.split('.');
    parts[2] = 'AAAAAAAA' + parts[2].slice(8);
    token.idToken = parts.join('.');
    await expect(client.token.verify(token, { nonce: 'nonce' })).rejects.toBeDefined();
    client.stop();
});

test('SDK callback refuses missing transaction or mismatched state', async () => {
    const client = createClient(config);
    await expect(client.token.parseFromUrl(config.redirectUri + '?code=synthetic&state=missing')).rejects.toBeDefined();
    client.transactionManager.save({ nonce: 'nonce', state: 'expected', codeVerifier: 'verifier',
        redirectUri: config.redirectUri, clientId: config.clientId, responseType: ['code'],
        scopes: config.scopes, urls: { tokenUrl: metadata.token_endpoint, issuer: config.issuer } });
    await expect(client.token.parseFromUrl(config.redirectUri + '?code=synthetic&state=wrong')).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
    client.stop();
});

test('real SDK logout clears tokens before redirect; reload cannot restore pendingRemove', async () => {
    const client = createClient(config);
    client.tokenManager.setTokens({ idToken: idToken() });
    const clearSession = jest.fn(async () => {
        expect(client.tokenManager.getTokensSync()).toEqual({});
    });
    // Use the actual signOut implementation. Replace only browser navigation.
    const assign = jest.fn();
    const oldLocation = window.location;
    delete window.location;
    window.location = { ...oldLocation, assign };
    try {
        await fullLogout(client, clearSession);
        expect(clearSession).toHaveBeenCalledTimes(1);
        expect(assign).toHaveBeenCalledTimes(1);
        const redirect = new URL(assign.mock.calls[0][0]);
        expect(redirect.pathname).toBe('/oauth2/default/v1/logout');
        expect(redirect.searchParams.has('prompt')).toBe(false);
        expect(redirect.searchParams.get('post_logout_redirect_uri')).toBe(config.postLogoutRedirectUri);
        const reloaded = createClient(config);
        expect(reloaded.tokenManager.getTokensSync()).toEqual({});
        reloaded.stop();
    } finally { window.location = oldLocation; }
});

test('pendingRemove and failed local logout cannot leave a restorable token', async () => {
    const client = createClient(config);
    client.tokenManager.setTokens({ idToken: { ...idToken(), pendingRemove: true } });
    const logout = jest.spyOn(client, 'signOut');
    await expect(fullLogout(client, async () => {})).resolves.toBe(false);
    expect(logout).not.toHaveBeenCalled();
    client.tokenManager.setTokens({ idToken: idToken() });
    await expect(fullLogout(client, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(createClient(config).tokenManager.getTokensSync()).toEqual({});
});

test('bounded transport aborts a hung request and the body', async () => {
    global.fetch = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    await expect(fetchBounded('/api/okta/session', {}, 5)).rejects.toThrow('aborted');
    global.fetch = jest.fn(async (url, { signal }) => ({ ok: true,
        text: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('body aborted'))))
    }));
    await expect(fetchBounded('/api/okta/session', {}, 5)).rejects.toThrow('body aborted');
});

test.each([undefined, 'login'])(
    'callback session budget is 15 seconds regardless of authorize prompt %s', async prompt => {
        const oldLocation = window.location;
        const assign = jest.fn();
        const replace = jest.fn();
        delete window.location;
        window.location = { ...oldLocation, assign, replace, pathname: '/api/okta/callback' };
        const client = createClient(config);
        let sessionStarted;
        const started = new Promise(resolve => { sessionStarted = resolve; });
        let serverFinished = false;
        let sessionSignal;
        global.fetch = jest.fn(async (url, options = {}) => {
            let body = metadata;
            if (url.endsWith('/keys')) body = { keys: [jwk] };
            if (url.endsWith('/token')) body = { id_token: idToken().idToken,
                access_token: idToken({ aud: 'resource', scp: ['openid'] }).idToken,
                token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile' };
            if (url === '/api/okta/config') body = { ...config, enabled: true };
            if (url === '/api/okta/session') {
                sessionSignal = options.signal;
                sessionStarted();
                // A server is not canceled by aborting its browser transport.
                // Fake time keeps this synthetic 20-second dependency bounded.
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        serverFinished = true;
                        resolve({ ok: true, text: async () => '{"authenticated":true}' });
                    }, 20000);
                    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
                });
            }
            return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body) };
        });
        try {
            await client.signInWithRedirect({ nonce: 'nonce', prompt });
            const state = new URL(assign.mock.calls[0][0]).searchParams.get('state');
            window.location.search = '?code=synthetic&state=' + state;
            window.location.href = config.redirectUri + window.location.search;
            sessionStorage.setItem('foursight-okta-transaction', JSON.stringify({
                nonce: 'nonce', csrf: 'csrf', target: '/api/view/synthetic' }));
            jest.useFakeTimers();
            const outcome = runBridge().then(() => 'accepted', error => error.message);
            await started;
            jest.advanceTimersByTime(14999);
            expect(sessionSignal.aborted).toBe(false);
            expect(serverFinished).toBe(false);
            jest.advanceTimersByTime(1);
            expect(sessionSignal.aborted).toBe(true);
            expect(await outcome).toBe(
                'Sign-in or sign-out could not be completed. Return to Foursight and try again.');
            expect(serverFinished).toBe(false);
            expect(assign).toHaveBeenCalledTimes(1);
            expect(replace).not.toHaveBeenCalled();
            expect(sessionStorage.getItem('foursight-okta-transaction')).toBeNull();
            expect(client.tokenManager.getTokensSync()).toEqual({});
            jest.advanceTimersByTime(5000);
            expect(serverFinished).toBe(true);
            expect(replace).not.toHaveBeenCalled(); // Late success cannot rescue this callback.
        } finally {
            jest.useRealTimers();
            client.stop();
            window.location = oldLocation;
            window.history.replaceState(null, '', '/');
        }
    });

test('SDK transport never puts token exchange data in URLs', async () => {
    await sdkTransport('POST', metadata.token_endpoint, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: { code: 'synthetic', code_verifier: 'synthetic-verifier', client_id: config.clientId }
    });
    expect(fetch.mock.calls[0][0]).toBe(metadata.token_endpoint);
    expect(fetch.mock.calls[0][1].body).toContain('code_verifier=synthetic-verifier');
    expect(fetch.mock.calls[0][1].body).not.toContain('client_secret');
});

test('real SDK cold/warm PKCE redirect and fresh-document callback exchange', async () => {
    const oldLocation = window.location;
    const assign = jest.fn();
    delete window.location;
    window.location = { ...oldLocation, assign };
    let authorization;
    let redemption;
    global.fetch = jest.fn(async (url, options) => {
        let body = metadata;
        if (url.endsWith('/keys')) body = { keys: [jwk] };
        if (url.endsWith('/token')) {
            redemption = new URLSearchParams(options.body);
            body = { id_token: idToken().idToken, access_token: idToken({ aud: 'resource', scp: ['openid'] }).idToken,
                token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile' };
        }
        return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body) };
    });
    try {
        const cold = createClient(config);
        await cold.signInWithRedirect({ nonce: 'nonce' });
        expect(fetch.mock.calls.filter(([url]) => url.includes('/.well-known/'))).toHaveLength(1);
        cold.transactionManager.clear(); // Cancel before a second, warm login.
        const warm = createClient(config);
        await warm.signInWithRedirect({ nonce: 'nonce' });
        expect(fetch.mock.calls.filter(([url]) => url.includes('/.well-known/'))).toHaveLength(1);
        authorization = new URL(assign.mock.calls[1][0]);
        expect(authorization.searchParams.get('response_type')).toBe('code');
        expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
        const callback = createClient(config);
        const parsed = await callback.token.parseFromUrl(config.redirectUri +
            '?code=synthetic-code&state=' + authorization.searchParams.get('state'));
        expect(parsed.tokens.idToken.claims.email).toBe('synthetic@example.invalid');
        expect(redemption.get('client_id')).toBe(config.clientId);
        expect(redemption.has('client_secret')).toBe(false);
        expect(redemption.get('redirect_uri')).toBe(config.redirectUri);
        expect(createHash('sha256').update(redemption.get('code_verifier')).digest('base64url'))
            .toBe(authorization.searchParams.get('code_challenge'));
        // SDK consumed the transaction: callback reload does not redeem it again.
        await expect(callback.token.parseFromUrl(config.redirectUri +
            '?code=synthetic-code&state=' + authorization.searchParams.get('state'))).rejects.toBeDefined();
        cold.stop(); warm.stop(); callback.stop();
    } finally { window.location = oldLocation; }
});
