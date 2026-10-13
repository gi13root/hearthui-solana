const test = require('node:test');
const assert = require('node:assert/strict');
let install;
try { install = require('../addon/store-entry.js').installStoreEntry; } catch {}

test('blank desktop menu opens gallery after host menu focus cleanup', () => {
  assert.equal(typeof install, 'function');
  let listener, menu, opened; const queue = [];
  const doc = { activeElement: { id: 'opener' }, addEventListener: (type, fn) => { assert.equal(type, 'contextmenu'); listener = fn; }, removeEventListener() {} };
  install({ document: doc, menu: (...args) => { menu = args; }, open: source => { opened = source; }, schedule: fn => queue.push(fn) });
  const event = { target: { id: 'widgetCanvas' }, clientX: 120, clientY: 80, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  listener(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(menu[2], 'Desktop'); assert.equal(menu[3][0].label, 'Hearth Store');
  menu[3][0].action(); assert.equal(opened, undefined); queue[0]();
  assert.equal(opened, doc.activeElement);
});

test('existing widget and dock context menus remain untouched', () => {
  assert.equal(typeof install, 'function');
  let listener, calls = 0;
  const doc = { addEventListener: (_, fn) => { listener = fn; }, removeEventListener() {} };
  install({ document: doc, menu: () => calls++, open() {}, schedule: fn => fn() });
  for (const fixture of [{ target: { id: 'dock' }, defaultPrevented: false }, { target: { id: 'widgetCanvas' }, defaultPrevented: true }, { target: { id: 'button' }, defaultPrevented: false }]) listener(fixture);
  assert.equal(calls, 0);
});
