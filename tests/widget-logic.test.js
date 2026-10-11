const test = require('node:test');
const assert = require('node:assert');
const L = require('../addon/solana-logic.js');
const C = require('../addon/config.js');

test('config matches contract constants', () => {
  assert.strictEqual(C.NETWORK, 'devnet');
  assert.strictEqual(C.RPC_URL, 'https://api.devnet.solana.com');
  assert.strictEqual(C.USDC_MINT, '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  assert.deepStrictEqual(C.CATALOG.map(i => [i.sku, i.price, i.method]), [
    ['supporter', 4.99, 'usdc'], ['theme_aurora', 1.99, 'pass'], ['theme_dune', 1.99, 'pass'], ['icons_glass', 2.99, 'pass']]);
  assert.strictEqual(C.bridgeUrl('buy', 'theme_dune'), 'https://heartui.ipfps.org/bridge/#action=buy&sku=theme_dune');
});

test('lamports -> SOL formatting', () => {
  assert.strictEqual(L.lamportsToSol(1500000000), 1.5);
  assert.strictEqual(L.formatSol(1.5), '1.50');
  assert.strictEqual(L.formatSol(0.000123), '0.0001');
  assert.strictEqual(L.formatSol(12345.678), '12.3K');
  assert.strictEqual(L.formatSol(0), '0');
  assert.strictEqual(L.formatUsd(142.3456), '$142.35');
  assert.strictEqual(L.formatUsd(0.5), '$0.5000');
  assert.strictEqual(L.shortAddress('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'), '9xQe…VFin');
  assert.strictEqual(L.formatPct(-2.345), '−2.3%');
  assert.strictEqual(L.formatPct(1), '+1.0%');
});

test('RPC parsing', () => {
  assert.strictEqual(L.parseBalance({ result: { context: {}, value: 2000000000 } }), 2);
  assert.throws(() => L.parseBalance({ error: { message: 'bad' } }), /bad/);
  const tok = { result: { value: [
    { account: { data: { parsed: { info: { tokenAmount: { uiAmount: 3.5, amount: '3500000', decimals: 6 } } } } } },
    { account: { data: { parsed: { info: { tokenAmount: { uiAmount: null, amount: '500000', decimals: 6 } } } } } }] } };
  assert.strictEqual(L.parseTokenBalance(tok), 4);
  assert.strictEqual(L.parseTokenBalance({ result: { value: [] } }), 0);
  const sigs = L.parseSignatures({ result: [
    { signature: 'abcdefghijklmnop', blockTime: 1700000000, err: null },
    { signature: 'zzzz1111yyyy2222', blockTime: null, err: { x: 1 } }] }, 5);
  assert.strictEqual(sigs.length, 2);
  assert.strictEqual(sigs[0].ok, true);
  assert.strictEqual(sigs[1].ok, false);
  assert.strictEqual(sigs[0].short, 'abcd…mnop');
  assert.strictEqual(L.relTime(1700000000, 1700000000 * 1000 + 3600 * 1000), '1h');
  assert.strictEqual(L.relTime(null, 0), '—');
});

test('price parsing + cache', () => {
  const p = L.parsePrice({ solana: { usd: 150.1, usd_24h_change: -1.2 } });
  assert.deepStrictEqual(p, { usd: 150.1, change24h: -1.2 });
  assert.throws(() => L.parsePrice({}), /price/);
  assert.strictEqual(L.cacheFresh({ at: 1000 }, 60000, 50000), true);
  assert.strictEqual(L.cacheFresh({ at: 1000 }, 60000, 62000), false);
  assert.strictEqual(L.cacheFresh(null, 60000, 0), false);
});

test('catalog gating', () => {
  const items = L.storeItems(C.CATALOG, ['theme_dune', 'bogus']);
  assert.deepStrictEqual(items.map(i => [i.sku, i.owned]), [['supporter', false], ['theme_aurora', false], ['theme_dune', true], ['icons_glass', false]]);
  assert.strictEqual(L.bridgeActionFor(C.CATALOG[0]), 'pay');
  assert.strictEqual(L.bridgeActionFor(C.CATALOG[1]), 'buy');
  assert.deepStrictEqual(L.normalizeOwned({ skus: ['icons_glass'] }), ['icons_glass']);
  assert.deepStrictEqual(L.normalizeOwned(['a', 1, null, 'a']), ['a']);
  assert.deepStrictEqual(L.normalizeOwned(undefined), []);
  assert.strictEqual(L.canApply('theme_aurora', ['theme_aurora']), true);
  assert.strictEqual(L.canApply('theme_aurora', []), false);
});

test('size family + scale (aw rules)', () => {
  assert.strictEqual(L.family(1, 1), 'small');
  assert.strictEqual(L.family(2, 2), 'small');
  assert.strictEqual(L.family(3, 2), 'medium');
  assert.strictEqual(L.family(4, 4), 'large');
  assert.strictEqual(L.heroPx(1, 1), 32);
  assert.strictEqual(L.heroPx(6, 6), 130);
  assert.strictEqual(L.heroPx(0, 0), 28);
});
