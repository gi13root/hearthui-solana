/* Static Date Studio design artwork from the supplied date-widget-concepts.html.
 * Draft catalog prices are presentation data; this module does not implement payments,
 * register widgets, create ownership, or promise live date/calendar functionality. */
(function (root) {
  'use strict';
  var styles = Object.freeze([
    {id:'all',label:'All',icon:'▦'}, {id:'nothing',label:'Nothing OS',icon:'●'},
    {id:'liquid',label:'Liquid Glass',icon:'◈'}, {id:'terminal',label:'CRT Terminal',icon:'>_'},
    {id:'eink',label:'Color E-Ink',icon:'▤'}
  ].map(function (style) { return Object.freeze(style); }));
  var periods = Object.freeze([
    {id:'all',label:'All',icon:'▦'}, {id:'day',label:'Day',icon:'◷'},
    {id:'week',label:'Week',icon:'▥'}, {id:'month',label:'Month',icon:'▦'}
  ].map(function (period) { return Object.freeze(period); }));
  // Exact visible card captions; source order is style, period, then variant 1–8.
  var sourceDesigns = [
    ["date_nothing_day_1", "NDOT_DAY // 01", "nothing", "day"],
    ["date_nothing_day_2", "TACHOMETER", "nothing", "day"],
    ["date_nothing_day_3", "PILL_HORIZON", "nothing", "day"],
    ["date_nothing_day_4", "TAPE_DRUM", "nothing", "day"],
    ["date_nothing_day_5", "HUD_STENCIL", "nothing", "day"],
    ["date_nothing_day_6", "TYPO_OVERLAP", "nothing", "day"],
    ["date_nothing_day_7", "SOLAR_ARC", "nothing", "day"],
    ["date_nothing_day_8", "MINI_CHIP", "nothing", "day"],
    ["date_nothing_week_1", "LED_COLUMNS", "nothing", "week"],
    ["date_nothing_week_2", "EQUALIZER", "nothing", "week"],
    ["date_nothing_week_3", "RING_WEEK", "nothing", "week"],
    ["date_nothing_week_4", "SPLIT_WEEK", "nothing", "week"],
    ["date_nothing_week_5", "CONSTELLATION", "nothing", "week"],
    ["date_nothing_week_6", "3_DAY_FOCUS", "nothing", "week"],
    ["date_nothing_week_7", "STEPPER_7", "nothing", "week"],
    ["date_nothing_week_8", "WAVE_CADENCE", "nothing", "week"],
    ["date_nothing_month_1", "MATRIX_CAL", "nothing", "month"],
    ["date_nothing_month_2", "PROGRESS_TAPE", "nothing", "month"],
    ["date_nothing_month_3", "31_DOTS", "nothing", "month"],
    ["date_nothing_month_4", "12_MONTHS", "nothing", "month"],
    ["date_nothing_month_5", "RATIO_SPLIT", "nothing", "month"],
    ["date_nothing_month_6", "ORBIT_MONTH", "nothing", "month"],
    ["date_nothing_month_7", "DESK_PAD", "nothing", "month"],
    ["date_nothing_month_8", "BARCODE_M", "nothing", "month"],
    ["date_liquid_day_1", "LIQUID LENS", "liquid", "day"],
    ["date_liquid_day_2", "SPLIT PILL", "liquid", "day"],
    ["date_liquid_day_3", "ORBIT RING", "liquid", "day"],
    ["date_liquid_day_4", "PRISMATIC", "liquid", "day"],
    ["date_liquid_day_5", "COMPASS", "liquid", "day"],
    ["date_liquid_day_6", "WATERMARK", "liquid", "day"],
    ["date_liquid_day_7", "CYBER HUD", "liquid", "day"],
    ["date_liquid_day_8", "MINI CHIP", "liquid", "day"],
    ["date_liquid_week_1", "FLUID DROPS", "liquid", "week"],
    ["date_liquid_week_2", "GLASS ARC", "liquid", "week"],
    ["date_liquid_week_3", "NODES TRACK", "liquid", "week"],
    ["date_liquid_week_4", "3-DAY FOCUS", "liquid", "week"],
    ["date_liquid_week_5", "FLUID EQ", "liquid", "week"],
    ["date_liquid_week_6", "SEGMENT 7", "liquid", "week"],
    ["date_liquid_week_7", "SPLIT WEEK", "liquid", "week"],
    ["date_liquid_week_8", "WAVE CADENCE", "liquid", "week"],
    ["date_liquid_month_1", "MONTH METER", "liquid", "month"],
    ["date_liquid_month_2", "GLASS MATRIX", "liquid", "month"],
    ["date_liquid_month_3", "ORBIT DIAL", "liquid", "month"],
    ["date_liquid_month_4", "QUARTER Q3", "liquid", "month"],
    ["date_liquid_month_5", "RATIO SPLIT", "liquid", "month"],
    ["date_liquid_month_6", "31 SPHERES", "liquid", "month"],
    ["date_liquid_month_7", "DESK TEAR", "liquid", "month"],
    ["date_liquid_month_8", "12 MONTHS", "liquid", "month"],
    ["date_terminal_day_1", "root@sh:~# date", "terminal", "day"],
    ["date_terminal_day_2", "SYS_TIME.BIN", "terminal", "day"],
    ["date_terminal_day_3", "EPOCH_WATCH", "terminal", "day"],
    ["date_terminal_day_4", "CAL_PEEK", "terminal", "day"],
    ["date_terminal_day_5", "RADIAL_HEX", "terminal", "day"],
    ["date_terminal_day_6", "BANNER_D", "terminal", "day"],
    ["date_terminal_day_7", "DAY_ARC", "terminal", "day"],
    ["date_terminal_day_8", "MINI_TTY", "terminal", "day"],
    ["date_terminal_week_1", "cal -w 30", "terminal", "week"],
    ["date_terminal_week_2", "WEEK_GAUGE", "terminal", "week"],
    ["date_terminal_week_3", "LOG_3DAY", "terminal", "week"],
    ["date_terminal_week_4", "WORK_BITS", "terminal", "week"],
    ["date_terminal_week_5", "EQ_BARS", "terminal", "week"],
    ["date_terminal_week_6", "DOT_CHAIN", "terminal", "week"],
    ["date_terminal_week_7", "STEPPER_W", "terminal", "week"],
    ["date_terminal_week_8", "CADENCE_W", "terminal", "week"],
    ["date_terminal_month_1", "cal -m 07 2026", "terminal", "month"],
    ["date_terminal_month_2", "MATRIX_CAL", "terminal", "month"],
    ["date_terminal_month_3", "MEM_MAP", "terminal", "month"],
    ["date_terminal_month_4", "UNAME_CAL", "terminal", "month"],
    ["date_terminal_month_5", "RATIO_CAL", "terminal", "month"],
    ["date_terminal_month_6", "BUF_31", "terminal", "month"],
    ["date_terminal_month_7", "RADIAL_M", "terminal", "month"],
    ["date_terminal_month_8", "YEAR_ARR", "terminal", "month"],
    ["date_eink_day_1", "Thursday", "eink", "day"],
    ["date_eink_day_2", "Chapter VII", "eink", "day"],
    ["date_eink_day_3", "Calendar", "eink", "day"],
    ["date_eink_day_4", "Bookmark", "eink", "day"],
    ["date_eink_day_5", "Compass", "eink", "day"],
    ["date_eink_day_6", "Newspaper", "eink", "day"],
    ["date_eink_day_7", "Daylight", "eink", "day"],
    ["date_eink_day_8", "Mini Chip", "eink", "day"],
    ["date_eink_week_1", "Week 30", "eink", "week"],
    ["date_eink_week_2", "Rhythm", "eink", "week"],
    ["date_eink_week_3", "Workdays", "eink", "week"],
    ["date_eink_week_4", "Chronicle", "eink", "week"],
    ["date_eink_week_5", "Day Scale", "eink", "week"],
    ["date_eink_week_6", "Chain 7", "eink", "week"],
    ["date_eink_week_7", "Seven Days", "eink", "week"],
    ["date_eink_week_8", "Book Rhythm", "eink", "week"],
    ["date_eink_month_1", "July 2026", "eink", "month"],
    ["date_eink_month_2", "Month Grid", "eink", "month"],
    ["date_eink_month_3", "Month Balance", "eink", "month"],
    ["date_eink_month_4", "Year Tracker", "eink", "month"],
    ["date_eink_month_5", "31 Dots", "eink", "month"],
    ["date_eink_month_6", "Month Circle", "eink", "month"],
    ["date_eink_month_7", "Calendar Sheet", "eink", "month"],
    ["date_eink_month_8", "Quarter", "eink", "month"]
  ];
  var designs = Object.freeze(sourceDesigns.map(function (design) {
    var id = design[0], style = design[2], period = design[3];
    var styleLabel = styles.find(function (entry) { return entry.id === style; }).label;
    return Object.freeze({id:id,name:design[1],author:'Date Studio',kind:'concept',tab:'widgets',
      category:'time',style:style,period:period,
      description:'Static '+ period +' date artwork in '+ styleLabel +' style. The date shown is part of the design; this is not a live widget.',
      preview:'addon/store-previews/'+id+'.webp',thumb:'addon/store-previews/'+id+'-thumb.webp'});
  }));
  var items = Object.freeze(styles.filter(function (style) { return style.id !== 'all'; }).map(function (style) {
    var id = 'date_' + style.id + '_stack';
    return Object.freeze({id:id,sku:id,name:style.label + ' Date Stack',style:style.id,
      author:'Date Studio',kind:'concept-stack',tab:'widgets',category:'time',price:.99,status:'available',designCount:24,
      description:'A collection of static date concepts. Each design is artwork, with the date fixed as shown.',
      preview:'addon/store-previews/'+id+'.webp',thumb:'addon/store-previews/'+id+'-thumb.webp'});
  }));
  function filterItems(styleId, periodId) {
    if (!styles.some(function (style) { return style.id === styleId; }) ||
        !periods.some(function (period) { return period.id === periodId; })) return [];
    return designs.filter(function (item) {
      return (styleId === 'all' || item.style === styleId) && (periodId === 'all' || item.period === periodId);
    });
  }
  var api = Object.freeze({designs:designs,items:items,styles:styles,periods:periods,filterItems:filterItems});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HearthDateConcepts = api;
})(typeof window !== 'undefined' ? window : null);
