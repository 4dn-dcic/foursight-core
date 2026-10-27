// The SDK already shares its state-keyed PKCE transaction between same-origin
// tabs. Keep the separate server nonce/CSRF binding available to that same return
// path, without a global "latest transaction" or any token/session restoration.
export const BRIDGE_TTL = 10 * 60 * 1000;
const PREFIX = 'foursight-okta-transaction:v2:';
const isState = state => typeof state === 'string' && /^[a-f0-9]{64}$/.test(state);

function namespace(config, base) {
    return PREFIX + encodeURIComponent(JSON.stringify([
        window.location.origin, base, config.issuer, config.clientId
    ])) + ':';
}

function valid(record, state, now) {
    return record && record.state === state &&
        typeof record.nonce === 'string' && record.nonce.length > 0 &&
        typeof record.csrf === 'string' && record.csrf.length > 0 && typeof record.target === 'string' &&
        Number.isSafeInteger(record.created) && Number.isSafeInteger(record.expires) &&
        record.created <= now && now < record.expires &&
        record.expires > record.created && record.expires - record.created <= BRIDGE_TTL;
}

function parse(value) {
    try { return JSON.parse(value); }
    catch (_) { return null; } // Malformed records are never usable transactions.
}

function prune(storage, prefix, now) {
    // Snapshot keys: deleting one must not skip another. Never clear another
    // app/client/stage's records or inspect unrelated browser storage values.
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    keys.filter(key => key && key.startsWith(prefix)).forEach(key => {
        const state = key.slice(prefix.length);
        if (!isState(state) || !valid(parse(storage.getItem(key)), state, now)) storage.removeItem(key);
    });
}

export function beginBridgeTransaction(config, base, transaction, target) {
    const storage = window.localStorage; // Storage errors fail closed; no fallback.
    const prefix = namespace(config, base);
    const now = Date.now();
    prune(storage, prefix, now);
    const random = window.crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    const record = { state, nonce: transaction.nonce, csrf: transaction.csrf, target,
        created: now, expires: now + BRIDGE_TTL };
    if (!valid(record, state, now)) throw new Error('Invalid authentication transaction');
    storage.setItem(prefix + state, JSON.stringify(record));
    return state;
}

export function callbackState(search) {
    const states = new URLSearchParams(search).getAll('state');
    return states.length === 1 && isState(states[0]) ? states[0] : null;
}

export function takeBridgeTransaction(config, base, state) {
    if (!isState(state)) return null;
    const storage = window.localStorage;
    const prefix = namespace(config, base);
    const now = Date.now();
    prune(storage, prefix, now);
    const key = prefix + state;
    const record = parse(storage.getItem(key));
    // Consume before async token redemption. Concurrent/replayed callbacks still
    // require the SDK state/PKCE, single-use authorization code and server cookie.
    storage.removeItem(key);
    return valid(record, state, now) ? record : null;
}

export function clearBridgeTransaction(config, base, state) {
    if (isState(state)) window.localStorage.removeItem(namespace(config, base) + state);
}

export function clearBridgeTransactions(config, base) {
    const storage = window.localStorage;
    const prefix = namespace(config, base);
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    keys.filter(key => key && key.startsWith(prefix)).forEach(key => storage.removeItem(key));
}
