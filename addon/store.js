/* Theme store: controller (pure, testable) + widget surface + theme application.
   Ownership lives in chrome.storage.local[hearth.solana.owned] (written by A1's session
   from IPFPS /owned or on-chain PDA check). This file only reads it and reacts to changes. */
(function (root) {
  'use strict';
  var L = (root && root.HearthSolanaLogic) || (typeof require === 'function' ? require('./solana-logic.js') : null);

  function createStoreController(opts) {
    var C = opts.config, storage = opts.storage;
    var owned = [], applied = { theme: null, icons: null, clock: null }, subscribers = new Set(), lastError = null, writeQueue = Promise.resolve(), appliedRevision = 0;
    function kindOf(sku) { var i = C.CATALOG.find(function (x) { return x.sku === sku; }); return i ? i.kind : null; }
    function expanded() {
      var all = owned.slice();
      C.CATALOG.forEach(function (item) {
        if (owned.indexOf(item.sku) !== -1 && Array.isArray(item.includes)) item.includes.forEach(function (sku) {
          if (C.CATALOG.some(function (x) { return x.sku === sku; }) && all.indexOf(sku) === -1) all.push(sku);
        });
      });
      return all;
    }
    function effective() {
      var all = expanded();
      return {
        theme: kindOf(applied.theme) === 'theme' && L.canApply(applied.theme, all) ? applied.theme : null,
        icons: kindOf(applied.icons) === 'icons' && L.canApply(applied.icons, all) ? applied.icons : null,
        clock: kindOf(applied.clock) === 'clock' && L.canApply(applied.clock, all) ? applied.clock : null,
        supporter: owned.indexOf('supporter') !== -1
      };
    }
    function state() { return { owned: owned.slice(), applied: Object.assign({}, applied), items: L.storeItems(C.CATALOG, expanded()), effective: effective() }; }
    function emit() { var s = state(); if (opts.onChange) opts.onChange(s); subscribers.forEach(function (fn) { fn(s); }); }
    function ingest(obj) {
      if (C.STORAGE_OWNED in obj) owned = L.normalizeOwned(obj[C.STORAGE_OWNED]);
      if (C.STORAGE_APPLIED in obj) {
        appliedRevision++;
        var a = obj[C.STORAGE_APPLIED] || {};
        applied = { theme: typeof a.theme === 'string' ? a.theme : null, icons: typeof a.icons === 'string' ? a.icons : null, clock: typeof a.clock === 'string' ? a.clock : null };
      }
    }
    var ready = storage.get([C.STORAGE_OWNED, C.STORAGE_APPLIED]).then(function (r) { ingest(r || {}); emit(); }).catch(function (error) { lastError = error; emit(); });
    storage.onChanged(function (changes, area) {
      if (area && area !== 'local') return;
      var o = {}, hit = false;
      [C.STORAGE_OWNED, C.STORAGE_APPLIED].forEach(function (k) { if (changes[k]) { o[k] = changes[k].newValue; hit = true; } });
      if (hit) { ingest(o); emit(); }
    });
    return {
      ready: ready, state: state, lastError: function () { return lastError; },
      subscribe: function (fn) { subscribers.add(fn); return function () { subscribers.delete(fn); }; },
      buy: function (sku) {
        var item = C.CATALOG.find(function (x) { return x.sku === sku; });
        if (!item || L.canApply(sku, expanded())) return false;
        opts.openBridge(L.bridgeActionFor(item), sku); return true;
      },
      /* apply(sku) or apply(null, 'theme'|'icons') to reset */
      apply: function (sku, slot) {
        slot = slot || kindOf(sku);
        var operation = writeQueue.then(async function () {
          await ready;
          if (['theme', 'icons', 'clock'].indexOf(slot) === -1) return false;
          if (sku && (kindOf(sku) !== slot || !L.canApply(sku, expanded()))) return false;
          var next = Object.assign({}, applied); next[slot] = sku || null;
          var revision = appliedRevision, w = {}; w[C.STORAGE_APPLIED] = next;
          try {
            await storage.set(w);
            // A newer storage event already supplies the current durable preference.
            if (revision === appliedRevision) applied = next;
            lastError = null; emit(); return true;
          } catch (error) { lastError = error; emit(); return false; }
        });
        writeQueue = operation.then(function () {}, function () {});
        return operation;
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createStoreController: createStoreController };
  if (!root || typeof document === 'undefined') return;

  /* ---------- browser side ---------- */
  var C = root.HearthSolanaConfig;
  function chromeStorage() {
    var hasChrome = root.chrome && root.chrome.storage && root.chrome.storage.local;
    var mem = {}, ls = [];
    return {
      get: function (keys) { return hasChrome ? new Promise(function (res, reject) { root.chrome.storage.local.get(keys, function (value) { var error = root.chrome.runtime && root.chrome.runtime.lastError; if (error) reject(new Error(error.message)); else res(value); }); }) : Promise.resolve(mem); },
      set: function (obj) {
        if (hasChrome) return new Promise(function (res, reject) { root.chrome.storage.local.set(obj, function () { var error = root.chrome.runtime && root.chrome.runtime.lastError; if (error) reject(new Error(error.message)); else res(); }); });
        var ch = {}; for (var k in obj) { ch[k] = { newValue: obj[k] }; mem[k] = obj[k]; } ls.forEach(function (f) { f(ch, 'local'); }); return Promise.resolve();
      },
      onChanged: function (fn) { if (hasChrome) root.chrome.storage.onChanged.addListener(fn); else ls.push(fn); }
    };
  }
  function openBridge(action, sku) {
    if (root.HearthSolana && typeof root.HearthSolana.openBridge === 'function') return root.HearthSolana.openBridge(action, sku);
    root.open(C.bridgeUrl(action, sku), '_blank', 'noopener');
  }

  var surfaces = new Set();
  function applyToDocument(s) {
    var de = document.documentElement, e = s.effective;
    ['theme_aurora', 'theme_dune', 'theme_midnight'].forEach(function (t) { de.classList.toggle('hs-' + t.replace('_', '-'), e.theme === t); });
    ['glass', 'mono'].forEach(function (pack) { de.classList.toggle('hs-icons-' + pack, e.icons === 'icons_' + pack); });
    de.classList.toggle('hs-clock-orbit', e.clock === 'clock_orbit');
    de.classList.toggle('hs-supporter', e.supporter);
    var layer = document.getElementById('hs-theme-layer');
    if (e.theme && !layer && document.body) {
      layer = document.createElement('div'); layer.id = 'hs-theme-layer'; layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    if (layer) layer.hidden = !e.theme;
    surfaces.forEach(function (fn) { fn(s); });
  }
  var controller = createStoreController({ config: C, storage: chromeStorage(), openBridge: openBridge, onChange: applyToDocument });
  root.HearthStore = controller;

  function createStoreWidget() {
    var el = document.createElement('div');
    el.className = 'hs-widget hs-store';
    var cols = 2, rows = 2;
    function wireGallery() {
      var b = el.querySelector('[data-store-gallery]');
      if (b) b.addEventListener('click', function () { if (root.HearthStoreGallery) root.HearthStoreGallery.open(b); });
    }
    function render() {
      var s = controller.state(), fam = L.family(cols, rows), esc = L.escapeHtml;
      var counts = root.HearthStoreCatalog ? root.HearthStoreCatalog.ownedCount(s.owned) : { owned: s.items.filter(function (i) { return i.owned; }).length, total: s.items.length };
      var ownedCount = counts.owned;
      el.dataset.family = fam;
      if (fam === 'small') {
        el.innerHTML = '<div class="hs-center"><div class="hs-hero" style="font-size:' + L.heroPx(cols, rows) + 'px">' + ownedCount + '/' + counts.total +
          '</div><div class="hs-label">Hearth Store</div><button type="button" class="hs-btn" data-store-gallery>See all →</button>' + (s.effective.supporter ? '<div class="hs-badge">★ Supporter</div>' : '') + '</div>';
        wireGallery();
        return;
      }
      var rowsHtml = s.items.filter(function(i) { return ['theme_aurora', 'theme_dune', 'icons_glass'].indexOf(i.sku) !== -1; }).map(function (i) {
        var active = s.effective.theme === i.sku || s.effective.icons === i.sku || s.effective.clock === i.sku;
        var btn;
        if (!i.owned) btn = '<button type="button" class="hs-btn hs-buy" data-sku="' + esc(i.sku) + '">' + (i.method === 'usdc' ? 'Support' : 'Buy') + ' $' + i.price.toFixed(2) + '</button>';
        else if (i.kind === 'badge') btn = '<span class="hs-pill">★ Owned</span>';
        else btn = '<button type="button" class="hs-btn ' + (active ? 'hs-on' : '') + '" data-apply="' + esc(i.sku) + '" data-kind="' + i.kind + '" aria-pressed="' + active + '">' + (active ? 'Applied' : 'Apply') + '</button>';
        return '<li class="hs-row ' + (i.owned ? 'is-owned' : 'is-locked') + '"><span class="hs-swatch hs-sw-' + esc(i.sku) + '"></span><span class="hs-row-main"><b>' + esc(i.label) +
          '</b>' + (fam === 'large' ? '<small>' + esc(i.desc) + '</small>' : '') + '</span>' + (i.owned ? '' : '<span class="hs-lock" aria-label="locked">\u{1F512}</span>') + btn + '</li>';
      }).join('');
      el.innerHTML = '<div class="hs-head"><span title="Demo catalog on Solana devnet">Hearth Store</span><button type="button" class="hs-btn" data-store-gallery>See all →</button></div><ul class="hs-list">' + rowsHtml + '</ul>';
      wireGallery();
      el.querySelectorAll('.hs-buy').forEach(function (b) { b.addEventListener('click', function () { controller.buy(b.dataset.sku); }); });
      el.querySelectorAll('[data-apply]').forEach(function (b) {
        b.addEventListener('click', function () {
          var on = b.getAttribute('aria-pressed') === 'true';
          controller.apply(on ? null : b.dataset.apply, b.dataset.kind);
        });
      });
    }
    surfaces.add(render);
    controller.ready.then(render);
    render();
    return { el: el, update: function (c, r) { cols = c; rows = r; if (typeof applyWidgetSizeState === 'function') applyWidgetSizeState(el, c, r); render(); },
      destroy: function () { surfaces.delete(render); } };
  }
  root.createHearthStoreWidget = createStoreWidget;
  if (typeof WidgetRegistry !== 'undefined') WidgetRegistry.register('hearthStore', createStoreWidget);
})(typeof window !== 'undefined' ? window : null);
