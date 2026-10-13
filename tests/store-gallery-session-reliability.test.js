'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../addon/solana-session.js');
require('../program/client/hearth-pass-client.js');
const A = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const B = '7jhqV2NTmWJayyUFUKJ8Xv97EJovAEqACzqCLXXCGnoV';
const origin = { origin: 'https://heartui.ipfps.org' };
function setup(extra = {}) {
  const store = { [S.SESSION_KEY]: { address: A, jwt: null, network: 'devnet' }, [S.OWNED_KEY]: { skus: ['bundle_focus'], items: [{ sku: 'bundle_focus', verified: 'onchain' }] } };
  const chrome = { storage: { local: {
    get(keys, cb) { cb(Object.fromEntries(keys.filter(k => k in store).map(k => [k, store[k]]))); },
    set(value, cb) { Object.assign(store, value); cb(); },
    remove(keys, cb) { keys.forEach(k => delete store[k]); cb(); }
  } } };
  return { store, api: S.create({ chrome, ...extra }) };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('Pass ownership RPC failure rejects instead of declaring a valid pass absent', async () => {
  await assert.rejects(globalThis.HearthPass.isOwned(async () => { throw new Error('offline'); }, A, 'bundle_focus'), /offline/);
  assert.equal(await globalThis.HearthPass.isOwned(async () => ({ value: null }), A, 'bundle_focus'), false);
});

test('refresh preserves cached failed SKU and reports error until successful retry', async () => {
  let offline = true;
  const { api } = setup({ passCheck: async (_, sku) => { if (sku === 'bundle_focus' && offline) throw new Error('offline'); return false; } });
  const events = []; api.onChange(kind => events.push(kind));
  assert.deepEqual((await api.refreshOwned()).map(x => x.sku), ['bundle_focus']);
  assert.match(api.lastError().message, /offline/);
  assert.ok(events.includes('error'));
  offline = false;
  assert.deepEqual(await api.refreshOwned(), []);
  assert.equal(api.lastError(), null);
});

test('wallet switch immediately clears previous wallet ownership while verification is unavailable', async () => {
  const { api } = setup({ passCheck: async () => null });
  await api.handle({ v: 1, type: 'session', address: B, jwt: null, network: 'devnet' }, origin);
  assert.deepEqual(await api.getOwned(), []);
});

test('signout prevents delayed chain refresh from restoring ownership', async () => {
  const gate = deferred(), entered = deferred();
  const { api } = setup({ passCheck: async () => { entered.resolve(); return gate.promise; } });
  const pending = api.refreshOwned(); await entered.promise;
  await api.signOut(); gate.resolve(true); await pending;
  assert.deepEqual(await api.getOwned(), []);
});

test('wallet switch prevents delayed IPFPS ownership response from granting old wallet purchase', async () => {
  const gate = deferred(), entered = deferred();
  const { store, api } = setup({ fetch: async () => { entered.resolve(); return gate.promise; }, passCheck: async () => null });
  store[S.SESSION_KEY].jwt = 'old-session';
  const pending = api.refreshOwned(); await entered.promise;
  await api.handle({ v: 1, type: 'session', address: B, jwt: null, network: 'devnet' }, origin);
  gate.resolve({ ok: true, json: async () => ({ owned: [{ sku: 'theme_aurora' }] }) }); await pending;
  assert.deepEqual(await api.getOwned(), []);
});

test('malformed cached entitlement objects cannot crash or grant unknown products', async () => {
  const { store, api } = setup();
  store[S.OWNED_KEY] = { items: [null, {}, { sku: 'unknown' }, { sku: 'bundle_focus' }, 'icons_mono', { sku: 'bundle_focus' }] };
  assert.deepEqual((await api.getOwned()).map(x => x.sku), ['bundle_focus', 'icons_mono']);
  assert.equal(await api.isOwned('unknown'), false);
  store[S.OWNED_KEY] = { items: { sku: 'theme_aurora' } };
  assert.deepEqual(await api.getOwned(), []);
});

test('newer refresh wins over a delayed response for the same session', async () => {
  const gate = deferred(), entered = deferred(); let calls = 0;
  const { store, api } = setup({ fetch: async () => {
    if (++calls === 1) { entered.resolve(); return gate.promise; }
    return { ok: true, json: async () => ({ owned: [{ sku: 'icons_mono' }] }) };
  } });
  store[S.SESSION_KEY].jwt = 'session';
  const older = api.refreshOwned(); await entered.promise;
  await api.refreshOwned();
  gate.resolve({ ok: true, json: async () => ({ owned: [{ sku: 'theme_aurora' }] }) }); await older;
  assert.deepEqual((await api.getOwned()).map(x => x.sku), ['icons_mono']);
});

test('same wallet reconnect preserves verified cache if checker is unavailable', async () => {
  const { api } = setup({ passCheck: async () => null });
  await api.handle({ v: 1, type: 'session', address: A, jwt: null, network: 'devnet' }, origin);
  assert.equal(await api.isOwned('bundle_focus'), true);
});

test('IPFPS malformed entitlement entries are filtered before storing ownership', async () => {
  const { store, api } = setup({ fetch: async () => ({ ok: true, json: async () => ({ owned: [null, { sku: 'unknown' }, { sku: 'clock_orbit', source: 'pass' }, { sku: 'clock_orbit' }] }) }) });
  store[S.SESSION_KEY].jwt = 'session';
  assert.deepEqual((await api.refreshOwned()).map(x => x.sku), ['clock_orbit']);
  assert.deepEqual(store[S.OWNED_KEY].skus, ['clock_orbit']);
});

test('successful chain fallback clears an IPFPS transport failure for gallery retry', async () => {
  const { store, api } = setup({ fetch: async () => { throw new Error('IPFPS offline'); }, passCheck: async (_, sku) => sku === 'bundle_focus' });
  store[S.SESSION_KEY].jwt = 'session';
  assert.equal((await api.refreshOwned()).some(x => x.sku === 'bundle_focus'), true);
  assert.equal(api.lastError(), null);
});

test('explicitly unowned or pending IPFPS bundle cannot produce child grants', async () => {
  const { store, api } = setup({ fetch: async () => ({ ok: true, json: async () => ({ owned: [{sku:'bundle_focus',owned:false},{sku:'theme_aurora',status:'pending'}] }) }) });
  store[S.SESSION_KEY].jwt = 'session';
  assert.deepEqual(await api.refreshOwned(), []);
  assert.deepEqual(store[S.OWNED_KEY].skus, []);
});
