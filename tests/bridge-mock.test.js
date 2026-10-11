'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const M = require('../mock/ipfps-mock.js');
const SL = require('../bridge/vendor/solana-lite.js');

function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function wallet() {
  const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('ed25519');
  const raw = new Uint8Array(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32));
  return { address: SL.base58Encode(raw), sign: (msg) => SL.base58Encode(new Uint8Array(nodeCrypto.sign(null, Buffer.from(msg), privateKey))) };
}
const B = 'https://heartui.ipfps.org';
async function call(f, method, path, body, jwt) {
  const headers = { 'Content-Type': 'application/json' }; if (jwt) headers['Init-Data'] = jwt;
  const r = await f(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
async function login(f, w) {
  const n = await call(f, 'GET', '/api/auth/nonce?address=' + w.address);
  const message = 'Sign in to HearthUI (heartui.ipfps.org)\n\nNonce: ' + n.body.nonce + '\nIssued At: 2026-10-12T00:00:00Z';
  return call(f, 'POST', '/api/auth/web3/verify', { address: w.address, chain: 'solana', walletName: 'Phantom', message, signature: w.sign(message), device_id: 'web-1', language: 'en' });
}
const sig = () => SL.base58Encode(nodeCrypto.randomBytes(64));

test('auth flow: nonce -> verify -> token, nonce single use, bad sig rejected', async () => {
  const f = M.createMockFetch({ storage: memStorage() });
  const w = wallet();
  const v = await login(f, w);
  assert.equal(v.status, 200); assert.equal(typeof v.body.token, 'string'); assert.equal(v.body.is_new_user, true);
  assert.equal((await login(f, w)).body.is_new_user, false);
  const n = await call(f, 'GET', '/api/auth/nonce?address=' + w.address);
  const msg = 'Nonce: ' + n.body.nonce;
  const bad = await call(f, 'POST', '/api/auth/web3/verify', { address: w.address, chain: 'solana', message: msg, signature: wallet().sign(msg) });
  assert.equal(bad.status, 401); assert.equal(bad.body.error, 'invalid cryptographic signature');
  const reuse = await call(f, 'POST', '/api/auth/web3/verify', { address: w.address, chain: 'solana', message: msg, signature: w.sign(msg) });
  assert.equal(reuse.status, 401);
  assert.equal((await call(f, 'GET', '/api/auth/nonce?address=bad')).status, 400);
});

test('user/me, owned, claim shapes and error codes', async () => {
  const st = memStorage();
  const f = M.createMockFetch({ storage: st });
  const jwt = (await login(f, wallet())).body.token;
  assert.equal((await call(f, 'GET', '/api/user/me')).status, 401);
  const me = await call(f, 'GET', '/api/user/me', null, jwt);
  assert.equal(me.status, 200); assert.ok(me.body.id && 'nickname' in me.body && 'season_xp' in me.body);
  assert.deepEqual((await call(f, 'GET', '/api/hearth/owned', null, jwt)).body, { owned: [], catalog_version: 1 });
  assert.equal((await call(f, 'POST', '/api/hearth/claim', { sku: 'x', tx_signature: sig(), chain: 'solana-devnet' }, jwt)).body.error, 'unknown_sku');
  assert.equal((await call(f, 'POST', '/api/hearth/claim', { sku: 'supporter', tx_signature: 'zz', chain: 'solana-devnet' }, jwt)).body.error, 'invalid_signature_format');
  const s = sig();
  const c = await call(f, 'POST', '/api/hearth/claim', { sku: 'supporter', tx_signature: s, chain: 'solana-devnet' }, jwt);
  assert.equal(c.status, 200); assert.equal(c.body.status, 'granted');
  assert.deepEqual(Object.keys(c.body.entitlement).sort(), ['amount', 'granted_at', 'sku', 'source', 'token', 'tx_signature']);
  assert.equal(c.body.entitlement.source, 'usdc'); assert.equal(c.body.entitlement.amount, '4.99');
  assert.equal((await call(f, 'POST', '/api/hearth/claim', { sku: 'supporter', tx_signature: s, chain: 'solana-devnet' }, jwt)).status, 200);
  const owned = await call(f, 'GET', '/api/hearth/owned', null, jwt);
  assert.equal(owned.body.owned.length, 1);
  const jwt2 = (await login(f, wallet())).body.token;
  const dup = await call(f, 'POST', '/api/hearth/claim', { sku: 'supporter', tx_signature: s, chain: 'solana-devnet' }, jwt2);
  assert.equal(dup.status, 409); assert.equal(dup.body.error, 'tx_already_used');
  const p = await call(f, 'POST', '/api/hearth/claim', { sku: 'theme_aurora', tx_signature: sig(), chain: 'solana-devnet' }, jwt2);
  assert.equal(p.body.entitlement.source, 'pass');
  // persisted: new mock instance on same storage sees the data
  const f2 = M.createMockFetch({ storage: st });
  assert.equal((await call(f2, 'GET', '/api/hearth/owned', null, jwt)).body.owned[0].sku, 'supporter');
});

test('focus + leaderboard', async () => {
  const f = M.createMockFetch({ storage: memStorage() });
  const jwt = (await login(f, wallet())).body.token;
  const started = new Date(Date.now() - 30 * 60000).toISOString();
  assert.equal((await call(f, 'POST', '/api/hearth/focus', { session_id: 'a', minutes: 2, started_at: started }, jwt)).body.error, 'invalid_minutes');
  assert.equal((await call(f, 'POST', '/api/hearth/focus', { session_id: 'b', minutes: 25, started_at: new Date().toISOString() }, jwt)).body.error, 'too_early');
  const ok = await call(f, 'POST', '/api/hearth/focus', { session_id: 'c', minutes: 25, started_at: started }, jwt);
  assert.deepEqual(ok.body, { xp_added: 250, season_xp: 250, rank: 1 });
  assert.deepEqual((await call(f, 'POST', '/api/hearth/focus', { session_id: 'c', minutes: 25, started_at: started }, jwt)).body, ok.body);
  assert.equal((await call(f, 'POST', '/api/hearth/focus', { session_id: 'd', minutes: 20, started_at: started }, jwt)).body.error, 'overlapping_session');
  const lb = await call(f, 'GET', '/api/leaderboard?season=focus_2026_10&limit=10');
  assert.equal(lb.status, 200);
  assert.deepEqual(Object.keys(lb.body.entries[0]).sort(), ['nickname', 'rank', 'score']);
});

test('non-mock URLs pass through to real fetch', async () => {
  let hit;
  const f = M.createMockFetch({ storage: memStorage(), realFetch: async (u) => { hit = u; return 'real'; } });
  assert.equal(await f('https://api.devnet.solana.com', {}), 'real');
  assert.equal(hit, 'https://api.devnet.solana.com');
});
