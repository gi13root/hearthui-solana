/* HearthUI x Solana addon config. Plain script (MV3 CSP): sets window.HearthSolanaConfig.
   Also loadable from node tests via module.exports. */
(function (root) {
  'use strict';
  var dates = (root && root.HearthDateConcepts) || (typeof require === 'function' ? require('./store-date-concepts.js') : null);
  var flags = (root && root.HEARTH_FLAGS) || {};
  var IPFPS_BASE = flags.HEARTH_IPFPS_BASE || 'https://heartui.ipfps.org'; // 'mock' -> mock/ipfps-mock.js
  var cfg = {
    NETWORK: 'devnet',
    RPC_URL: 'https://api.devnet.solana.com',
    USDC_MINT: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    USDC_DECIMALS: 6,
    EXT_ID: 'pbacffgkgjlkbnafpmakmmppcikgegpf',
    HEARTH_IPFPS_BASE: IPFPS_BASE,
    HEARTH_ESCROW_DEVNET: 'HEARTH_ESCROW_DEVNET', // placeholder until friend confirms
    BRIDGE_URL: flags.HEARTH_BRIDGE_URL || 'https://heartui.ipfps.org/bridge/',
    PRICE_URL: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true',
    PRICE_TTL_MS: 60000,
    WALLET_TTL_MS: 30000,
    FOCUS_SEASON: 'focus_2026_10',
    STORAGE_SESSION: 'hearth.solana.session',
    STORAGE_OWNED: 'hearth.solana.owned',
    STORAGE_APPLIED: 'hearth.solana.applied',
    // Promote only after verifying devnet theme accounts and bridge compatibility.
    READY_PASS_SKUS: ['theme_aurora', 'theme_dune', 'icons_glass', 'theme_midnight', 'icons_mono', 'clock_orbit', 'bundle_focus'], // verified on devnet 2026-10-12 20:27 PT; date stacks route separately
    CATALOG: [
      { sku: 'supporter', price: 4.99, method: 'usdc', kind: 'badge', label: 'Supporter', desc: 'Back HearthUI, get a badge' },
      { sku: 'theme_aurora', price: 1.99, method: 'pass', kind: 'theme', label: 'Aurora', desc: 'Green-violet night sky' },
      { sku: 'theme_dune', price: 1.99, method: 'pass', kind: 'theme', label: 'Dune', desc: 'Warm sand at dusk' },
      { sku: 'icons_glass', price: 2.99, method: 'pass', kind: 'icons', label: 'Glass icons', desc: 'Frosted dock & grid icons' },
      { sku: 'theme_midnight', price: 1.99, method: 'pass', kind: 'theme', label: 'Midnight', desc: 'Dark sky, electric accents' },
      { sku: 'icons_mono', price: 2.99, method: 'pass', kind: 'icons', label: 'Mono icons', desc: 'A quieter monochrome desktop' },
      { sku: 'clock_orbit', price: 0.99, method: 'pass', kind: 'clock', label: 'Orbit', desc: 'Luminous digits, soft material' },
      { sku: 'bundle_focus', price: 4.99, method: 'pass', kind: 'bundle', label: 'Focus Bundle', desc: 'Aurora, Glass and Orbit', includes: ['theme_aurora', 'icons_glass', 'clock_orbit'] }
    ],
    bridgeUrl: function (action, sku) {
      return cfg.BRIDGE_URL + '#action=' + encodeURIComponent(action) + (sku ? '&sku=' + encodeURIComponent(sku) : '');
    }
  };
  if (dates) cfg.CATALOG = cfg.CATALOG.concat(dates.items.map(function (item) { return { sku:item.sku, price:item.price, method:'pass', kind:item.kind, label:item.name, desc:item.description }; }));
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (root) root.HearthSolanaConfig = cfg;
})(typeof window !== 'undefined' ? window : null);
