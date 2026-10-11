/* Theme store: controller (pure, testable) + widget surface + theme application.
   Ownership lives in chrome.storage.local[hearth.solana.owned] (written by A1's session
   from IPFPS /owned or on-chain PDA check). This file only reads it and reacts to changes. */
(function (root) {
  'use strict';
  var L = (root && root.HearthSolanaLogic) || (typeof require === 'function' ? require('./solana-logic.js') : null);

  function createStoreController(opts) {
    var C = opts.config, storage = opts.storage;
    var owned = [], applied = { theme: null, icons: null };
    function kindOf(sku) { var i = C.CATALOG.find(function (x) { return x.sku === sku; }); return i ? i.kind : null; }
    function effective() {
      return {
        theme: applied.theme && L.canApply(applied.theme, owned) ? applied.theme : null,
        icons: applied.icons && L.canApply(applied.icons, owned) ? applied.icons : null,
        supporter: owned.indexOf('supporter') !== -1
      };
    }
    function state() { return { owned: owned, applied: applied, items: L.storeItems(C.CATALOG, owned), effective: effective() }; }
    function emit() { if (opts.onChange) opts.onChange(state()); }
    function ingest(obj) {
      if (C.STORAGE_OWNED in obj) owned = L.normalizeOwned(obj[C.STORAGE_OWNED]);
      if (C.STORAGE_APPLIED in obj) {
        var a = obj[C.STORAGE_APPLIED] || {};
        applied = { theme: a.theme || null, icons: a.icons || null };
      }
    }
    var ready = storage.get([C.STORAGE_OWNED, C.STORAGE_APPLIED]).then(function (r) { ingest(r || {}); emit(); });
    storage.onChanged(function (changes, area) {
      if (area && area !== 'local') return;
      var o = {}, hit = false;
      [C.STORAGE_OWNED, C.STORAGE_APPLIED].forEach(function (k) { if (changes[k]) { o[k] = changes[k].newValue; hit = true; } });
      if (hit) { ingest(o); emit(); }
    });
    return {
      ready: ready, state: state,
      buy: function (sku) {
        var item = C.CATALOG.find(function (x) { return x.sku === sku; });
        if (!item || L.canApply(sku, owned)) return false;
        opts.openBridge(L.bridgeActionFor(item), sku); return true;
      },
      /* apply(sku) or apply(null, 'theme'|'icons') to reset */
      apply: function (sku, slot) {
        slot = slot || (kindOf(sku) === 'icons' ? 'icons' : kindOf(sku) === 'theme' ? 'theme' : null);
        if (!slot) return false;
        if (sku && !L.canApply(sku, owned)) return false;
        var next = { theme: applied.theme, icons: applied.icons }; next[slot] = sku || null;
        applied = next;
        var w = {}; w[C.STORAGE_APPLIED] = next; storage.set(w);
        emit(); return true;
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
      get: function (keys) { return hasChrome ? new Promise(function (res) { root.chrome.storage.local.get(keys, res); }) : Promise.resolve(mem); },
      set: function (obj) {
        if (hasChrome) return new Promise(function (res) { root.chrome.storage.local.set(obj, res); });
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
    ['theme_aurora', 'theme_dune'].forEach(function (t) { de.classList.toggle('hs-' + t.replace('_', '-'), e.theme === t); });
    de.classList.toggle('hs-icons-glass', e.icons === 'icons_glass');
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
    function render() {
      var s = controller.state(), fam = L.family(cols, rows), esc = L.escapeHtml;
      var ownedCount = s.items.filter(function (i) { return i.owned; }).length;
      el.dataset.family = fam;
      if (fam === 'small') {
        el.innerHTML = '<div class="hs-center"><div class="hs-hero" style="font-size:' + L.heroPx(cols, rows) + 'px">' + ownedCount + '/' + s.items.length +
          '</div><div class="hs-label">Store · owned</div>' + (s.effective.supporter ? '<div class="hs-badge">★ Supporter</div>' : '') + '</div>';
        el.querySelector('.hs-center').addEventListener('click', function () { openBridge('signin'); });
        return;
      }
      var rowsHtml = s.items.map(function (i) {
        var active = s.effective.theme === i.sku || s.effective.icons === i.sku;
        var btn;
        if (!i.owned) btn = '<button type="button" class="hs-btn hs-buy" data-sku="' + esc(i.sku) + '">' + (i.method === 'usdc' ? 'Support' : 'Buy') + ' $' + i.price.toFixed(2) + '</button>';
        else if (i.kind === 'badge') btn = '<span class="hs-pill">★ Owned</span>';
        else btn = '<button type="button" class="hs-btn ' + (active ? 'hs-on' : '') + '" data-apply="' + esc(i.sku) + '" data-kind="' + i.kind + '" aria-pressed="' + active + '">' + (active ? 'Applied' : 'Apply') + '</button>';
        return '<li class="hs-row ' + (i.owned ? 'is-owned' : 'is-locked') + '"><span class="hs-swatch hs-sw-' + esc(i.sku) + '"></span><span class="hs-row-main"><b>' + esc(i.label) +
          '</b>' + (fam === 'large' ? '<small>' + esc(i.desc) + '</small>' : '') + '</span>' + (i.owned ? '' : '<span class="hs-lock" aria-label="locked">\u{1F512}</span>') + btn + '</li>';
      }).join('');
      el.innerHTML = '<div class="hs-head"><span>Hearth Store</span><span class="hs-acc">' + ownedCount + ' owned</span></div><ul class="hs-list">' + rowsHtml + '</ul>';
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
