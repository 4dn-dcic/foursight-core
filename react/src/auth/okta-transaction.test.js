import { webcrypto } from 'crypto';
import { BRIDGE_TTL, beginBridgeTransaction, callbackState, takeBridgeTransaction,
    clearBridgeTransaction, clearBridgeTransactions } from './okta-transaction';

const config = { issuer: 'https://synthetic.okta.invalid/oauth2/default', clientId: 'synthetic-spa' };
const binding = { nonce: 'synthetic-nonce', csrf: 'synthetic-csrf' };
const begin = (cfg = config, base = '/api') => beginBridgeTransaction(cfg, base, binding, '/api/view/synthetic');
const keyFor = state => Object.keys(localStorage).find(key => key.endsWith(':' + state));

beforeAll(() => Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => jest.restoreAllMocks());

test('fresh 256-bit states bind distinct records; only exact returned state selects one', () => {
    const random = jest.spyOn(window.crypto, 'getRandomValues');
    const first = begin(); const second = begin();
    expect(random).toHaveBeenCalledTimes(2);
    expect(random.mock.calls[0][0]).toHaveLength(32);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
    expect(callbackState('?code=synthetic&state=' + first)).toBe(first);
    expect(takeBridgeTransaction(config, '/api', 'a'.repeat(64))).toBeNull();
    expect(takeBridgeTransaction(config, '/api', first)).toEqual(expect.objectContaining({ state: first, ...binding }));
    expect(takeBridgeTransaction(config, '/api', first)).toBeNull(); // Consumed, never restored from tokens/latest.
    expect(takeBridgeTransaction(config, '/api', second)).toEqual(expect.objectContaining({ state: second, ...binding }));
});

test.each(['', '?code=synthetic', '?state=', '?state=short', '?state=' + 'a'.repeat(65),
    '?state=' + 'a'.repeat(64) + '&state=' + 'a'.repeat(64), '?state=' + '<PRIVATE>'.repeat(8)])(
    'missing, malformed or duplicate returned state fails closed: %s', query => {
        const state = begin();
        expect(callbackState(query)).toBeNull();
        expect(takeBridgeTransaction(config, '/api', callbackState(query))).toBeNull();
        expect(keyFor(state)).toBeDefined(); // Unknown callback cannot consume a different login.
    });

test('same-origin cross-tab return needs no per-tab bridge or SDK token', () => {
    const state = begin();
    sessionStorage.clear();
    expect(takeBridgeTransaction(config, '/api', state)).toEqual(expect.objectContaining(binding));
    expect(Object.keys(localStorage)).toHaveLength(0);
});

test.each([
    [{ ...config, clientId: 'other-spa' }, '/api'],
    [{ ...config, issuer: 'https://other.okta.invalid/oauth2/default' }, '/api'],
    [config, '/other-stage']
])('other client/issuer/base cannot read or clear this transaction %#', (other, base) => {
    const state = begin();
    expect(takeBridgeTransaction(other, base, state)).toBeNull();
    clearBridgeTransaction(other, base, state);
    clearBridgeTransactions(other, base);
    expect(takeBridgeTransaction(config, '/api', state)).toEqual(expect.objectContaining(binding));
});

test('origin namespace remains distinct even if a fixture shares storage across origins', () => {
    const state = begin(); const old = window.location;
    delete window.location; window.location = { ...old, origin: 'https://other.invalid' };
    try {
        expect(takeBridgeTransaction(config, '/api', state)).toBeNull();
        clearBridgeTransactions(config, '/api');
    } finally { window.location = old; }
    expect(takeBridgeTransaction(config, '/api', state)).toEqual(expect.objectContaining(binding));
});

test('records expire at 10 minutes, not the SDK shared-storage 30-minute lifetime', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000000);
    const first = begin(); const second = begin();
    clock.mockReturnValue(1000000 + BRIDGE_TTL - 1);
    expect(takeBridgeTransaction(config, '/api', first)).toEqual(expect.objectContaining(binding));
    clock.mockReturnValue(1000000 + BRIDGE_TTL);
    expect(takeBridgeTransaction(config, '/api', second)).toBeNull();
    expect(keyFor(second)).toBeUndefined();
});

test.each(['invalid-json', 'mismatched-state', 'extended-ttl', 'future-created', 'missing-csrf', 'missing-nonce'])(
    'malformed record never recovers a session: %s', mode => {
        const clock = jest.spyOn(Date, 'now').mockReturnValue(1000000);
        const state = begin(); const key = keyFor(state); const record = JSON.parse(localStorage.getItem(key));
        if (mode === 'mismatched-state') record.state = 'b'.repeat(64);
        if (mode === 'extended-ttl') record.expires = record.created + BRIDGE_TTL + 1;
        if (mode === 'future-created') clock.mockReturnValue(record.created - 1);
        if (mode === 'missing-csrf') delete record.csrf;
        if (mode === 'missing-nonce') delete record.nonce;
        localStorage.setItem(key, mode === 'invalid-json' ? 'PRIVATE-malformed' : JSON.stringify(record));
        expect(takeBridgeTransaction(config, '/api', state)).toBeNull();
        expect(localStorage.getItem(key)).toBeNull();
    });

test('pruning and logout clear only this app namespace, not another pending app/client', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000000);
    const expired = begin(); const other = { ...config, clientId: 'other' }; const foreign = begin(other);
    localStorage.setItem('unrelated', 'PRIVATE-unrelated');
    clock.mockReturnValue(1000000 + BRIDGE_TTL);
    const current = begin();
    expect(keyFor(expired)).toBeUndefined();
    expect(keyFor(foreign)).toBeDefined(); // Even expired foreign values are not ours to inspect/prune.
    clearBridgeTransactions(config, '/api');
    expect(keyFor(current)).toBeUndefined();
    expect(keyFor(foreign)).toBeDefined();
    expect(localStorage.getItem('unrelated')).toBe('PRIVATE-unrelated');
});

test('failure cleanup for one login preserves the other login and unrelated storage', () => {
    const first = begin(); const second = begin();
    clearBridgeTransaction(config, '/api', first);
    expect(takeBridgeTransaction(config, '/api', first)).toBeNull();
    expect(takeBridgeTransaction(config, '/api', second)).toEqual(expect.objectContaining(binding));
});

test.each(['getItem', 'setItem'])('storage %s failure is not replaced with a per-tab/latest fallback', method => {
    const state = begin();
    jest.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('PRIVATE-storage-error'); });
    expect(() => method === 'setItem' ? begin() : takeBridgeTransaction(config, '/api', state)).toThrow();
    expect(sessionStorage.length).toBe(0);
});
