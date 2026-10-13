/* Demo catalog on Solana devnet. Ownership is supplied by the existing verified session cache.
 * Pure helpers do not fetch, persist, or grant purchases. Plain script for MV3 CSP. */
(function (root) {
  'use strict';
  function createCatalog(readySkus) {
  var ready = new Set(Array.isArray(readySkus) ? readySkus.filter(function (sku) { return typeof sku === 'string'; }) : ['theme_aurora', 'theme_dune', 'icons_glass']);
  var tabs = [
    { id: 'featured', label: 'Featured', icon: '★' },
    { id: 'widgets', label: 'Widgets', icon: '⊞' },
    { id: 'themes', label: 'Themes', icon: '◈' },
    { id: 'icons', label: 'Icon Packs', icon: '▦' },
    { id: 'clocks', label: 'Clock Styles', icon: '◷' },
    { id: 'live', label: 'Live Wallpapers', icon: '▷' },
    { id: 'bundles', label: 'Bundles', icon: '◇' },
    { id: 'supporter', label: 'Supporter', icon: '♡' }
  ];
  function entry(id, name, kind, tab, price, status, description, extra) {
    return Object.assign({ id: id, name: name, kind: kind, tab: tab, price: price, status: status,
      author: 'Hearth Originals', description: description,
      preview: 'addon/store-previews/' + id + '.webp', thumb: 'addon/store-previews/' + id + '-thumb.webp' }, extra || {});
  }
  var items = [
    entry('theme_aurora', 'Aurora', 'theme', 'themes', 1.99, 'available', 'Cool emerald light and violet haze across your desktop.', { sku: 'theme_aurora', featured: true }),
    entry('theme_dune', 'Dune', 'theme', 'themes', 1.99, 'available', 'Warm sandstone tones with a soft amber accent.', { sku: 'theme_dune' }),
    entry('theme_midnight', 'Midnight', 'theme', 'themes', 1.99, 'available', 'Deep blue night with a precise cyan neon accent.', { sku: 'theme_midnight' }),
    entry('half_dome', 'Half Dome', 'theme', 'themes', 0, 'included', 'The original Yosemite theme, already included with HearthUI.'),
    entry('astronaut', 'Astronaut', 'theme', 'themes', 0, 'included', 'A quiet view of space, already included with HearthUI.'),
    entry('green', 'Green', 'theme', 'themes', 0, 'included', 'A fresh green backdrop, already included with HearthUI.'),
    entry('icons_glass', 'Glass', 'icons', 'icons', 2.99, 'available', 'Frosted tiles bring light and depth to your app icons.', { sku: 'icons_glass', featured: true }),
    entry('icons_mono', 'Mono', 'icons', 'icons', 2.99, 'available', 'Monochrome app icons on a calm, consistent tile.', { sku: 'icons_mono' }),
    entry('clock_orbit', 'Orbit', 'clock', 'clocks', 0.99, 'available', 'Luminous cyan digits and a quiet orbital glow.', { sku: 'clock_orbit', featured: true }),
    entry('retro_flip', 'Retro Flip', 'clock', 'clocks', 0.99, 'soon', 'A nostalgic split-flap clock. Coming soon.'),
    entry('yosemite_depth', 'Yosemite Depth', 'live', 'live', 3.99, 'soon', 'Layers of Yosemite scenery with depth. Coming soon.', { featured: true }),
    entry('deep_sea', 'Deep Sea', 'live', 'live', 3.99, 'soon', 'A procedural ocean-blue concept. Coming soon.'),
    entry('landscapes_pack', 'Landscapes Pack (9)', 'wallpaper-pack', 'themes', 0, 'included', 'Nine landscape wallpapers, already included with HearthUI.'),
    entry('flora_fauna_pack', 'Flora & Fauna (12)', 'wallpaper-pack', 'themes', 0, 'included', 'Twelve nature wallpapers, already included with HearthUI.'),
    entry('space_abstract_pack', 'Space & Abstract (7)', 'wallpaper-pack', 'themes', 0, 'included', 'Seven space and abstract wallpapers, already included with HearthUI.'),
    entry('bundle_focus', 'Focus Bundle', 'bundle', 'bundles', 4.99, 'available', 'Aurora, Glass icons, and Orbit clock together.', { sku: 'bundle_focus', includes: ['theme_aurora', 'icons_glass', 'clock_orbit'], featured: true }),
    entry('supporter', 'Supporter', 'badge', 'supporter', 4.99, 'soon', 'Support HearthUI and receive an exclusive theme when available.', { sku: 'supporter', featured: true })
  ];
  items.forEach(function (item) { if (item.status === 'available' && !ready.has(item.sku)) item.status = 'soon'; });
  items.forEach(function (item) { if (item.includes) Object.freeze(item.includes); Object.freeze(item); });
  tabs.forEach(Object.freeze);
  Object.freeze(items); Object.freeze(tabs);
  var known = new Set(items.filter(function (item) { return item.sku; }).map(function (item) { return item.sku; }));
  var dates=root && root.HearthDateConcepts;
  if(!dates && typeof module!=='undefined' && module.exports)dates=require('./store-date-concepts.js');
  if(dates)dates.items.forEach(function(item){known.add(item.sku);});
  function filterItems(tabId) { return items.filter(function (item) { return tabId === 'featured' ? item.featured === true : item.tab === tabId; }); }
  function expandOwned(owned) {
    var values = Array.isArray(owned) ? owned : owned && typeof owned === 'object' ?
      (Array.isArray(owned.skus) ? owned.skus : []).concat(Array.isArray(owned.items) ? owned.items : []) : [];
    var result = new Set();
    values.forEach(function (value) {
      var sku = typeof value === 'string' ? value : value && typeof value === 'object' && !Array.isArray(value) ? value.sku : null;
      if (!known.has(sku)) return;
      if (value && typeof value === 'object' && (value.owned === false || (value.status !== undefined && value.status !== 'confirmed'))) return;
      result.add(sku);
    });
    items.forEach(function (item) {
      if (item.includes && result.has(item.sku)) item.includes.forEach(function (sku) { result.add(sku); });
    });
    return Array.from(result);
  }
  function cardState(item, owned, applied) {
    if (!item || typeof item !== 'object') return 'soon';
    if (item.status === 'included') return 'included';
    if (item.sku && expandOwned(owned).indexOf(item.sku) >= 0) {
      var active = typeof applied === 'string' ? applied : applied && typeof applied === 'object' ? applied[item.kind] : null;
      return active === item.sku ? 'applied' : 'owned';
    }
    return item.status === 'available' && item.sku ? 'available' : 'soon';
  }
  function ownedCount(owned) {
    var skus = expandOwned(owned), purchasable = items.concat(dates?dates.items:[]).filter(function (item) { return item.sku && item.status === 'available'; });
    return { owned: purchasable.filter(function (item) { return skus.indexOf(item.sku) >= 0; }).length, total: purchasable.length };
  }
  function formatPrice(item) {
    if (!item || item.status === 'soon') return 'Soon';
    if (item.status === 'included') return 'Free';
    return typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 ? '$' + item.price.toFixed(2) + ' USDC' : 'Soon';
  }
  var api = Object.freeze({ tabs: tabs, items: items, filterItems: filterItems, expandOwned: expandOwned,
    cardState: cardState, ownedCount: ownedCount, formatPrice: formatPrice, createCatalog: createCatalog });
  return api;
  }
  var api = createCatalog(root && root.HearthSolanaConfig && root.HearthSolanaConfig.READY_PASS_SKUS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HearthStoreCatalog = api;
})(typeof window !== 'undefined' ? window : null);
