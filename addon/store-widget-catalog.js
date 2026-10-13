/* Included widgets for Hearth Store. The registry remains the source of availability.
 * Fallback metadata covers only types observed in the shell and addon registrations;
 * this script never registers factories, invents source URLs, or grants paid ownership. */
(function (root) {
  'use strict';
  var categories = Object.freeze([
    {id:'all',label:'All',icon:'▦'}, {id:'clocks',label:'Clocks',icon:'◷'},
    {id:'timer',label:'Timer',icon:'◴'}, {id:'productivity',label:'Productivity',icon:'✓'},
    {id:'time',label:'Time & Info',icon:'◷'}, {id:'utilities',label:'Utilities',icon:'◇'},
    {id:'date',label:'Date Designs',icon:'◷'}
  ].map(function (category) { return Object.freeze(category); }));
  // Observed in newtab-shell.js source declarations / WIDGET_TYPE_LABELS,
  // newtab-core.js WIDGET_CATALOG, and addon/widgets.js registrations.
  var definitions = [
    {type:'clock',label:'Clock',desc:'Live time + date',cat:'time'},
    {type:'countdown',label:'Countdown',desc:'Count down to an event',cat:'time'},
    {type:'weather',label:'Weather',desc:'Current conditions',cat:'time'},
    {type:'search',label:'Search',desc:'Search from your desktop',cat:'utilities'},
    {type:'calendar',label:'Calendar',desc:'A calendar on your desktop',cat:'time'},
    {type:'pin',label:'Note',desc:'One thought, always visible',cat:'productivity'},
    {type:'pomodoro',label:'Pomodoro',desc:'Focus timer with breaks',cat:'productivity'},
    {type:'timer',label:'Timer',desc:'Countdown with a dial',cat:'time'},
    {type:'tasksLite',label:'Tasks Lite',desc:'A compact task list',cat:'productivity'},
    {type:'tasks',label:'Tasks',desc:'Keep track of your tasks',cat:'productivity'},
    {type:'habits',label:'Habits',desc:'Keep your habits in view',cat:'productivity'},
    {type:'media',label:'Media',desc:'Control whatever tab is playing',cat:'utilities'},
    {type:'appgrid',label:'App Grid',desc:'Quick apps and folders',cat:'utilities'},
    {type:'youtube',label:'YouTube',desc:'YouTube on your desktop',cat:'utilities'},
    {type:'photoframe',label:'Photo Frame',desc:'Your photos on the desktop',cat:'utilities'},
    {type:'solanaWallet',label:'Solana Wallet',desc:'SOL + USDC on devnet',cat:'utilities'},
    {type:'solPrice',label:'SOL Price',desc:'Live SOL/USD, 24h change',cat:'utilities'},
    {type:'hearthStore',label:'Hearth Store',desc:'Themes & icon packs, paid in USDC',cat:'utilities'},
    {type:'focusBoard',label:'Focus Board',desc:'Pomodoro leaderboard',cat:'productivity'}
  ];
  var known = new Set(definitions.map(function (definition) { return definition.type; }));
  function text(value, fallback, max) {
    return typeof value === 'string' && value.trim() && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : fallback;
  }
  function buildItems(supplied, availableTypes) {
    var available = new Set(Array.isArray(availableTypes) ? availableTypes.filter(function (type) { return typeof type === 'string' && known.has(type); }) : []);
    var metadata = new Map();
    (Array.isArray(supplied) ? supplied : []).forEach(function (definition) {
      if (!definition || typeof definition !== 'object' || Array.isArray(definition) || !known.has(definition.type) || metadata.has(definition.type)) return;
      metadata.set(definition.type, definition);
    });
    return definitions.filter(function (definition) { return available.has(definition.type); }).map(function (fallback) {
      var definition = metadata.get(fallback.type) || {}, type = fallback.type;
      var category = ['productivity','time','utilities'].indexOf(definition.cat) >= 0 ? definition.cat : fallback.cat;
      // Media belongs with utilities even if old catalog metadata grouped it differently.
      if (type === 'media') category = 'utilities';
      return Object.freeze({id:'widget_' + type,name:text(definition.label,fallback.label,100),
        description:text(definition.desc,fallback.desc,500),author:'HearthUI',kind:'widget',tab:'widgets',status:'included',price:0,
        widgetType:type,category:category,preview:'addon/store-previews/widget_' + type + '.webp',
        thumb:'addon/store-previews/widget_' + type + '-thumb.webp'});
    });
  }
  function getItems() {
    var registry = root && root.WidgetRegistry;
    if (!registry) return [];
    var supplied = root.WIDGET_CATALOG;
    // Core declares this as a top-level const, rather than a window property.
    try { if (typeof WIDGET_CATALOG !== 'undefined') supplied = WIDGET_CATALOG; } catch (_) {}
    var available = definitions.filter(function (definition) {
      try {
        return (typeof registry.has === 'function' && registry.has(definition.type) === true) ||
          (typeof registry.sourceOf === 'function' && typeof registry.sourceOf(definition.type) === 'string' && registry.sourceOf(definition.type).length > 0);
      } catch (_) { return false; }
    }).map(function (definition) { return definition.type; });
    return buildItems(supplied, available);
  }
  function filterItems(categoryId, suppliedItems) {
    var items = Array.isArray(suppliedItems) ? suppliedItems : getItems();
    if (!categories.some(function (category) { return category.id === categoryId; })) return [];
    return items.filter(function (item) {
      if (!item || typeof item !== 'object' || item.kind !== 'widget' || !known.has(item.widgetType)) return false;
      if (categoryId === 'all') return true;
      if (categoryId === 'clocks') return item.widgetType === 'clock';
      if (categoryId === 'timer') return ['timer','pomodoro','countdown'].indexOf(item.widgetType) >= 0;
      return item.category === categoryId;
    });
  }
  var api = Object.freeze({categories:categories,buildItems:buildItems,getItems:getItems,filterItems:filterItems});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HearthStoreWidgets = api;
})(typeof window !== 'undefined' ? window : null);
