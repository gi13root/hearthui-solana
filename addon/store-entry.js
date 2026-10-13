/* Add a blank-desktop entry through the existing host menu without changing core files. */
(function (root) {
  'use strict';
  function installStoreEntry(deps) {
    var doc = deps.document;
    function onContext(event) {
      if (event.defaultPrevented || !event.target) return;
      var id = event.target.id;
      if (['root', 'widgetCanvas', 'wallpaperCanvas', 'glCanvas', 'wallpaperDim', 'depthForeground', 'particleCanvas'].indexOf(id) < 0 && event.target !== doc.body) return;
      if (typeof deps.menu !== 'function') return;
      var source = doc.activeElement;
      event.preventDefault();
      deps.menu(event.clientX, event.clientY, 'Desktop', [{ icon: '◈', label: 'Hearth Store', action: function () {
        deps.schedule(function () { deps.open(source); });
      } }], source);
    }
    doc.addEventListener('contextmenu', onContext);
    // Dock "Widgets" (⊞) opens the store on its Widgets tab; the host binds its own handler at render, so intercept in capture.
    function onClick(event) {
      var btn = event.target && event.target.closest ? event.target.closest('.dock-btn[data-tip="Widgets"]') : null;
      if (!btn) return;
      event.preventDefault(); event.stopImmediatePropagation();
      deps.schedule(function () { deps.openWidgets(btn); });
    }
    if (typeof deps.openWidgets === 'function') doc.addEventListener('click', onClick, true);
    return function () { doc.removeEventListener('contextmenu', onContext); doc.removeEventListener('click', onClick, true); };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { installStoreEntry: installStoreEntry };
  if (!root || !root.document || root.__hearthStoreEntryInstalled) return;
  root.__hearthStoreEntryInstalled = true;
  installStoreEntry({ document: root.document, menu: root.showCtxMenu, open: function (source) {
    if (root.HearthStoreGallery) root.HearthStoreGallery.open(source);
  }, openWidgets: function (source) {
    if (root.HearthStoreGallery) root.HearthStoreGallery.open(source, { tab: 'widgets' });
  }, schedule: function (fn) { root.setTimeout(fn, 0); } });
})(typeof window !== 'undefined' ? window : null);
