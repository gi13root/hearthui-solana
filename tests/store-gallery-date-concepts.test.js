'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../addon/store-date-concepts.js');
const C = fs.existsSync(file) ? require(file) : {};

test('style filtering exposes each complete set of 24 static designs', () => {
  assert.equal(typeof C.filterItems, 'function');
  for (const style of ['nothing','liquid','terminal','eink']) {
    const items = C.filterItems(style, 'all');
    assert.equal(items.length, 24);
    assert.ok(items.every(i => i.style === style));
    assert.equal(new Set(items.map(i => i.id)).size, 24);
  }
  assert.equal(C.filterItems('all','all').length, 96);
});
test('period filtering crosses styles while intersection isolates eight designs', () => {
  assert.equal(typeof C.filterItems, 'function');
  for (const period of ['day','week','month']) {
    const items = C.filterItems('all', period);
    assert.equal(items.length, 32);
    assert.ok(items.every(i => i.period === period));
    for (const style of ['nothing','liquid','terminal','eink']) {
      const intersection = C.filterItems(style, period);
      assert.equal(intersection.length, 8);
      assert.ok(intersection.every(i => i.style === style && i.period === period));
    }
  }
});
test('invalid filters cannot silently display or sell a fallback set', () => {
  assert.equal(typeof C.filterItems, 'function');
  for (const [style,period] of [['unknown','all'],['all','unknown'],[null,'day'],['nothing',{}],['__proto__','all'],[undefined,undefined]]) {
    assert.deepEqual(C.filterItems(style,period), []);
  }
});
test('consumer mutation cannot change the catalog or later filtered results', () => {
  assert.equal(typeof C.filterItems, 'function');
  const item = C.filterItems('terminal','month')[0];
  const original = item.name;
  assert.throws(() => { item.name = 'Changed'; }, TypeError);
  assert.throws(() => { C.items.pop(); }, TypeError);
  const filtered = C.filterItems('terminal','month');
  filtered.pop();
  assert.equal(C.filterItems('terminal','month').length, 8);
  assert.equal(C.filterItems('terminal','month')[0].name, original);
});
test('browser exports the same filtering behavior without widget registration', () => {
  assert.equal(typeof C.filterItems, 'function');
  const context = vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(file,'utf8'), context);
  assert.equal(context.window.HearthDateConcepts.filterItems('eink','week').length, 8);
  assert.equal(context.window.WidgetRegistry, undefined);
});

test('four style stacks own all 96 samples without individual payment identities', () => {
  assert.equal(C.items.length, 4);
  assert.equal(C.stack, undefined);
  assert.deepEqual(C.items.map(item => item.sku), ['date_nothing_stack','date_liquid_stack','date_terminal_stack','date_eink_stack']);
  for (const item of C.items) {
    assert.equal(item.designCount, 24);
    assert.equal(C.filterItems(item.style,'all').length, 24);
    assert.equal(C.filterItems(item.style,'day').length, 8);
    assert.equal(item.id,item.sku);
    assert.throws(() => { item.designCount = 1; }, TypeError);
  }
  assert.equal(C.designs.length, 96);
  for (const design of C.designs) {
    assert.equal('sku' in design, false);
    assert.equal('price' in design, false);
    assert.equal('status' in design, false);
  }
  assert.throws(() => { C.designs.pop(); }, TypeError);
});
