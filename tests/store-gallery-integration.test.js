const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../addon/config.js');
const S = require('../addon/solana-session.js');
require('../program/client/hearth-pass-client.js');
const P = globalThis.HearthPass;
const B = require('../bridge/bridge-core.js');
const { createStoreController } = require('../addon/store.js');

function storage(initial) {
  const data = { ...initial }, listeners = [];
  return { data, get: async () => ({ ...data }), onChanged: fn => listeners.push(fn), set: async obj => {
    const changes = {}; for (const key in obj) { changes[key] = { newValue: obj[key] }; data[key] = obj[key]; }
    listeners.forEach(fn => fn(changes, 'local'));
  } };
}

test('new catalog passes use the existing bridge/session/pass purchase route', () => {
  for (const sku of ['theme_midnight', 'icons_mono', 'clock_orbit', 'bundle_focus']) {
    assert.equal(C.CATALOG.find(item => item.sku === sku)?.method, 'pass');
    assert.equal(P.methodFor(sku), 'pass');
    assert.deepEqual(B.parseHash('#action=buy&sku=' + sku), { action: 'buy', sku });
    assert.equal(S.validateMessage({ v: 1, type: 'purchase', sku, method: 'pass', tx_signature: '5'.repeat(88), status: 'confirmed' }).ok, true);
    assert.equal(S.validateMessage({ v: 1, type: 'purchase', sku, method: 'usdc', tx_signature: '5'.repeat(88), status: 'confirmed' }).ok, false);
  }
});

test('verified Focus Bundle ownership grants included slots, never unrelated products', async () => {
  const st = storage({ [C.STORAGE_OWNED]: { skus: ['bundle_focus'] } });
  const c = createStoreController({ config: C, storage: st, openBridge() {} });
  await c.ready;
  assert.equal(await c.apply('theme_aurora'), true);
  assert.equal(await c.apply('icons_glass'), true);
  assert.equal(await c.apply('clock_orbit'), true);
  assert.equal(await c.apply('theme_midnight'), false);
  assert.deepEqual(c.state().effective, { theme: 'theme_aurora', icons: 'icons_glass', clock: 'clock_orbit', supporter: false });
  await st.set({ [C.STORAGE_OWNED]: [] });
  assert.equal(c.state().effective.clock, null);
});

test('apply rejects cross-slot SKUs and unknown slots without writing preferences', async () => {
  const st = storage({ [C.STORAGE_OWNED]: ['theme_aurora'] });
  const c = createStoreController({ config: C, storage: st, openBridge() {} });
  await c.ready;
  assert.equal(await c.apply('theme_aurora', 'icons'), false);
  assert.equal(await c.apply(null, '__proto__'), false);
  assert.equal(st.data[C.STORAGE_APPLIED], undefined);
});

test('store subscriptions receive ownership changes and unsubscribe cleanly', async () => {
  const st = storage({});
  const c = createStoreController({ config: C, storage: st, openBridge() {} });
  await c.ready;
  const seen = []; const off = c.subscribe(s => seen.push(s.effective.clock));
  await st.set({ [C.STORAGE_OWNED]: ['clock_orbit'], [C.STORAGE_APPLIED]: { clock: 'clock_orbit' } });
  assert.deepEqual(seen, ['clock_orbit']);
  off(); await st.set({ [C.STORAGE_OWNED]: [] });
  assert.deepEqual(seen, ['clock_orbit']);
});
