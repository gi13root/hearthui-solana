/* HearthUI x Solana addon config. Plain script (MV3 CSP): sets window.HearthSolanaConfig.
   Also loadable from node tests via module.exports. */
(function (root) {
  'use strict';
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
    BRIDGE_URL: 'https://heartui.ipfps.org/bridge/',
    PRICE_URL: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true',
    PRICE_TTL_MS: 60000,
    WALLET_TTL_MS: 30000,
    FOCUS_SEASON: 'focus_2026_10',
    STORAGE_SESSION: 'hearth.solana.session',
    STORAGE_OWNED: 'hearth.solana.owned',
    STORAGE_APPLIED: 'hearth.solana.applied',
    CATALOG: [
      { sku: 'supporter', price: 4.99, method: 'usdc', kind: 'badge', label: 'Supporter', desc: 'Back HearthUI, get a badge' },
      { sku: 'theme_aurora', price: 1.99, method: 'pass', kind: 'theme', label: 'Aurora', desc: 'Green-violet night sky' },
      { sku: 'theme_dune', price: 1.99, method: 'pass', kind: 'theme', label: 'Dune', desc: 'Warm sand at dusk' },
      { sku: 'icons_glass', price: 2.99, method: 'pass', kind: 'icons', label: 'Glass icons', desc: 'Frosted dock & grid icons' }
    ],
    bridgeUrl: function (action, sku) {
      return cfg.BRIDGE_URL + '#action=' + encodeURIComponent(action) + (sku ? '&sku=' + encodeURIComponent(sku) : '');
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  if (root) root.HearthSolanaConfig = cfg;
})(typeof window !== 'undefined' ? window : null);
