const test = require('node:test');
const assert = require('node:assert');
const C = require('../addon/config.js');
const { createStoreController } = require('../addon/store.js');

function fakeStorage(init) {
  const data = Object.assign({}, init); const listeners = [];
  return {
    data, listeners,
    get: (keys) => Promise.resolve(Object.fromEntries([].concat(keys).map(k => [k, data[k]]))),
    set: (obj) => { const changes = {}; for (const k in obj) { changes[k] = { oldValue: data[k], newValue: obj[k] }; data[k] = obj[k]; }
      listeners.forEach(fn => fn(changes, 'local')); return Promise.resolve(); },
    onChanged: (fn) => listeners.push(fn)
  };
}

test('locked items open bridge with right action; owned do not', async () => {
  const calls = [];
  const st = fakeStorage({ [C.STORAGE_OWNED]: ['theme_aurora'] });
  const c = createStoreController({ config: C, storage: st, openBridge: (a, s) => calls.push([a, s]) });
  await c.ready;
  c.buy('supporter'); c.buy('theme_dune'); c.buy('theme_aurora');
  assert.deepStrictEqual(calls, [['pay', 'supporter'], ['buy', 'theme_dune']]);
});

test('apply is gated by ownership and persisted', async () => {
  const st = fakeStorage({ [C.STORAGE_OWNED]: ['theme_aurora'] });
  const c = createStoreController({ config: C, storage: st, openBridge() {} });
  await c.ready;
  assert.strictEqual(await c.apply('theme_dune'), false);
  assert.strictEqual(await c.apply('theme_aurora'), true);
  assert.deepStrictEqual(st.data[C.STORAGE_APPLIED], { theme: 'theme_aurora', icons: null, clock: null });
  assert.strictEqual(await c.apply(null, 'theme'), true);
  assert.deepStrictEqual(st.data[C.STORAGE_APPLIED], { theme: null, icons: null, clock: null });
});

test('unlock reacts to storage change without reload', async () => {
  const st = fakeStorage({});
  const seen = [];
  const c = createStoreController({ config: C, storage: st, openBridge() {}, onChange: (s) => seen.push(s.owned.slice()) });
  await c.ready;
  assert.strictEqual(c.state().items.find(i => i.sku === 'icons_glass').owned, false);
  await st.set({ [C.STORAGE_OWNED]: { skus: ['icons_glass'] } });
  assert.strictEqual(c.state().items.find(i => i.sku === 'icons_glass').owned, true);
  assert.deepStrictEqual(seen[seen.length - 1], ['icons_glass']);
});

test('applied theme dropped when no longer owned', async () => {
  const st = fakeStorage({ [C.STORAGE_OWNED]: ['theme_dune'], [C.STORAGE_APPLIED]: { theme: 'theme_dune', icons: 'icons_glass' } });
  const c = createStoreController({ config: C, storage: st, openBridge() {} });
  await c.ready;
  assert.deepStrictEqual(c.state().effective, { theme: 'theme_dune', icons: null, clock: null, supporter: false });
});
