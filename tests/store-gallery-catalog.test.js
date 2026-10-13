const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalogPath = path.join(__dirname, '../addon/store-catalog.js');
// Missing exports must fail as missing functionality, rather than a module-load error.
const C = fs.existsSync(catalogPath) ? require(catalogPath) : {};
const item = sku => C.items.find(i => i.sku === sku);

test('Featured exposes six selected products while category filters retain included content', () => {
  assert.equal(typeof C.filterItems, 'function');
  assert.deepEqual(C.filterItems('featured').map(i => i.id), ['theme_aurora', 'icons_glass', 'clock_orbit', 'yosemite_depth', 'bundle_focus', 'supporter']);
  assert.equal(C.tabs.length, 8);
  assert.equal(C.tabs.find(tab => tab.id === 'widgets').label, 'Widgets');
  assert.equal(C.filterItems('themes').filter(i => i.status === 'included').length, 6);
  assert.deepEqual(C.filterItems('missing'), []);
});
test('ownership normalizes supported storage shapes and grants only declared bundle contents', () => {
  assert.equal(typeof C.expandOwned, 'function');
  assert.deepEqual(C.expandOwned(['bundle_focus', 'bundle_focus']), ['bundle_focus', 'theme_aurora', 'icons_glass', 'clock_orbit']);
  assert.deepEqual(C.expandOwned({ skus: ['theme_dune'], items: [{sku: 'icons_mono'}] }), ['theme_dune', 'icons_mono']);
  assert.deepEqual(C.expandOwned([{sku: 'theme_midnight'}]), ['theme_midnight']);
});
test('malformed or explicitly unconfirmed entitlements cannot grant paid content', () => {
  assert.equal(typeof C.expandOwned, 'function');
  for (const value of [null, 'bundle_focus', {skus: 'bundle_focus'}, {items: {}}, [{sku: 'bundle_focus', status:'pending'}], [{sku: 'bundle_focus', owned:false}], [{sku: 'bundle_focus', includes: ['theme_dune'], status:'failed'}], [false, 123, {}, {sku: 5}, 'unknown']]) {
    assert.deepEqual(C.expandOwned(value), []);
  }
});
test('card states require ownership before marking applied and keep free and soon states honest', () => {
  assert.equal(typeof C.cardState, 'function');
  assert.equal(C.cardState(item('theme_aurora'), [], {theme:'theme_aurora'}), 'available');
  assert.equal(C.cardState(item('theme_aurora'), ['bundle_focus'], {theme:'theme_aurora'}), 'applied');
  assert.equal(C.cardState(item('icons_glass'), ['bundle_focus'], {}), 'owned');
  assert.equal(C.cardState(item('supporter'), [], {}), 'soon');
  assert.equal(C.cardState(C.items.find(i => i.id === 'half_dome'), [], {}), 'included');
});
test('owned counter counts unique available products and excludes included and upcoming cards', () => {
  assert.equal(typeof C.ownedCount, 'function');
  assert.deepEqual(C.ownedCount(['bundle_focus', 'theme_aurora', 'supporter']), {owned:2,total:7});
  assert.deepEqual(C.ownedCount(null), {owned:0,total:7});
  assert.deepEqual(C.ownedCount(['date_nothing_stack','date_nothing_stack','date_nothing_day_1']), {owned:1,total:7});
});
test('price formatting displays USDC precision and clearly distinguishes included and upcoming content', () => {
  assert.equal(typeof C.formatPrice, 'function');
  assert.equal(C.formatPrice(item('theme_aurora')), '$1.99 USDC');
  assert.equal(C.formatPrice(item('clock_orbit')), 'Soon');
  assert.equal(C.formatPrice(item('supporter')), 'Soon');
  assert.equal(C.formatPrice(C.items.find(i => i.id === 'astronaut')), 'Free');
});

test('absent new passes stay upcoming until explicitly verified ready', () => {
  assert.equal(C.cardState(item('theme_midnight'), [], {}), 'soon');
  assert.equal(C.cardState(item('bundle_focus'), [], {}), 'soon');
  assert.equal(typeof C.createCatalog, 'function');
  const ready = C.createCatalog(['theme_aurora', 'theme_dune', 'icons_glass', 'theme_midnight', 'icons_mono', 'clock_orbit', 'bundle_focus']);
  assert.equal(ready.cardState(ready.items.find(i => i.sku === 'theme_midnight'), [], {}), 'available');
  assert.deepEqual(ready.ownedCount(['bundle_focus']), {owned:4,total:11});
  assert.equal(ready.formatPrice(ready.items.find(i => i.sku === 'clock_orbit')), '$0.99 USDC');
  assert.equal(ready.items.find(i => i.sku === 'supporter').status, 'soon');
});
