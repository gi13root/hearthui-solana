/* Supporter presentation only. Purchases and receipts stay with existing bridge APIs. */
(function (root) {
  'use strict';
  function supporterOffer(options) {
    options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    var item = options.item;
    var result = { enabled: false, action: 'none', label: 'Coming soon', price: '$4.99 USDC' };
    if (!item || typeof item !== 'object' || Array.isArray(item) || item.sku !== 'supporter' ||
        typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price <= 0 ||
        ['available', 'soon'].indexOf(item.status) < 0) return result;
    result.price = '$' + item.price.toFixed(2) + ' USDC';
    if (options.state === 'owned' || options.state === 'applied') {
      if (options.hasReceipt === true) {
        result.enabled = true; result.action = 'receipt'; result.label = 'View receipt ↗';
      } else result.label = 'Supporter active';
      return result;
    }
    if (item.status === 'available' && options.state === 'available') {
      result.enabled = true;
      result.action = options.connected === true ? 'support' : 'signin';
      result.label = options.connected === true ? 'Support HearthUI' : 'Connect wallet';
    }
    return result;
  }
  var api = Object.freeze({ supporterOffer: supporterOffer });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HearthSupporter = api;
})(typeof window !== 'undefined' ? window : null);
