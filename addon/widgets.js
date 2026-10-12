/* Solana widgets for HearthUI: wallet, SOL price, focus leaderboard + pomodoro focus hook.
   Load after HearthUI's widget-registry.js / newtab-core.js / newtab-widgets.js and after
   addon/config.js, addon/solana-logic.js, addon/solana-session.js. Settings: none (right-click shell menu only). */
(function (root) {
  'use strict';
  var C = root.HearthSolanaConfig, L = root.HearthSolanaLogic, esc = L.escapeHtml;

  /* ---------- session ---------- */
  function readSession() {
    var HS = root.HearthSolana;
    if (HS && typeof HS.getSession === 'function') return Promise.resolve(HS.getSession()).catch(function () { return null; });
    if (root.chrome && root.chrome.storage && root.chrome.storage.local) {
      return new Promise(function (res) { root.chrome.storage.local.get(C.STORAGE_SESSION, function (r) { res((r && r[C.STORAGE_SESSION]) || null); }); });
    }
    return Promise.resolve(null);
  }
  var sessionListeners = new Set();
  if (root.chrome && root.chrome.storage && root.chrome.storage.onChanged) {
    root.chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === 'local' && ch[C.STORAGE_SESSION]) sessionListeners.forEach(function (fn) { fn(); });
    });
  }
  function openBridge(action, sku) {
    if (root.HearthSolana && typeof root.HearthSolana.openBridge === 'function') return root.HearthSolana.openBridge(action, sku);
    root.open(C.bridgeUrl(action, sku), '_blank', 'noopener');
  }
  function ipfpsBase() { return C.HEARTH_IPFPS_BASE === 'mock' ? '' : C.HEARTH_IPFPS_BASE; }
  function ipfpsFetch(path, init) {
    var HS = root.HearthSolana;
    if (HS && typeof HS.ipfpsFetch === 'function') return HS.ipfpsFetch(path, init); // A1 may route to mock
    return fetch(ipfpsBase() + path, init);
  }

  /* ---------- RPC ---------- */
  var rpcId = 0;
  function rpc(method, params) {
    return fetch(C.RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: method, params: params }) })
      .then(function (r) { if (!r.ok) throw new Error('RPC HTTP ' + r.status); return r.json(); });
  }
  var walletCache = {};
  function loadWallet(address, withTx) {
    var c = walletCache[address];
    if (c && L.cacheFresh(c, C.WALLET_TTL_MS, Date.now()) && (!withTx || c.txs)) return Promise.resolve(c);
    return Promise.all([
      rpc('getBalance', [address, { commitment: 'confirmed' }]).then(L.parseBalance),
      rpc('getTokenAccountsByOwner', [address, { mint: C.USDC_MINT }, { encoding: 'jsonParsed' }]).then(L.parseTokenBalance),
      withTx ? rpc('getSignaturesForAddress', [address, { limit: 5 }]).then(function (j) { return L.parseSignatures(j, 5); }) : null
    ]).then(function (r) {
      var e = { at: Date.now(), sol: r[0], usdc: r[1], txs: r[2] };
      walletCache[address] = e; return e;
    });
  }

  /* ---------- shared shell ---------- */
  function baseWidget(kind, renderFn, opts) {
    var el = document.createElement('div');
    el.className = 'hs-widget hs-' + kind;
    var ctx = { el: el, cols: 2, rows: 2, state: 'loading', data: null, error: null, disposed: false };
    ctx.paint = function () { if (!ctx.disposed) { el.dataset.family = L.family(ctx.cols, ctx.rows); el.dataset.state = ctx.state; renderFn(ctx); } };
    ctx.refresh = function () { if (opts.load) opts.load(ctx); };
    var timer = opts.every ? setInterval(ctx.refresh, opts.every) : null;
    if (opts.onSession) { var fn = function () { walletCache = {}; ctx.refresh(); }; sessionListeners.add(fn); ctx.unsub = fn; }
    ctx.paint(); ctx.refresh();
    return { el: el,
      update: function (c, r) { ctx.cols = c; ctx.rows = r; if (typeof applyWidgetSizeState === 'function') applyWidgetSizeState(el, c, r); ctx.paint(); },
      destroy: function () { ctx.disposed = true; if (timer) clearInterval(timer); if (ctx.unsub) sessionListeners.delete(ctx.unsub); } };
  }
  function stateView(ctx, label) {
    if (ctx.state === 'loading') return '<div class="hs-center" aria-busy="true"><div class="hs-skel" style="width:60%;height:' + Math.round(L.heroPx(ctx.cols, ctx.rows) * 0.8) + 'px"></div><div class="hs-label">' + label + '</div></div>';
    if (ctx.state === 'error') return '<div class="hs-center"><div class="hs-label hs-err">' + esc(ctx.error || 'Unavailable') + '</div><button type="button" class="hs-btn hs-retry">Retry</button></div>';
    return null;
  }
  function wireRetry(ctx) { var b = ctx.el.querySelector('.hs-retry'); if (b) b.addEventListener('click', function () { ctx.state = 'loading'; ctx.paint(); ctx.refresh(); }); }

  /* ---------- wallet ---------- */
  function createWalletWidget() {
    return baseWidget('wallet', function (ctx) {
      var el = ctx.el, fam = L.family(ctx.cols, ctx.rows), hero = L.heroPx(ctx.cols, ctx.rows);
      var sv = stateView(ctx, 'Wallet');
      if (sv) { el.innerHTML = sv; wireRetry(ctx); return; }
      if (ctx.state === 'empty') {
        el.innerHTML = '<div class="hs-center"><div class="hs-glyph" style="font-size:' + Math.round(hero * 0.7) + 'px">◎</div>' +
          (fam === 'small' ? '' : '<div class="hs-label">Solana wallet · devnet</div>') +
          '<button type="button" class="hs-btn hs-primary hs-connect">Connect wallet</button></div>';
        el.querySelector('.hs-connect').addEventListener('click', function () { openBridge('signin'); });
        return;
      }
      var d = ctx.data, html = '<div class="hs-center hs-wallet-main"><div class="hs-hero" style="font-size:' + L.fitHero(hero, el.clientWidth, L.formatSol(d.sol)) + 'px">' + L.formatSol(d.sol) +
        '</div><div class="hs-label">SOL' + (fam === 'small' ? '' : ' · devnet') + '</div>';
      if (fam !== 'small') html += '<div class="hs-sub"><span>' + L.formatSol(d.usdc) + ' USDC</span><span class="hs-addr" title="' + esc(d.address) + '">' + esc(L.shortAddress(d.address)) + '</span></div>';
      html += '</div>';
      if (fam === 'large') {
        var now = Date.now();
        html += '<ul class="hs-list hs-tx">' + ((d.txs && d.txs.length) ? d.txs.map(function (t) {
          return '<li class="hs-row"><span class="hs-dot ' + (t.ok ? 'ok' : 'bad') + '"></span><a class="hs-mono" target="_blank" rel="noopener" href="https://explorer.solana.com/tx/' + encodeURIComponent(t.signature) + '?cluster=devnet">' + esc(t.short) + '</a><span class="hs-time">' + L.relTime(t.blockTime, now) + '</span></li>';
        }).join('') : '<li class="hs-row hs-label">No transactions yet</li>') + '</ul>';
      }
      el.innerHTML = html;
    }, { every: C.WALLET_TTL_MS, onSession: true, load: function (ctx) {
      readSession().then(function (s) {
        if (!s || !s.address) { ctx.state = 'empty'; ctx.paint(); return null; }
        return loadWallet(s.address, L.family(ctx.cols, ctx.rows) === 'large').then(function (w) {
          ctx.data = { address: s.address, sol: w.sol, usdc: w.usdc, txs: w.txs }; ctx.state = 'ready'; ctx.paint();
        });
      }).catch(function (e) { if (ctx.data) return; ctx.state = 'error'; ctx.error = 'Devnet RPC unreachable'; ctx.paint(); console.warn('[hearth-wallet]', e); });
    } });
  }

  /* ---------- SOL price ---------- */
  var priceCache = null, priceInflight = null;
  function loadPrice() {
    if (L.cacheFresh(priceCache, C.PRICE_TTL_MS, Date.now())) return Promise.resolve(priceCache);
    if (!priceInflight) {
      priceInflight = fetch(C.PRICE_URL).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { var p = L.parsePrice(j); p.at = Date.now(); priceCache = p; return p; })
        .finally(function () { priceInflight = null; });
    }
    return priceInflight;
  }
  function createPriceWidget() {
    return baseWidget('price', function (ctx) {
      var el = ctx.el, fam = L.family(ctx.cols, ctx.rows), hero = L.heroPx(ctx.cols, ctx.rows);
      var sv = stateView(ctx, 'SOL');
      if (sv) { el.innerHTML = sv; wireRetry(ctx); return; }
      var p = ctx.data, ch = p.change24h, priceText = L.formatUsd(p.usd);
      hero = L.fitHero(hero, el.clientWidth, priceText);
      el.innerHTML = '<div class="hs-center"><div class="hs-hero" style="font-size:' + hero + 'px">' + priceText + '</div>' +
        '<div class="hs-label">SOL' + (ch == null ? '' : ' <span class="' + (ch < 0 ? 'hs-down' : 'hs-up') + '">' + L.formatPct(ch) + '</span>') + '</div>' +
        (fam === 'small' ? '' : '<div class="hs-sub"><span>24h change</span><span>' + (ctx.stale ? 'cached' : 'live') + ' · CoinGecko</span></div>') + '</div>';
    }, { every: C.PRICE_TTL_MS, load: function (ctx) {
      loadPrice().then(function (p) { ctx.data = p; ctx.stale = false; ctx.state = 'ready'; ctx.paint(); })
        .catch(function () { if (ctx.data) { ctx.stale = true; ctx.paint(); return; } ctx.state = 'error'; ctx.error = 'Price unavailable'; ctx.paint(); });
    } });
  }

  /* ---------- focus leaderboard + pomodoro hook ---------- */
  function postFocus(session) {
    var payload = L.focusPayload(session);
    if (!payload) return Promise.resolve(false);
    return readSession().then(function (s) {
      if (!s || !s.jwt) return false;
      return ipfpsFetch('/api/hearth/focus', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Init-Data': s.jwt }, body: JSON.stringify(payload) })
        .then(function (r) { sessionListeners.forEach(function (fn) { fn(); }); return r.ok; });
    }).catch(function (e) { console.warn('[hearth-focus]', e); return false; });
  }
  /* HearthUI's pomodoro calls window.HSLTasksBus.addSession() for completed focus sessions (>=30s).
     The tasks hub is trimmed from shipped builds, so we provide/extend that bus. */
  (function hookPomodoro() {
    var bus = root.HSLTasksBus || (root.HSLTasksBus = {});
    var prev = typeof bus.addSession === 'function' ? bus.addSession.bind(bus) : null;
    bus.addSession = function (s) {
      var out; try { if (prev) out = prev(s); } catch (_) {}
      postFocus({ mode: 'focus', durationSec: s && s.durationSec, endedAt: s && s.endedAt });
      return out;
    };
  })();
  root.HearthFocus = { post: postFocus };

  function createLeaderboardWidget() {
    return baseWidget('leaderboard', function (ctx) {
      var el = ctx.el, fam = L.family(ctx.cols, ctx.rows), hero = L.heroPx(ctx.cols, ctx.rows);
      var sv = stateView(ctx, 'Focus');
      if (sv) { el.innerHTML = sv; wireRetry(ctx); return; }
      var rows = ctx.data || [];
      if (!rows.length) { el.innerHTML = '<div class="hs-center"><div class="hs-glyph" style="font-size:' + Math.round(hero * 0.6) + 'px">◐</div><div class="hs-label">Finish a pomodoro to rank</div></div>'; return; }
      if (fam === 'small') {
        el.innerHTML = '<div class="hs-center"><div class="hs-hero" style="font-size:' + L.fitHero(hero, el.clientWidth, rows[0].minutes + 'm') + 'px">' + rows[0].minutes + 'm</div><div class="hs-label">#1 ' + esc(rows[0].name) + '</div></div>';
        return;
      }
      el.innerHTML = '<div class="hs-head"><span>Focus · Oct</span></div><ol class="hs-list">' + rows.slice(0, fam === 'large' ? 5 : 3).map(function (r) {
        return '<li class="hs-row"><span class="hs-rank">' + r.rank + '</span><span class="hs-row-main">' + esc(r.name) + '</span><b>' + r.minutes + 'm</b></li>';
      }).join('') + '</ol>';
    }, { every: 120000, onSession: true, load: function (ctx) {
      ipfpsFetch('/api/leaderboard?season=' + encodeURIComponent(C.FOCUS_SEASON))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { ctx.data = L.parseLeaderboard(j, 5); ctx.state = 'ready'; ctx.paint(); })
        .catch(function () { if (ctx.data) return; ctx.state = 'error'; ctx.error = 'Leaderboard offline'; ctx.paint(); });
    } });
  }

  /* ---------- registration ---------- */
  root.createSolanaWalletWidget = createWalletWidget;
  root.createSolPriceWidget = createPriceWidget;
  root.createFocusLeaderboardWidget = createLeaderboardWidget;
  if (typeof WidgetRegistry !== 'undefined') {
    WidgetRegistry.register('solanaWallet', createWalletWidget)
      .register('solPrice', createPriceWidget)
      .register('focusBoard', createLeaderboardWidget);
    var S = WidgetRegistry.WIDGET_SIZES;
    if (S) {
      S.solanaWallet = { min: [1, 1], max: null, preferred: [2, 2], allowed: [[1,1],[2,1],[2,2],[3,2],[2,3],[3,3],[4,3],[3,4],[4,4]] };
      S.solPrice = { min: [1, 1], max: null, preferred: [2, 1], allowed: [[1,1],[2,1],[2,2],[3,2],[3,1]] };
      S.focusBoard = { min: [1, 1], max: null, preferred: [3, 3], allowed: [[1,1],[2,2],[3,2],[2,3],[3,3],[3,4]] };
      S.hearthStore = { min: [2, 2], max: null, preferred: [3, 3], allowed: [[2,2],[3,2],[3,3],[4,3],[3,4],[4,4]] };
    }
  }
  /* WIDGET_CATALOG is a top-level const in newtab-core.js (script scope, not a window prop). */
  try {
    /* global WIDGET_CATALOG */
    if (typeof WIDGET_CATALOG !== 'undefined' && Array.isArray(WIDGET_CATALOG)) {
      [{ type: 'solanaWallet', label: 'Solana Wallet', desc: 'SOL + USDC on devnet', emoji: '◎', cat: 'utilities' },
       { type: 'solPrice', label: 'SOL Price', desc: 'Live SOL/USD, 24h change', emoji: '▲', cat: 'utilities' },
       { type: 'hearthStore', label: 'Hearth Store', desc: 'Themes & icon packs, paid in USDC', emoji: '✦', cat: 'utilities' },
       { type: 'focusBoard', label: 'Focus Board', desc: 'Pomodoro leaderboard', emoji: '◐', cat: 'productivity' }]
        .forEach(function (e) { if (!WIDGET_CATALOG.some(function (w) { return w.type === e.type; })) WIDGET_CATALOG.push(e); });
    }
  } catch (_) {}
})(window);
