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
    return function () { doc.removeEventListener('contextmenu', onContext); };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { installStoreEntry: installStoreEntry };
  if (!root || !root.document || root.__hearthStoreEntryInstalled) return;
  root.__hearthStoreEntryInstalled = true;
  installStoreEntry({ document: root.document, menu: root.showCtxMenu, open: function (source) {
    if (root.HearthStoreGallery) root.HearthStoreGallery.open(source);
  }, schedule: function (fn) { root.setTimeout(fn, 0); } });
})(typeof window !== 'undefined' ? window : null);
