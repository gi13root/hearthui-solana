/* HearthUI Solana session (extension side). Owner: A1.
 * Receives bridge messages (docs/CONTRACT.md "Messaging"), stores session/owned in chrome.storage.local,
 * exposes window.HearthSolana { getSession, getOwned, isOwned, openBridge, refreshOwned, signOut, onChange }.
 * Plain script, no modules (MV3 CSP). Node: module.exports for tests. */
(function (root) {
  'use strict';
  var SESSION_KEY = 'hearth.solana.session', OWNED_KEY = 'hearth.solana.owned';
  var ALLOWED_ORIGINS = ['https://heartui.ipfps.org', 'http://localhost:3434'];
  var BRIDGE_URL = 'https://heartui.ipfps.org/bridge/';
  var SKU_METHOD = { supporter: 'usdc', theme_aurora: 'pass', theme_dune: 'pass', icons_glass: 'pass' };
  var B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

  function originOf(sender) {
    if (!sender) return null;
    if (sender.origin) return sender.origin;
    try { return new URL(sender.url).origin; } catch (e) { return null; }
  }
  function validateSender(sender) { return ALLOWED_ORIGINS.indexOf(originOf(sender)) >= 0; }
  function isAddr(s) { return typeof s === 'string' && s.length >= 32 && s.length <= 44 && B58.test(s); }
  function isSig(s) { return typeof s === 'string' && s.length >= 64 && s.length <= 90 && B58.test(s); }
  function shortStr(s, n) { return typeof s === 'string' && s.length > 0 && s.length <= n; }

  function validateMessage(m) {
    var bad = function (why) { return { ok: false, error: why }; };
    if (!m || typeof m !== 'object') return bad('not_object');
    if (m.v !== 1) return bad('bad_version');
    if (m.type === 'session') {
      if (!isAddr(m.address)) return bad('bad_address');
      if (!(m.jwt === null || shortStr(m.jwt, 4096))) return bad('bad_jwt');
      if (m.network !== 'devnet') return bad('bad_network');
      return { ok: true };
    }
    if (m.type === 'purchase') {
      if (!SKU_METHOD[m.sku]) return bad('unknown_sku');
      if (m.method !== SKU_METHOD[m.sku]) return bad('bad_method');
      if (!isSig(m.tx_signature)) return bad('bad_signature');
      if (m.status !== 'confirmed') return bad('bad_status');
      return { ok: true };
    }
    if (m.type === 'error') {
      if (!shortStr(m.action, 16) || !shortStr(m.code, 64) || typeof m.message !== 'string' || m.message.length > 500) return bad('bad_error');
      return { ok: true };
    }
    return bad('unknown_type');
  }

  function create(deps) {
    deps = deps || {};
    var chromeApi = deps.chrome || root.chrome;
    var fetchImpl = deps.fetch || (root.fetch && root.fetch.bind(root));
    var openTab = deps.open || function (url) {
      if (chromeApi && chromeApi.tabs && chromeApi.tabs.create) chromeApi.tabs.create({ url: url }); else root.open(url, '_blank', 'noopener');
    };
    var listeners = [], lastError = null;

    function get(key) { return new Promise(function (r) { chromeApi.storage.local.get([key], function (o) { r(o && o[key]); }); }); }
    function set(obj) { return new Promise(function (r) { chromeApi.storage.local.set(obj, function () { r(); }); }); }
    function emit(kind) { listeners.forEach(function (f) { try { f(kind); } catch (e) { /* ignore */ } }); }
    function ipfpsBase() { var b = root.HEARTH_IPFPS_BASE; return !b || b === 'mock' ? 'https://heartui.ipfps.org' : String(b).replace(/\/$/, ''); }

    async function getSession() { return (await get(SESSION_KEY)) || null; }
    // Stored shape: { skus: string[], items: entitlement[] } (A2 store reads `skus`).
    function normOwned(v) { if (Array.isArray(v)) return v.map(function (x) { return typeof x === 'string' ? { sku: x } : x; }); return (v && v.items) || (v && v.skus ? v.skus.map(function (x) { return { sku: x }; }) : []); }
    function packOwned(items) { var o = {}; o[OWNED_KEY] = { skus: items.map(function (x) { return x.sku; }), items: items }; return o; }
    async function getOwned() { return normOwned(await get(OWNED_KEY)); }
    async function ipfpsFetch(path, init) { return fetchImpl(ipfpsBase() + path, init); }
    async function isOwned(sku) { return (await getOwned()).some(function (o) { return o.sku === sku; }); }

    function openBridge(action, sku) {
      if (['signin', 'pay', 'buy'].indexOf(action) < 0) throw new Error('bad action');
      if (action !== 'signin' && !SKU_METHOD[sku]) throw new Error('bad sku');
      var url = (root.HEARTH_BRIDGE_URL || (root.HEARTH_FLAGS && root.HEARTH_FLAGS.HEARTH_BRIDGE_URL) || BRIDGE_URL) + '#action=' + action + (action === 'signin' ? '' : '&sku=' + encodeURIComponent(sku));
      openTab(url); return url;
    }

    async function defaultPassCheck(address, sku) {
      var client = root.HearthPassClient;
      if (client && typeof client.isPassOwned === 'function') return client.isPassOwned(address, sku);
      return null; // unknown: no on-chain checker loaded
    }

    // Source of truth order: IPFPS owned -> on-chain PDA -> keep last verified cache (never local-only grants).
    async function refreshOwned() {
      var s = await getSession(); if (!s) return getOwned();
      if (s.jwt && fetchImpl) {
        try {
          var r = await fetchImpl(ipfpsBase() + '/api/hearth/owned', { headers: { 'Init-Data': s.jwt } });
          if (r.ok) { var j = await r.json(); if (Array.isArray(j.owned)) { await set(packOwned(j.owned)); emit('owned'); return j.owned; } }
        } catch (e) { lastError = e; }
      }
      var check = deps.passCheck || defaultPassCheck, prev = await getOwned(), out = [], anyKnown = false;
      for (var sku in SKU_METHOD) {
        if (SKU_METHOD[sku] !== 'pass') continue;
        var has = null; try { has = await check(s.address, sku); } catch (e) { lastError = e; }
        if (has === null || has === undefined) { prev.filter(function (o) { return o.sku === sku; }).forEach(function (o) { out.push(o); }); continue; }
        anyKnown = true;
        if (has) out.push({ sku: sku, source: 'pass', verified: 'onchain' });
      }
      prev.filter(function (o) { return SKU_METHOD[o.sku] === 'usdc'; }).forEach(function (o) { out.push(o); }); // usdc only verifiable by IPFPS
      if (anyKnown) { await set(packOwned(out)); emit('owned'); }
      return anyKnown ? out : prev;
    }

    async function handle(msg, sender) {
      if (!validateSender(sender)) return { ok: false, error: 'bad_sender' };
      var v = validateMessage(msg); if (!v.ok) return v;
      if (msg.type === 'session') {
        await set({ [SESSION_KEY]: { address: msg.address, jwt: msg.jwt, network: msg.network, at: Date.now() } });
        emit('session'); refreshOwned().catch(function () {});
      } else if (msg.type === 'purchase') {
        // Optimistic entry from a confirmed tx; replaced by IPFPS/on-chain truth on next refreshOwned().
        var owned = (await getOwned()).filter(function (o) { return o.sku !== msg.sku; });
        owned.push({ sku: msg.sku, source: msg.method, tx_signature: msg.tx_signature, verified: 'bridge' });
        await set(packOwned(owned)); emit('owned');
        setTimeout(function () { refreshOwned().catch(function () {}); }, 3000);
      } else { lastError = msg; emit('error'); }
      return { ok: true };
    }

    function install() {
      if (!chromeApi || !chromeApi.runtime || !chromeApi.runtime.onMessageExternal) return false;
      chromeApi.runtime.onMessageExternal.addListener(function (msg, sender, sendResponse) {
        handle(msg, sender).then(sendResponse, function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
        return true; // async response
      });
      if (chromeApi.storage && chromeApi.storage.onChanged) chromeApi.storage.onChanged.addListener(function (ch, area) {
        if (area === 'local' && (ch[SESSION_KEY] || ch[OWNED_KEY])) emit(ch[SESSION_KEY] ? 'session' : 'owned');
      });
      return true;
    }

    async function signOut() { await new Promise(function (r) { chromeApi.storage.local.remove([SESSION_KEY, OWNED_KEY], r); }); emit('session'); }
    function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

    return { install: install, handle: handle, getSession: getSession, getOwned: getOwned, isOwned: isOwned, openBridge: openBridge,
      refreshOwned: refreshOwned, ipfpsFetch: ipfpsFetch, signOut: signOut, onChange: onChange, lastError: function () { return lastError; } };
  }

  var exported = { create: create, validateMessage: validateMessage, validateSender: validateSender, SESSION_KEY: SESSION_KEY, OWNED_KEY: OWNED_KEY };
  if (typeof module !== 'undefined' && module.exports) { module.exports = exported; return; }
  if (root.chrome && root.chrome.storage) {
    var inst = create();
    inst.install();
    root.HearthSolana = inst;
  }
  root.HearthSolanaSession = exported;
})(typeof window !== 'undefined' ? window : globalThis);
