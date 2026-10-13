/* Pure bridge logic (no DOM). Owner: A1. window.HearthBridgeCore / module.exports. */
(function (root) {
  'use strict';
  var CATALOG = {
    supporter: { price: '4.99', amount: 4990000n, method: 'usdc' },
    theme_aurora: { price: '1.99', amount: 1990000n, method: 'pass' },
    theme_dune: { price: '1.99', amount: 1990000n, method: 'pass' },
    icons_glass: { price: '2.99', amount: 2990000n, method: 'pass' },
    theme_midnight: { price: '1.99', amount: 1990000n, method: 'pass' },
    icons_mono: { price: '2.99', amount: 2990000n, method: 'pass' },
    clock_orbit: { price: '0.99', amount: 990000n, method: 'pass' },
    bundle_focus: { price: '4.99', amount: 4990000n, method: 'pass' },
  };
  var dates = root.HearthDateConcepts || (typeof require === 'function' ? require('../addon/store-date-concepts.js') : null);
  if (dates) dates.items.forEach(function (item) { CATALOG[item.sku] = {price:item.price.toFixed(2),amount:BigInt(Math.round(item.price * 1000000)),method:'pass',label:item.name,kind:item.kind}; });
  var ACTION_METHOD = { pay: 'usdc', buy: 'pass' };
  var CONFIG = {
    extensionId: 'pbacffgkgjlkbnafpmakmmppcikgegpf',
    rpc: 'https://api.devnet.solana.com',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    usdcDecimals: 6,
    escrow: null, // HEARTH_ESCROW_DEVNET: wallet owner of the escrow ATA; set once friend confirms (or via #escrow= for testing)
    ipfpsBase: 'https://heartui.ipfps.org',
  };

  function parseHash(hash) {
    var p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    var action = p.get('action'), sku = p.get('sku') || null;
    if (!action) return { error: 'missing_action' };
    if (action !== 'signin' && !ACTION_METHOD[action]) return { error: 'unknown_action' };
    if (action === 'signin') return { action: action, sku: null };
    if (!sku) return { error: 'missing_sku' };
    if (!Object.prototype.hasOwnProperty.call(CATALOG, sku)) return { error: 'unknown_sku' };
    if (CATALOG[sku].method !== ACTION_METHOD[action]) return { error: 'wrong_method' };
    return { action: action, sku: sku };
  }
  function buildSignInMessage(nonce, now) {
    var iso = (now || new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return 'Sign in to HearthUI (heartui.ipfps.org)\n\nNonce: ' + nonce + '\nIssued At: ' + iso;
  }
  function sessionMsg(address, jwt) { return { v: 1, type: 'session', address: address, jwt: jwt || null, network: 'devnet' }; }
  function purchaseMsg(sku, sig) { return { v: 1, type: 'purchase', sku: sku, method: CATALOG[sku].method, tx_signature: sig, status: 'confirmed' }; }
  function errorMsg(action, code, message) { return { v: 1, type: 'error', action: action, code: code, message: String(message || '').slice(0, 300) }; }

  var api = { CATALOG: CATALOG, CONFIG: CONFIG, parseHash: parseHash, buildSignInMessage: buildSignInMessage,
    sessionMsg: sessionMsg, purchaseMsg: purchaseMsg, errorMsg: errorMsg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HearthBridgeCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
