'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../addon/store-widget-catalog.js');
const C = fs.existsSync(file) ? require(file) : {};
const allTypes = ['clock','countdown','weather','search','calendar','pin','pomodoro','timer','tasksLite','tasks','habits','media','appgrid','youtube','photoframe','solanaWallet','solPrice','hearthStore','focusBoard'];

test('widget catalog includes every declared core and registered addon type, without paid grants', () => {
  assert.equal(typeof C.buildItems, 'function');
  const items = C.buildItems([], allTypes);
  assert.equal(items.length, 19);
  assert.deepEqual(items.map(i => i.widgetType).sort(), [...allTypes].sort());
  for (const item of items) {
    assert.equal(item.status, 'included');
    assert.equal(item.price, 0);
    assert.equal(item.sku, undefined);
    assert.equal(item.author, 'HearthUI');
    assert.equal(item.preview, 'addon/store-previews/widget_' + item.widgetType + '.webp');
  }
});
test('metadata normalization discards unknown/unavailable types and safely falls back from invalid names', () => {
  assert.equal(typeof C.buildItems, 'function');
  const items = C.buildItems([null, {type:'clock',label:42}, {type:'clock',label:'Duplicate'}, {type:'media',label:' Now Playing ',desc:' Playback controls ',cat:'utilities'}, {type:'phantom',label:'Unknown'}, {type:'tasks',label:'Unavailable'}], ['clock','media','phantom']);
  assert.deepEqual(items.map(i => [i.widgetType,i.name]), [['clock','Clock'],['media','Now Playing']]);
  assert.equal(items[1].description, 'Playback controls');
  assert.deepEqual(C.buildItems([], null), []);
  assert.deepEqual(C.buildItems({}, ['timer','timer',null]), [{id:'widget_timer',name:'Timer',description:'Countdown with a dial',author:'HearthUI',kind:'widget',tab:'widgets',status:'included',price:0,widgetType:'timer',category:'time',preview:'addon/store-previews/widget_timer.webp',thumb:'addon/store-previews/widget_timer-thumb.webp'}]);
});
test('quick clock and timer groups overlap standard category groups', () => {
  assert.equal(typeof C.filterItems, 'function');
  const items = C.buildItems([], allTypes);
  assert.deepEqual(C.categories.map(c => c.id), ['all','clocks','timer','productivity','time','utilities','date']);
  assert.deepEqual(C.filterItems('clocks', items).map(i => i.widgetType), ['clock']);
  assert.deepEqual(C.filterItems('timer', items).map(i => i.widgetType), ['countdown','pomodoro','timer']);
  assert.ok(C.filterItems('productivity', items).some(i => i.widgetType === 'pomodoro'));
  assert.ok(C.filterItems('time', items).some(i => i.widgetType === 'countdown'));
  assert.ok(C.filterItems('utilities', items).some(i => i.widgetType === 'media'));
  assert.equal(C.filterItems('all', items).length, 19);
  assert.deepEqual(C.filterItems('unknown', items), []);
});
test('browser reads lexical catalog and admits only registered or declared sources', () => {
  assert.equal(typeof C.getItems, 'function');
  const context = vm.createContext({window:{WidgetRegistry:{has:t => t === 'solanaWallet',sourceOf:t => t === 'clock' ? 'widgets/clock.js' : null}}});
  vm.runInContext("const WIDGET_CATALOG = [{type:'clock',label:'Desk Clock',desc:'Live time',cat:'time'}, {type:'unknown',label:'Unknown'}];", context);
  vm.runInContext(fs.readFileSync(file,'utf8'), context);
  assert.deepEqual(Array.from(context.window.HearthStoreWidgets.getItems(), i => [i.widgetType,i.name]), [['clock','Desk Clock'],['solanaWallet','Solana Wallet']]);
  assert.equal(context.window.HearthStoreWidgets.filterItems('clocks').length, 1);
  assert.deepEqual(C.getItems(), []);
});
