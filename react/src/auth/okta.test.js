import { createClient, fullLogout, safeReturn, sdkTransport, fetchBounded, runBridge,
    createDiagnostic, captureDiagnostic, formatDiagnostic } from './okta';
import { AuthSdkError, AuthApiError, OAuthError } from '@okta/okta-auth-js';
import { beginBridgeTransaction, clearBridgeTransaction } from './okta-transaction';
import { webcrypto, generateKeyPairSync, createSign, createHash } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

// CRA's Jest 27 resolver predates Node package exports; execute the real browser
// distribution instead of its Node crypto fallback (not a mocked SDK).
jest.mock('@okta/okta-auth-js', () => {
    Object.defineProperty(global.window, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    global.TextEncoder = require('util').TextEncoder;
    global.TextDecoder = require('util').TextDecoder;
    const sdk = jest.requireActual('@okta/okta-auth-js/umd/default.js');
    return { ...sdk, OktaAuth: sdk.OktaAuth || sdk };
});

const config = {
    issuer: 'https://synthetic.okta.invalid/oauth2/default', clientId: 'synthetic-spa',
    redirectUri: 'http://localhost/api/okta/callback',
    postLogoutRedirectUri: 'http://localhost/api/okta/signed-out', scopes: ['openid', 'email', 'profile']
};
function bridgeRecord(state) {
    const key = Object.keys(localStorage).find(key => key.startsWith('foursight-okta-transaction:v2:') &&
        key.endsWith(':' + state));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
}

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
                expect(bridgeRecord(authorize.searchParams.get('state')))
                    .toEqual(expect.objectContaining({ nonce: 'nonce', csrf: 'csrf', target }));
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

test.each([
    [new AuthSdkError("OAuth flow response state doesn't match request state"), 'AuthSdkError', 'sdk_state_mismatch'],
    [new AuthSdkError("OAuth flow response nonce doesn't match request nonce"), 'AuthSdkError', 'sdk_nonce_mismatch'],
    [new AuthSdkError('The issuer [PRIVATE-value] does not match [PRIVATE-value]'), 'AuthSdkError', 'unknown'],
    [new OAuthError('access_denied', 'PRIVATE-message', { token: 'PRIVATE-token' }), 'OAuthError', 'oauth_access_denied'],
    [new OAuthError('PRIVATE-code', 'PRIVATE-message'), 'OAuthError', 'unknown'],
    [new AuthApiError({ errorSummary: 'PRIVATE-message', errorCode: 'PRIVATE-code' }), 'AuthApiError', 'unknown'],
    [Object.assign(new Error('PRIVATE-message'), { name: 'PRIVATE-class' }), 'unknown', 'unknown']
])('diagnostic class/reason uses only pinned SDK vocabulary %#', (error, exception, reason) => {
    const diagnostic = createDiagnostic();
    diagnostic.stage = 'sdk_parse';
    captureDiagnostic(diagnostic, error);
    captureDiagnostic(diagnostic, new Error('PRIVATE-cleanup-error')); // Never replace the first failure.
    expect(formatDiagnostic(diagnostic)).toBe(`stage=sdk_parse class=${exception} reason=${reason}`);
    expect(JSON.stringify(diagnostic)).not.toContain('PRIVATE');
    expect(Object.values(diagnostic)).not.toContain(error);
    expect(formatDiagnostic({ stage: 'PRIVATE-stage', exception: 'PRIVATE-class', reason: 'PRIVATE-reason' }))
        .toBe('stage=unknown class=unknown reason=unknown');
});

test.each(['/api/react/synthetic', '/api/view/synthetic'].flatMap(target => [
    ['valid', null], ['new-tab', null], ['missing-bridge', 'stage=bridge_check class=unknown reason=bridge_transaction_missing'],
    ['missing-query', 'stage=bridge_check class=unknown reason=redirect_not_recognized'],
    ['missing-sdk', 'stage=sdk_parse class=AuthSdkError reason=sdk_pkce_missing'],
    ['sdk-state', 'stage=sdk_parse class=AuthSdkError reason=sdk_state_mismatch'],
    ['wrong-state', 'stage=bridge_check class=unknown reason=bridge_transaction_missing'],
    ['wrong-nonce', 'stage=id_token_check class=unknown reason=bridge_nonce_mismatch'],
    ['bad-signature', 'stage=sdk_parse class=AuthSdkError reason=sdk_signature_invalid'],
    ['oauth-denied', 'stage=sdk_parse class=OAuthError reason=oauth_access_denied'],
    ['token-network', 'stage=sdk_parse class=AuthApiError reason=unknown'],
    ['session-denied', 'stage=session_submit class=unknown reason=session_http'],
    ['session-network', 'stage=session_submit class=unknown reason=session_transport'],
    ['session-invalid', 'stage=session_submit class=unknown reason=session_invalid_json'],
    ['config-network', 'stage=config_fetch class=unknown reason=unknown'],
    ['config-invalid', 'stage=config_parse class=unknown reason=unknown'],
    ['sdk-init', 'stage=sdk_init class=AuthSdkError reason=unknown']
].map(([mode, expected]) => [target, mode, expected])))(
    'actual entrypoint for %s shows fixed diagnostic for %s', async (target, mode, expected) => {
        const sentinel = 'PRIVATE-code-state-nonce-csrf-token-claim-identity-message';
        document.body.innerHTML = '<h1 id="status">Completing sign-in</h1><a id="retry" hidden>Return</a>';
        const oldLocation = window.location;
        const assign = jest.fn();
        const replace = jest.fn();
        delete window.location;
        window.location = { ...oldLocation, assign, replace, pathname: '/api/okta/callback' };
        let callback = false;
        const signed = idToken({ nonce: mode === 'wrong-nonce' ? 'other' : sentinel,
            email: sentinel + '@example.invalid', sub: sentinel });
        global.fetch = jest.fn(async url => {
            let body = metadata;
            let status = 200;
            if (url === '/api/okta/config') {
                if (mode === 'config-network') throw new TypeError(sentinel);
                body = { ...config, enabled: true, ...(mode === 'sdk-init' ? { issuer: '' } : {}) };
            }
            if (url.endsWith('/keys')) body = { keys: [jwk] };
            if (url.endsWith('/token')) {
                if (callback && mode === 'token-network') throw new TypeError(sentinel);
                let jwt = signed.idToken;
                if (mode === 'bad-signature') {
                    const parts = jwt.split('.');
                    parts[2] = 'AAAAAAAA' + parts[2].slice(8);
                    jwt = parts.join('.');
                }
                body = { id_token: jwt, access_token: idToken({ aud: 'resource' }).idToken,
                    token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile' };
            }
            if (url === '/api/okta/session') {
                if (mode === 'session-network') throw new TypeError(sentinel);
                status = mode === 'session-denied' ? 403 : 200;
                body = status === 200 ? { authenticated: true } : { error: sentinel };
            }
            return { ok: status < 400, status, headers: new Map(), text: async () =>
                (callback && mode === 'config-invalid' && url === '/api/okta/config') ||
                (mode === 'session-invalid' && url === '/api/okta/session') ? sentinel : JSON.stringify(body) };
        });
        const client = createClient(config);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const state = beginBridgeTransaction(config, '/api', { nonce: sentinel, csrf: sentinel }, target);
            await client.signInWithRedirect({ state, nonce: sentinel, prompt: 'login' });
            expect(new URL(assign.mock.calls[0][0]).searchParams.get('state')).toBe(state);
            window.location.search = mode === 'oauth-denied' ? '?error=access_denied&error_description=' + sentinel +
                '&state=' + state : '?code=' + sentinel + '&state=' + (mode === 'wrong-state' ? 'other' : state);
            if (mode === 'missing-query') window.location.search = '?state=' + state;
            window.location.href = config.redirectUri + window.location.search;
            if (mode === 'missing-bridge') clearBridgeTransaction(config, '/api', state);
            if (mode === 'missing-sdk') client.transactionManager.clear();
            if (mode === 'new-tab') sessionStorage.clear(); // No opener copy; SDK shared state and bridge remain.
            if (mode === 'sdk-state') {
                const shared = JSON.parse(localStorage.getItem('okta-shared-transaction-storage'));
                shared[state].transaction.state = 'synthetic-other-state';
                localStorage.setItem('okta-shared-transaction-storage', JSON.stringify(shared));
            }
            callback = true;
            const history = jest.spyOn(window.history, 'replaceState');
            let running;
            jest.isolateModules(() => {
                const module = require('./okta');
                const real = module.runBridge;
                jest.spyOn(module, 'runBridge').mockImplementation(diagnostic => {
                    running = real(diagnostic);
                    return running;
                });
                require('./okta-entry');
            });
            await running.catch(() => {});
            await Promise.resolve();
            const succeeded = ['valid', 'new-tab'].includes(mode);
            expect(document.getElementById('status').textContent).toBe(succeeded ? 'Completing sign-in' :
                'Sign-in or sign-out could not be completed. Return to Foursight and try again.');
            expect(document.getElementById('diagnostic')?.textContent || null)
                .toBe(expected ? 'Diagnostic: ' + expected : null);
            expect(document.getElementById('retry').hidden).toBe(succeeded);
            expect(replace.mock.calls).toEqual(succeeded ? [[target]] : []);
            expect(Object.keys(client.tokenManager.getTokensSync())).toEqual(succeeded ? ['idToken'] : []);
            expect(history).toHaveBeenLastCalledWith(null, '', '/api/okta/callback');
            expect(bridgeRecord(state) !== null)
                .toBe(['config-invalid', 'config-network', 'sdk-init', 'wrong-state'].includes(mode));
            const sessionCalls = fetch.mock.calls.filter(([url]) => url === '/api/okta/session');
            expect(sessionCalls).toHaveLength(['valid', 'new-tab', 'session-denied', 'session-network', 'session-invalid']
                .includes(mode) ? 1 : 0);
            expect(document.body.textContent).not.toContain(sentinel);
            expect(document.body.textContent).not.toContain(signed.idToken);
            expect(document.body.textContent).not.toContain(state);
            expect(consoleError).not.toHaveBeenCalled(); // UI only: no raw SDK/browser exception logging.
        } finally {
            client.stop();
            window.location = oldLocation;
            window.history.replaceState(null, '', '/');
        }
    });

test('shared logout route clears only its app bridge namespace without silently signing in', async () => {
    const own = beginBridgeTransaction(config, '/api', { nonce: 'nonce', csrf: 'csrf' }, '/api/react');
    const foreign = beginBridgeTransaction({ ...config, clientId: 'other-spa' }, '/api',
        { nonce: 'other', csrf: 'other' }, '/api/react');
    const old = window.location;
    const replace = jest.fn();
    delete window.location;
    window.location = { ...old, pathname: '/api/okta/logout', replace };
    global.fetch = jest.fn(async url => ({ ok: true, text: async () => JSON.stringify(
        url === '/api/okta/config' ? { ...config, enabled: true } : { loggedOut: true }) }));
    try {
        await runBridge();
        expect(bridgeRecord(own)).toBeNull();
        expect(bridgeRecord(foreign)).toEqual(expect.objectContaining({ nonce: 'other', csrf: 'other' }));
        expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/okta/config', '/api/okta/logout']);
        expect(replace).toHaveBeenCalledWith(config.postLogoutRedirectUri);
    } finally { window.location = old; }
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
        const state = beginBridgeTransaction(config, '/api', { nonce: 'nonce', csrf: 'csrf' }, target);
        await client.signInWithRedirect({ state, nonce: 'nonce' });
        window.history.replaceState(null, '', '/api/okta/callback?code=synthetic&state=' + state);
        window.location.search = '?code=synthetic&state=' + state;
        window.location.href = config.redirectUri + window.location.search;
        const outcome = await runBridge().then(() => 'accepted', error => error.message);
        expect(outcome).toBe(accepted ? 'accepted' :
            'Sign-in or sign-out could not be completed. Return to Foursight and try again.');
        expect(replace.mock.calls).toEqual(accepted ? [[target]] : []);
        expect(assign).toHaveBeenCalledTimes(1); // Callback never starts a new authorization.
        const stored = client.tokenManager.getTokensSync();
        expect(Object.keys(stored)).toEqual(accepted ? ['idToken'] : []);
        expect(stored.idToken?.claims.email_verified).toBe(accepted ? false : undefined);
        expect(sessionRequests).toEqual([{ idToken: unverified.idToken, csrf: 'csrf' }]);
        expect(bridgeRecord(state)).toBeNull();
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
            const state = beginBridgeTransaction(config, '/api', { nonce: 'nonce', csrf: 'csrf' }, '/api/view/synthetic');
            await client.signInWithRedirect({ state, nonce: 'nonce', prompt });
            window.location.search = '?code=synthetic&state=' + state;
            window.location.href = config.redirectUri + window.location.search;
            jest.useFakeTimers();
            const diagnostic = createDiagnostic();
            const outcome = runBridge(diagnostic).then(() => 'accepted', error => error.message);
            await started;
            jest.advanceTimersByTime(14999);
            expect(sessionSignal.aborted).toBe(false);
            expect(serverFinished).toBe(false);
            jest.advanceTimersByTime(1);
            expect(sessionSignal.aborted).toBe(true);
            expect(await outcome).toBe(
                'Sign-in or sign-out could not be completed. Return to Foursight and try again.');
            expect(formatDiagnostic(diagnostic)).toBe('stage=session_submit class=unknown reason=session_timeout');
            expect(serverFinished).toBe(false);
            expect(assign).toHaveBeenCalledTimes(1);
            expect(replace).not.toHaveBeenCalled();
            expect(bridgeRecord(state)).toBeNull();
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
