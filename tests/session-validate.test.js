'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../addon/solana-session.js');
const ADDR = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const SIG = '5'.repeat(88);

test('validateSender accepts only allowed origins', () => {
  assert.equal(S.validateSender({ origin: 'https://heartui.ipfps.org' }), true);
  assert.equal(S.validateSender({ url: 'http://localhost:3434/bridge/#x' }), true);
  assert.equal(S.validateSender({ origin: 'https://heartui.ipfps.org.evil.com' }), false);
  assert.equal(S.validateSender({ url: 'https://evil.com/?https://heartui.ipfps.org' }), false);
  assert.equal(S.validateSender({}), false);
});

test('validateMessage: session', () => {
  assert.equal(S.validateMessage({ v: 1, type: 'session', address: ADDR, jwt: 'a.b.c', network: 'devnet' }).ok, true);
  assert.equal(S.validateMessage({ v: 1, type: 'session', address: ADDR, jwt: null, network: 'devnet' }).ok, true);
  assert.equal(S.validateMessage({ v: 2, type: 'session', address: ADDR, jwt: null, network: 'devnet' }).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'session', address: 'bad!', jwt: null, network: 'devnet' }).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'session', address: ADDR, jwt: null, network: 'mainnet' }).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'session', address: ADDR, jwt: 5, network: 'devnet' }).ok, false);
});

test('validateMessage: purchase and error', () => {
  assert.equal(S.validateMessage({ v: 1, type: 'purchase', sku: 'supporter', method: 'usdc', tx_signature: SIG, status: 'confirmed' }).ok, true);
  assert.equal(S.validateMessage({ v: 1, type: 'purchase', sku: 'supporter', method: 'pass', tx_signature: SIG, status: 'confirmed' }).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'purchase', sku: 'nope', method: 'usdc', tx_signature: SIG, status: 'confirmed' }).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'purchase', sku: 'supporter', method: 'usdc', tx_signature: SIG, status: 'pending' }).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'error', action: 'pay', code: 'rejected', message: 'x' }).ok, true);
  assert.equal(S.validateMessage({ v: 1, type: 'error', action: 'pay', code: 'x'.repeat(100), message: 'x' }).ok, false);
  assert.equal(S.validateMessage(null).ok, false);
  assert.equal(S.validateMessage({ v: 1, type: 'other' }).ok, false);
});

function fakeChrome() {
  const store = {}; let listener;
  return { store, send: (m, s) => new Promise((r) => listener(m, s, r)), chrome: {
    runtime: { onMessageExternal: { addListener: (f) => { listener = f; } } },
    storage: { local: {
      get: (k, cb) => { const o = {}; [].concat(k).forEach((x) => { if (x in store) o[x] = store[x]; }); cb ? cb(o) : null; return Promise.resolve(o); },
      set: (o, cb) => { Object.assign(store, o); cb && cb(); return Promise.resolve(); },
      remove: (k, cb) => { [].concat(k).forEach((x) => delete store[x]); cb && cb(); return Promise.resolve(); },
    } } } };
}

test('installed listener stores session and purchase; rejects bad sender', async () => {
  const f = fakeChrome();
  const api = S.create({ chrome: f.chrome, fetch: async () => { throw new Error('offline'); }, open: () => {} });
  api.install();
  const origin = { origin: 'https://heartui.ipfps.org' };
  assert.deepEqual(await f.send({ v: 1, type: 'session', address: ADDR, jwt: 'j', network: 'devnet' }, origin), { ok: true });
  assert.equal(f.store['hearth.solana.session'].address, ADDR);
  assert.equal((await f.send({ v: 1, type: 'session', address: ADDR, jwt: 'j', network: 'devnet' }, { origin: 'https://evil.com' })).ok, false);
  assert.deepEqual(await f.send({ v: 1, type: 'purchase', sku: 'supporter', method: 'usdc', tx_signature: SIG, status: 'confirmed' }, origin), { ok: true });
  assert.equal(await api.isOwned('supporter'), true);
  assert.equal(await api.isOwned('theme_dune'), false);
  assert.deepEqual(f.store['hearth.solana.owned'].skus, ['supporter']);
  assert.equal((await api.getSession()).jwt, 'j');
});

test('openBridge builds the contract URL', () => {
  let url; const f = fakeChrome();
  const api = S.create({ chrome: f.chrome, open: (u) => { url = u; } });
  api.openBridge('buy', 'theme_aurora');
  assert.equal(url, 'https://heartui.ipfps.org/bridge/#action=buy&sku=theme_aurora');
  assert.throws(() => api.openBridge('steal'));
});

test('refreshOwned prefers IPFPS owned list', async () => {
  const f = fakeChrome();
  f.store['hearth.solana.session'] = { address: ADDR, jwt: 'j', network: 'devnet' };
  let hdr;
  const api = S.create({ chrome: f.chrome, open: () => {}, fetch: async (u, o) => { hdr = o.headers['Init-Data']; return { ok: true, status: 200, json: async () => ({ owned: [{ sku: 'theme_dune', source: 'pass' }], catalog_version: 1 }) }; } });
  const owned = await api.refreshOwned();
  assert.equal(hdr, 'j');
  assert.deepEqual(owned.map((o) => o.sku), ['theme_dune']);
});

test('refreshOwned falls back to on-chain pass check', async () => {
  const f = fakeChrome();
  f.store['hearth.solana.session'] = { address: ADDR, jwt: null, network: 'devnet' };
  const api = S.create({ chrome: f.chrome, open: () => {}, fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) }),
    passCheck: async (addr, sku) => sku === 'icons_glass' });
  const owned = await api.refreshOwned();
  assert.deepEqual(owned.map((o) => [o.sku, o.source]), [['icons_glass', 'pass']]);
});
