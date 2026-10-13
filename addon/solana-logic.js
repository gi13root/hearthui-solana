/* Pure helpers for the Solana addon widgets (no DOM, no network). */
(function (root) {
  'use strict';
  var LAMPORTS = 1e9;
  function lamportsToSol(l) { return Number(l || 0) / LAMPORTS; }
  function trim(n, d) { return String(Number(n.toFixed(d))); }
  function formatSol(v) {
    v = Number(v) || 0;
    if (v === 0) return '0';
    if (v >= 1e6) return trim(v / 1e6, 1) + 'M';
    if (v >= 1e4) return trim(v / 1e3, 1) + 'K';
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(4);
  }
  function formatUsd(v) { v = Number(v) || 0; return '$' + (v >= 1 ? v.toFixed(2) : v.toFixed(4)); }
  function formatPct(v) { v = Number(v) || 0; return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1) + '%'; }
  function shortAddress(a) { a = String(a || ''); return a.length > 10 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }
  function rpcResult(json) {
    if (!json) throw new Error('empty RPC response');
    if (json.error) throw new Error(json.error.message || 'RPC error');
    return json.result;
  }
  function parseBalance(json) {
    var r = rpcResult(json);
    var v = r && typeof r === 'object' ? r.value : r;
    if (typeof v !== 'number') throw new Error('bad balance');
    return lamportsToSol(v);
  }
  function parseTokenBalance(json) {
    var r = rpcResult(json), sum = 0;
    ((r && r.value) || []).forEach(function (acc) {
      var ta = acc && acc.account && acc.account.data && acc.account.data.parsed &&
        acc.account.data.parsed.info && acc.account.data.parsed.info.tokenAmount;
      if (!ta) return;
      sum += ta.uiAmount != null ? Number(ta.uiAmount) : Number(ta.amount) / Math.pow(10, ta.decimals || 0);
    });
    return sum;
  }
  function parseSignatures(json, limit) {
    var r = rpcResult(json) || [];
    return r.slice(0, limit || 5).map(function (s) {
      return { signature: s.signature, short: shortAddress(s.signature), blockTime: s.blockTime || null, ok: !s.err };
    });
  }
  function relTime(blockTime, nowMs) {
    if (!blockTime) return '—';
    var s = Math.max(0, Math.round(nowMs / 1000 - blockTime));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }
  function parsePrice(json) {
    var s = json && json.solana;
    if (!s || typeof s.usd !== 'number') throw new Error('price unavailable');
    return { usd: s.usd, change24h: typeof s.usd_24h_change === 'number' ? s.usd_24h_change : null };
  }
  function cacheFresh(entry, ttl, now) { return !!(entry && typeof entry.at === 'number' && now - entry.at < ttl); }
  function normalizeOwned(v) {
    var list = Array.isArray(v) ? v : (v && Array.isArray(v.skus) ? v.skus : []);
    var out = [];
    list.forEach(function (s) { if (typeof s === 'string' && out.indexOf(s) === -1) out.push(s); });
    return out;
  }
  function storeItems(catalog, owned) {
    owned = normalizeOwned(owned);
    return catalog.map(function (i) {
      var o = {}; for (var k in i) o[k] = i[k];
      o.owned = owned.indexOf(i.sku) !== -1; return o;
    });
  }
  function bridgeActionFor(item) { return item.method === 'usdc' ? 'pay' : 'buy'; }
  function canApply(sku, owned) { return normalizeOwned(owned).indexOf(sku) !== -1; }
  /* aw: small = one metric, medium = + details, large = + list. */
  function family(cols, rows) {
    if (cols >= 3 && rows >= 3) return 'large';
    if (cols >= 3 || (cols >= 2 && rows >= 3)) return 'medium';
    return 'small';
  }
  /* aw §14: clamp(28, cols*18 + rows*14, 130) */
  function heroPx(cols, rows) { return Math.max(28, Math.min(130, cols * 18 + rows * 14)); }
  /* aw §15: monospace glyph ~0.62em; keep 12% side padding; never upscale past §14 size */
  function fitHero(px, widthPx, text) {
    if (!widthPx) return px;
    var fit = Math.floor((widthPx * 0.88) / (0.62 * String(text).length));
    return Math.max(16, Math.min(px, fit));
  }
  function focusPayload(session) {
    if (!session || (session.mode && session.mode !== 'focus')) return null;
    var sec = Number(session.durationSec) || 0;
    var minutes = Math.min(90, Math.round(sec / 60));
    if (minutes < 5) return null; /* IPFPS accepts 5..90 */
    var ended = Number(session.endedAt) || Date.now();
    /* deterministic id => retries stay idempotent on the server */
    var hex = ('000000000000' + ended.toString(16)).slice(-12);
    return { session_id: '00000000-0000-4000-8000-' + hex, minutes: minutes,
      started_at: new Date(ended - minutes * 60000).toISOString() };
  }
  function parseLeaderboard(json, limit) {
    var list = json && (json.top_players || json.entries || json.leaderboard || (Array.isArray(json) ? json : null));
    if (!Array.isArray(list)) return [];
    return list.map(function (e, i) {
      return { rank: Number(e.rank) || i + 1, name: e.nickname || e.display || e.name || shortAddress(e.address || ''), minutes: Number(e.minutes) || (e.score != null ? Math.round(Number(e.score) / 10) : 0) };
    }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, limit || 5);
  }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var api = { lamportsToSol: lamportsToSol, formatSol: formatSol, formatUsd: formatUsd, formatPct: formatPct,
    shortAddress: shortAddress, parseBalance: parseBalance, parseTokenBalance: parseTokenBalance,
    parseSignatures: parseSignatures, relTime: relTime, parsePrice: parsePrice, cacheFresh: cacheFresh,
    normalizeOwned: normalizeOwned, storeItems: storeItems, bridgeActionFor: bridgeActionFor, canApply: canApply,
    family: family, heroPx: heroPx, fitHero: fitHero, focusPayload: focusPayload, parseLeaderboard: parseLeaderboard, escapeHtml: escapeHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HearthSolanaLogic = api;
})(typeof window !== 'undefined' ? window : null);
