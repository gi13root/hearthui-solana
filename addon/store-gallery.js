/* Hearth Store gallery. Ownership and persistence remain with the session/store adapters. */
(function (root) {
  'use strict';
  function createTrial(adapter) {
    var active = null;
    function revert() {
      if (!active) return;
      Object.keys(active.next).forEach(function (slot) {
        if (adapter.read(slot) === active.next[slot]) adapter.write(slot, active.before[slot]);
      });
      active = null;
    }
    return {
      start: function (next, now) {
        revert(); var before = {};
        Object.keys(next).forEach(function (slot) { before[slot] = adapter.read(slot); adapter.write(slot, next[slot]); });
        active = { before: before, next: Object.assign({}, next), deadline: now + 30000 };
      },
      revert: revert,
      release: function (slot) { if(active) { delete active.next[slot]; delete active.before[slot]; } },
      remaining: function (now) { return active ? Math.max(0, Math.ceil((active.deadline - now) / 1000)) : 0; },
      active: function () { return !!active; }
    };
  }
  function receiptUrl(kind, value) {
    if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) return null;
    if (kind === 'address' && (value.length < 32 || value.length > 44)) return null;
    if (kind === 'tx' && (value.length < 64 || value.length > 88)) return null;
    if (kind !== 'address' && kind !== 'tx') return null;
    return 'https://explorer.solana.com/' + kind + '/' + value + '?cluster=devnet';
  }
  function nextItem(list, id, delta) {
    if (!list.length) return null;
    var index=list.findIndex(function(item){return item.id===id;});
    return list[index<0?0:(index+delta+list.length)%list.length];
  }
  function createWidgetAdder(opts) {
    var pending=new Map(),epoch=0;
    function add(item) {
      var known=opts.items().find(function(entry){return entry.kind==='widget' && entry.status==='included' && entry.id===item.id && entry.widgetType===item.widgetType;});
      if(!known)return Promise.resolve(false);
      if(pending.has(known.widgetType))return pending.get(known.widgetType);
      var token=epoch,adding=false;
      var operation=(async function(){
        try {
          var ready=await opts.load(known.widgetType);
          if(token!==epoch || (opts.isActive && !opts.isActive()))return false;
          if(ready!==true)throw new Error('Widget is not ready');
          adding=true;opts.close();await opts.add(known.widgetType);return true;
        }catch(error){if(opts.onError && (adding || (token===epoch && (!opts.isActive || opts.isActive()))))opts.onError(error,known,adding?'add':'load');return false;}
        finally{if(pending.get(known.widgetType)===operation)pending.delete(known.widgetType);}
      })();
      pending.set(known.widgetType,operation);return operation;
    }
    add.invalidate=function(){epoch++;pending.clear();};
    return add;
  }
  function resolveOpener(source, container) {
    if(source && source.isConnected)return source;
    if(container && container.isConnected){var replacement=container.querySelector('[data-store-gallery]');if(replacement && replacement.isConnected)return replacement;}
    return null;
  }
  function findFocusTarget(nodes, key) {
    var visible=Array.from(nodes).filter(function(node){return !node.disabled && !node.closest('[hidden]');});
    function find(value){return visible.find(function(node){return node.dataset.focusKey===value;}) || null;}
    return find(key) || (key.indexOf('action:')===0?find('preview:'+key.slice(7)):key==='viewer-primary'?find('← Back'):null);
  }
  function createLoadCoordinator(opts) {
    var epoch=0;
    async function load(refresh) {
      var token=++epoch, api=opts.api();
      function current(){return token===epoch;}
      function snapshot(values){if(current()) opts.onSnapshot({owned:values[0],session:values[1],error:api && api.lastError?api.lastError():null});}
      try {
        var values=await Promise.all([api && api.getOwned?api.getOwned():[],api && api.getSession?api.getSession():null]);
        snapshot(values);
        if(!current()) return;
        if(refresh && api && api.refreshOwned){var verified=await api.refreshOwned();snapshot([verified,values[1]]);}
      }catch(error){if(current() && opts.onError)opts.onError(error);}
    }
    return {load:load,invalidate:function(){epoch++;}};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createTrial: createTrial, receiptUrl: receiptUrl, nextItem: nextItem, createLoadCoordinator: createLoadCoordinator, findFocusTarget: findFocusTarget, resolveOpener: resolveOpener, createWidgetAdder: createWidgetAdder };
  if (!root || typeof document === 'undefined') return;
  var dialog, panel, grid, tabs, subtabs, footer, errorBox, count, viewer, banner, toast;
  var widgetCategory='all',widgetPending=null,datePeriod='all',selectedDesign=null;
  var tab = 'featured', selected = null, opener = null, openerContainer = null, viewerOpener = null;
  var owned = [], session = null, loading = true, timer = null, toastTimer;
  var trialItem = null, previewApplied = null, previousLayerHidden = null;
  var slotClasses = { theme: ['hs-theme-aurora','hs-theme-dune','hs-theme-midnight'], icons: ['hs-icons-glass','hs-icons-mono'], clock: ['hs-clock-orbit'] };
  function classFor(sku) { return 'hs-' + sku.replace('_','-'); }
  function readSlot(slot) { return slotClasses[slot].filter(function (c) { return document.documentElement.classList.contains(c); }).join(' '); }
  var trial = createTrial({ read: readSlot, write: function (slot, value) {
    slotClasses[slot].forEach(function (c) { document.documentElement.classList.toggle(c, value.split(' ').indexOf(c) !== -1); });
    if (slot === 'theme') syncLayer();
  }});
  var trialCreatedLayer = false;
  function syncLayer() {
    var layer = document.getElementById('hs-theme-layer');
    if (readSlot('theme') && !layer) { layer = document.createElement('div'); layer.id = 'hs-theme-layer'; layer.setAttribute('aria-hidden','true'); document.body.append(layer); trialCreatedLayer = true; }
    if (layer) layer.hidden = !readSlot('theme');
  }
  function catalog() { return root.HearthStoreCatalog; }
  function el(tag, cls, text) { var node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; }
  function button(text, action, cls) { var b = el('button', cls || 'hsg-button', text); b.type = 'button'; b.dataset.focusKey=text; b.addEventListener('click', action); return b; }
  function focus(node) { if (node && node.isConnected && typeof node.focus === 'function') node.focus({preventScroll:true}); }
  function applied() { return root.HearthStore ? root.HearthStore.state().effective : {}; }
  function state(item) { return catalog().cardState(item, owned, applied()); }
  function stateName(item) { var s = state(item); return typeof s === 'string' ? s : s.state || s.status; }
  function items() {
    if(tab==='bundles')return (catalog()?catalog().filterItems(tab):[]).concat(root.HearthDateConcepts?root.HearthDateConcepts.items:[]); // date stacks are 24-design bundles
    if(tab!=='widgets')return catalog()?catalog().filterItems(tab):[];
    var dates=root.HearthDateConcepts;
    if(widgetCategory==='date')return dates?dates.items:[];
    var included=root.HearthStoreWidgets?root.HearthStoreWidgets.filterItems(widgetCategory):[];
    return (widgetCategory==='all'||widgetCategory==='time') && dates?included.concat(dates.items):included;
  }
  var widgetAdder=createWidgetAdder({items:function(){return root.HearthStoreWidgets?root.HearthStoreWidgets.getItems():[];},
    load:function(type){if(!root.WidgetRegistry || typeof root.WidgetRegistry.load!=='function')return false;return root.WidgetRegistry.load(type);},
    isActive:function(){return !!(dialog && dialog.open);},close:close,
    add:function(type){if(typeof root.addWidget!=='function')throw new Error('Widget adding unavailable');return root.addWidget(type);},
    onError:function(error,item,phase){
      var message=(phase==='add'?'Couldn’t add ':'Couldn’t load ')+item.name+' · Try again';
      if(dialog && dialog.open)announce(message);
      else if(typeof root.showSnackbar==='function')root.showSnackbar(message);
    }});
  function announce(text, receiptItem) {
    toast.replaceChildren(el('span','',text));
    if (receiptItem) toast.append(button('View receipt ↗', function () { viewReceipt(receiptItem); }));
    toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden=true; },7000);
  }
  function ensure() {
    if (dialog) return;
    dialog = el('dialog','hsg-dialog'); dialog.id = 'hearth-store-gallery'; dialog.setAttribute('aria-labelledby','hsg-title');
    panel = el('section','hsg-panel');
    var head = el('header','hsg-head'), title = el('h2','','Hearth Store'); title.id = 'hsg-title';
    var titleWrap = el('div','hsg-heading'); titleWrap.append(el('span','hsg-shop','▧'),title);
    var demo = el('span','hsg-info','ⓘ'); demo.title='Demo catalog on Solana devnet'; demo.tabIndex=0; titleWrap.append(demo);
    count = el('span','hsg-count');
    var closeButton=button('×',close,'hsg-close'); closeButton.setAttribute('aria-label','Close Hearth Store');
    head.append(titleWrap,count,closeButton);
    tabs = el('nav','hsg-tabs'); tabs.setAttribute('aria-label','Store categories');
    subtabs=el('nav','hsg-subtabs');subtabs.setAttribute('aria-label','Widget categories');subtabs.hidden=true;
    errorBox = el('div','hsg-error'); errorBox.hidden=true; errorBox.setAttribute('role','status');
    grid = el('div','hsg-grid'); grid.id='hsg-items'; grid.setAttribute('role','region'); grid.setAttribute('aria-label','Store items');
    footer=el('footer','hsg-footer'); viewer=el('section','hsg-viewer'); viewer.hidden=true; viewer.setAttribute('aria-label','Item details');
    toast=el('div','hsg-toast'); toast.hidden=true; toast.setAttribute('role','status');
    panel.append(head,tabs,subtabs,errorBox,grid,footer); dialog.append(panel,viewer,toast); document.body.append(dialog);
    banner=el('aside','hsg-preview-banner'); banner.hidden=true; banner.setAttribute('aria-label','Store preview'); document.body.append(banner);
    root.addEventListener('keydown',function(e){if(trial.active() && e.key==='Escape'){e.preventDefault();revert(true);}});
    dialog.addEventListener('cancel',function(e){ e.preventDefault(); if(selected) leaveViewer(); else close(); });
    dialog.addEventListener('click',function(e){ if(e.target===dialog) close(); });
    dialog.addEventListener('keydown',function(e){
      if(e.defaultPrevented || (e.target && (e.target.isContentEditable || ['INPUT','SELECT','TEXTAREA'].indexOf(e.target.tagName)!==-1)))return;
      if(selected && (e.key==='ArrowLeft'||e.key==='ArrowRight')) { e.preventDefault(); navigate(e.key==='ArrowLeft'?-1:1); }
    });
    if(root.HearthSolana && root.HearthSolana.onChange) root.HearthSolana.onChange(function(kind){ if(kind==='error') showError(); load(false); });
    if(root.chrome && root.chrome.storage && root.chrome.storage.onChanged) root.chrome.storage.onChanged.addListener(function(ch,area){
      if(area!=='local') return;
      if(ch['hearth.solana.owned']||ch['hearth.solana.session']) {load(false);}
      if(ch['hearth.solana.applied']) { if(trial.active()) revert(false); render(); }
    });
    if(root.HearthStore && root.HearthStore.subscribe) root.HearthStore.subscribe(function(s){
      if(trial.active()) {Object.keys(slotClasses).forEach(function(slot){if(previewApplied && s.applied[slot]!==previewApplied[slot]) trial.release(slot);});revert(true);} if(dialog.open) render();
    });
  }
  function showError() {
    errorBox.replaceChildren(el('span','','Can’t reach Solana devnet'));
    errorBox.append(button('Retry',function(){ load(true); })); errorBox.hidden=false;
  }
  var loader=createLoadCoordinator({api:function(){return root.HearthSolana;},onSnapshot:function(snapshot){
    updateOwned(snapshot.owned);session=snapshot.session;loading=false;
    if(snapshot.error)showError();else errorBox.hidden=true;
    render();
  },onError:function(){loading=false;showError();render();}});
  function load(refresh){return loader.load(refresh);}
  function updateOwned(next) {
    var c=catalog(); var previous=c ? c.expandOwned(owned):[]; owned=next;
    if(!c || loading) return;
    var now=c.expandOwned(owned);
    c.items.forEach(function(item){ if(item.sku && now.indexOf(item.sku)!==-1 && previous.indexOf(item.sku)===-1){
      announce(item.name+' unlocked',item);
      requestAnimationFrame(function(){ var card=grid.querySelector('[data-item="'+item.id+'"]');if(card) card.classList.add('hsg-unlocked'); });
    }});
  }
  function image(item,large) {
    var pic=el('div','hsg-picture hsg-kind-'+item.kind); pic.dataset.preview=item.id;
    var img=el('img'); img.alt=item.name+' preview'; img.loading=large?'eager':'lazy';
    img.src=large?item.preview:item.thumb; img.addEventListener('error',function(){img.remove();pic.classList.add('hsg-fallback');});
    pic.append(img,el('span','hsg-preview-name',item.name));
    if(item.kind==='live') pic.append(el('span','hsg-play','▶'));
    return pic;
  }
  function actionLabel(item,detail) {
    if(item.kind==='widget')return widgetPending===item.id?'Adding…':'Add widget';
    var s=stateName(item);
    if(item.kind==='concept-stack')return s==='owned'?'Owned ✓':'Buy '+catalog().formatPrice(item);
    if(s==='applied') return 'Applied'; if(s==='owned') return detail && canApply(item)?'Apply':'Owned ✓';
    if(s==='soon') return 'Soon'; if(s==='included') return 'Included';
    return (detail?'Buy ':'')+catalog().formatPrice(item);
  }
  function canApply(item) { return ['theme','icons','clock','bundle'].indexOf(item.kind)!==-1; }
  async function action(item) {
    if(item.kind==='widget'){widgetPending=item.id;render();await widgetAdder(item);widgetPending=null;if(dialog.open)render();return;}
    var s=stateName(item); if(s==='soon'||s==='applied'||s==='included') return;
    if(s==='owned') {
      if(!canApply(item)) return;
      revert(false);
      var grants=item.kind==='bundle'?item.includes:[item.sku];
      try {
        for(var sku of grants){var it=catalog().items.find(function(x){return x.sku===sku;});if(!it || !root.HearthStore || !await root.HearthStore.apply(sku,it.kind)){announce('Couldn’t apply this item · Try again');render();return;}}
        render();
      }catch(error){announce('Couldn’t apply this item · Try again');}
      return;
    }
    try {
      if(!root.HearthSolana) {announce('Wallet connection is unavailable');return;}
      if(item.kind==='concept-stack')root.HearthSolana.openBridge('buy',item.sku);
      else if(!session || !session.address) root.HearthSolana.openBridge('signin');
      else root.HearthSolana.openBridge(root.HearthPass && root.HearthPass.methodFor(item.sku)==='pass'?'buy':'pay',item.sku);
    } catch(e) {announce('This item is not available yet');}
  }
  function supporterReceipt(item) {
    var entries=Array.isArray(owned)?owned:owned && owned.items||[];
    var entitlement=entries.find(function(entry){return entry && entry.sku===item.sku;});
    return entitlement && receiptUrl('tx',entitlement.tx_signature);
  }
  function renderSupporter(item) {
    var current=stateName(item),active=current==='owned'||current==='applied';
    var offer=root.HearthSupporter.supporterOffer({item:item,state:current,connected:!!(session && session.address),hasReceipt:!!supporterReceipt(item)});
    var presentation=el('section','hsg-supporter');presentation.setAttribute('aria-labelledby','hsg-supporter-title');
    var hero=el('header','hsg-supporter-hero'),heading=el('h3','','Make HearthUI yours.\nHelp it grow.');
    heading.id='hsg-supporter-title';heading.tabIndex=-1;heading.dataset.focusKey='supporter-heading';
    hero.append(heading,el('p','','A one-time contribution to the desktop you use every day. Here’s what being a Supporter brings.'));
    var benefits=el('div','hsg-supporter-benefits');
    [
      ['Supporter badge',active?'Your Supporter badge is active on your desktop.':'A visible badge on your desktop, included when Supporter launches.'],
      ['Exclusive theme', 'A theme just for supporters is planned for a future release.'],
      ['One-time support','A single USDC contribution. No subscription or recurring payments.'],
      ['Transaction receipt','View your confirmed contribution on Solana Explorer.']
    ].forEach(function(benefit,index){
      var block=el('div','hsg-supporter-benefit'),title=el('h4','',benefit[0]);
      if(index===1)title.append(el('span','hsg-supporter-planned',' Planned'));
      block.append(title,el('p','',benefit[1]));benefits.append(block);
    });
    var included=el('section','hsg-supporter-included'),includedCopy=el('div');
    var widgetCount=root.HearthStoreWidgets?root.HearthStoreWidgets.getItems().length:null;
    includedCopy.append(el('h4','','Your everyday toolkit stays free'),el('p','',(widgetCount?'All '+widgetCount+' currently available widgets':'The currently available widgets')+' — including clocks, timers, tasks, and calendars — are already included with HearthUI.'));
    var explore=button('Explore included widgets',function(){widgetAdder.invalidate();widgetPending=null;tab='widgets';widgetCategory='all';selected=null;render();grid.scrollTop=0;focus(tabs.querySelector('[aria-current="page"]'));},'hsg-supporter-explore');
    explore.dataset.focusKey='supporter-widgets';included.append(includedCopy,explore);
    var contribution=el('section','hsg-supporter-contribution'),details=el('div','hsg-supporter-terms');
    details.append(el('h4','',active?'Thank you for supporting HearthUI':'One-time contribution'));
    if(!active)details.append(el('p','hsg-supporter-price',offer.price));
    details.append(el('p','hsg-supporter-status',active?'Your Supporter status is active.':offer.enabled?'Support HearthUI with a one-time payment on Solana devnet.':'Supporter payments are not available yet in this Solana devnet demo.'));
    var primary=button(offer.label,function(){
      var latest=root.HearthSupporter.supporterOffer({item:item,state:stateName(item),connected:!!(session && session.address),hasReceipt:!!supporterReceipt(item)});
      if(!latest.enabled)return;
      if(latest.action==='receipt')viewReceipt(item);else action(item);
    },'hsg-button'+(offer.enabled?' hsg-primary':''));
    primary.dataset.focusKey='supporter-primary';primary.disabled=!offer.enabled;contribution.append(details,primary);
    presentation.append(hero,benefits,included,contribution);grid.append(presentation);
  }
  function render() {
    if(!dialog) return;
    var focusKey=dialog.contains(document.activeElement)?document.activeElement.dataset.focusKey:null;
    var c=catalog();
    if(!c) {grid.replaceChildren(el('p','hsg-empty','Loading the store…'));return;}
    var n=c.ownedCount(owned); count.textContent=n.owned+'/'+n.total+' owned';
    tabs.replaceChildren();
    c.tabs.forEach(function(t){var b=button(t.icon+' '+t.label,function(){widgetAdder.invalidate();widgetPending=null;tab=t.id;selected=null;viewer.hidden=true;panel.hidden=false;render();if(tab==='supporter')grid.scrollTop=0;focus(tabs.querySelector('[aria-current="page"]'));},'hsg-tab');b.dataset.focusKey='tab:'+t.id;b.setAttribute('aria-current',t.id===tab?'page':'false');b.setAttribute('aria-controls','hsg-items');tabs.append(b);});
    subtabs.hidden=tab!=='widgets';subtabs.replaceChildren();
    if(tab==='widgets' && root.HearthStoreWidgets)root.HearthStoreWidgets.categories.forEach(function(category){
      var b=button((category.icon?category.icon+' ':'')+category.label,function(){widgetAdder.invalidate();widgetPending=null;widgetCategory=category.id;selected=null;viewer.hidden=true;panel.hidden=false;render();focus(subtabs.querySelector('[aria-current="page"]'));},'hsg-subtab');
      b.dataset.widgetCategory=category.id;b.dataset.focusKey='widget-category:'+category.id;b.setAttribute('aria-current',category.id===widgetCategory?'page':'false');b.setAttribute('aria-controls','hsg-items');subtabs.append(b);
    });
    var presentation=tab==='supporter' && !loading && !!root.HearthSupporter;
    grid.classList.toggle('hsg-presentation',presentation);grid.setAttribute('aria-label',presentation?'Supporter benefits':'Store items');
    grid.replaceChildren(); grid.setAttribute('aria-busy',String(loading && tab!=='widgets'));
    if(loading && tab!=='widgets') {for(var i=0;i<6;i++) grid.append(el('div','hsg-skeleton'));}
    else if(presentation)renderSupporter(c.filterItems('supporter')[0]);
    else items().forEach(function(item){
      var card=el('article','hsg-card'); card.dataset.item=item.id; card.dataset.state=stateName(item);
      var preview=button('',function(){openViewer(item,preview);},'hsg-preview'); preview.dataset.focusKey='preview:'+item.id;preview.setAttribute('aria-label','View '+item.name);preview.append(image(item,false));
      if(stateName(item)==='owned'||stateName(item)==='applied') preview.append(el('span','hsg-owned-mark','✓'));
      var meta=el('div','hsg-meta'), copy=el('div','hsg-copy');var typeIcon={theme:'◈',icons:'▦',clock:'◷',live:'▷','wallpaper-pack':'▧',bundle:'◇',badge:'♡',widget:'▦','concept-stack':'◷'};copy.append(el('h3','',(typeIcon[item.kind]||'')+' '+item.name),el('p','',item.kind==='concept-stack'?item.designCount+' designs · Day / Week / Month':'by '+item.author));
      var buy=button(actionLabel(item,false),function(){action(item);},'hsg-price'); buy.dataset.focusKey='action:'+item.id; buy.disabled=item.kind==='widget'?widgetPending===item.id:(item.kind==='concept-stack' && stateName(item)==='owned')||['soon','applied','included'].indexOf(stateName(item))!==-1;
      if(stateName(item)==='soon') buy.title='Coming soon';
      meta.append(copy,buy);card.append(preview,meta);
      if(item.kind==='bundle') card.append(el('span','hsg-badge','BUNDLE'));
      if(item.kind==='badge') card.append(el('span','hsg-badge','EXCLUSIVE THEME PLANNED'));
      grid.append(card);
    });
    if((!loading || tab==='widgets') && !items().length) grid.append(el('p','hsg-empty','Nothing here yet'));
    footer.replaceChildren();
    var wallet=button(session&&session.address?'◎ USDC · Connected':'Connect wallet',function(){if(root.HearthSolana)root.HearthSolana.openBridge('signin');},'hsg-wallet'); wallet.dataset.connected=String(!!(session && session.address)); footer.append(wallet);
    if(selected) renderViewer();
    if(focusKey)focus(findFocusTarget(dialog.querySelectorAll('[data-focus-key]'),focusKey));
  }
  function openViewer(item,source) {
    if(item.sku==='supporter'){widgetAdder.invalidate();widgetPending=null;tab='supporter';selected=null;viewer.hidden=true;panel.hidden=false;render();grid.scrollTop=0;focus(grid.querySelector('#hsg-supporter-title'));return;}
    selected=item;selectedDesign=null;datePeriod='all';viewerOpener=source;panel.hidden=true;viewer.hidden=false;renderViewer();viewer.scrollTop=0;focus(viewer.querySelector('button'));
  }
  function leaveViewer() {selected=null;viewer.hidden=true;panel.hidden=false;var id=viewerOpener&&viewerOpener.closest('[data-item]')?.dataset.item;focus(id?grid.querySelector('[data-item="'+id+'"] button'):tabs.querySelector('[aria-current="page"]'));}
  function navigate(delta){var next=nextItem(items(),selected.id,delta);if(!next){leaveViewer();return;}openViewer(next,viewerOpener);}
  function renderViewer(){
    var item=selected;viewer.replaceChildren();
    var top=el('div','hsg-viewer-top');top.append(button('← Back',leaveViewer),button('×',close,'hsg-close'));top.lastChild.setAttribute('aria-label','Close Hearth Store');
    var design=item.kind==='concept-stack' && root.HearthDateConcepts.designs.find(function(entry){return entry.id===selectedDesign && entry.style===item.style;});
    var art=image(design || item,true),copy=el('div','hsg-viewer-copy');art.tabIndex=-1;art.dataset.focusKey='selected-design';copy.append(el('h2','',item.name),el('p','','by '+item.author),el('p','hsg-description',item.description));
    if(item.kind==='widget')copy.append(el('span','hsg-included','Included with HearthUI'));
    if(item.kind==='concept-stack')copy.append(el('span','hsg-included','24 static designs · 8 Day, 8 Week, 8 Month'));
    var actions=el('div','hsg-actions');
    if(canApply(item) && item.sku)actions.append(button('Try on',function(){startPreview(item);},'hsg-button'));
    var primary=button(actionLabel(item,true),function(){action(item);},'hsg-button hsg-primary');primary.dataset.focusKey='viewer-primary';primary.disabled=item.kind==='widget'?widgetPending===item.id:(item.kind==='concept-stack' && stateName(item)==='owned')||['soon','applied','included'].indexOf(stateName(item))!==-1;actions.append(primary);
    if(stateName(item)==='owned'||stateName(item)==='applied')actions.append(button('View receipt ↗',function(){viewReceipt(item);}));
    copy.append(actions);var arrows=el('div','hsg-arrows');arrows.append(button('←',function(){navigate(-1);}),button('→',function(){navigate(1);}));arrows.children[0].setAttribute('aria-label','Previous item');arrows.children[1].setAttribute('aria-label','Next item');viewer.append(top,art,copy);
    viewer.classList.toggle('hsg-stack-viewer',item.kind==='concept-stack');
    if(item.kind==='concept-stack'){
      var previews=el('section','hsg-stack-previews'),filters=el('div','hsg-date-filters'),label=el('label','hsg-date-select'),period=el('select');
      previews.setAttribute('aria-label','Stack designs');period.setAttribute('aria-label','Date period');period.dataset.focusKey='date-period';
      root.HearthDateConcepts.periods.forEach(function(choice){var option=el('option','',choice.label);option.value=choice.id;period.append(option);});period.value=datePeriod;
      period.addEventListener('change',function(){if(!root.HearthDateConcepts.periods.some(function(choice){return choice.id===period.value;}))return;datePeriod=period.value;selectedDesign=null;renderViewer();focus(viewer.querySelector('[data-focus-key="date-period"]'));});
      label.append(el('span','','Date type'),period);filters.append(label,el('span','hsg-date-note','Browse designs'));previews.append(filters);
      var samples=el('div','hsg-stack-samples');
      root.HearthDateConcepts.filterItems(item.style,datePeriod).forEach(function(sample){
        var sampleButton=button('',function(){selectedDesign=sample.id;renderViewer();viewer.scrollTop=0;focus(viewer.querySelector('[data-focus-key="selected-design"]'));},'hsg-stack-sample');
        sampleButton.dataset.design=sample.id;sampleButton.dataset.focusKey='design:'+sample.id;sampleButton.setAttribute('aria-label','View '+sample.name);sampleButton.setAttribute('aria-pressed',String(selectedDesign===sample.id));
        var thumb=el('img');thumb.src=sample.thumb;thumb.alt=sample.name;thumb.loading='lazy';sampleButton.append(thumb,el('span','',sample.name));samples.append(sampleButton);
      });
      previews.append(samples);viewer.append(previews);
    }
    viewer.append(arrows);
  }
  async function viewReceipt(item){
    try {
      var entries=Array.isArray(owned)?owned:owned && owned.items||[];
      var entitlement=entries.find(function(x){return x && x.sku===item.sku;});
      var receiptSku=item.sku;
      if(!entitlement) { var bundle=catalog().items.find(function(x){return x.includes && x.includes.indexOf(item.sku)!==-1 && entries.some(function(e){return e && (typeof e==='string'?e:e.sku)===x.sku;});});if(bundle) receiptSku=bundle.sku; }
      var method=root.HearthPass && root.HearthPass.methodFor(receiptSku);
      var url=method!=='pass' && entitlement && receiptUrl('tx',entitlement.tx_signature);
      if(!url && session && root.HearthPass && root.HearthPass.derivePassPda){
        var receipt=await root.HearthPass.derivePassPda(session.address,receiptSku);
        url=receiptUrl('address',typeof receipt==='string'?receipt:Array.isArray(receipt)?String(receipt[0]):String(receipt));
      }
      if(url) {
        if(root.chrome && root.chrome.tabs && typeof root.chrome.tabs.create==='function') {
          root.chrome.tabs.create({url:url},function(){if(root.chrome.runtime && root.chrome.runtime.lastError)announce('Couldn’t open receipt · Try again');});
        }else root.open(url,'_blank','noopener,noreferrer');
      }else announce('Receipt is not available yet');
    }catch(e){announce('Receipt is not available yet');}
  }
  function startPreview(item){
    revert(false);var next={};
    (item.kind==='bundle'?item.includes:[item.sku]).forEach(function(sku){var it=catalog().items.find(function(x){return x.sku===sku;});if(it && slotClasses[it.kind])next[it.kind]=classFor(sku);});
    if(!Object.keys(next).length)return;
    var previousLayer=document.getElementById('hs-theme-layer');previousLayerHidden=previousLayer?previousLayer.hidden:null;
    previewApplied=root.HearthStore?Object.assign({},root.HearthStore.state().applied):null;
    trialItem=item;trial.start(next,Date.now());dialog.close();banner.hidden=false;
    var countdown=el('span');
    var purchase=button(stateName(item)==='owned'?'Apply':stateName(item)==='soon'?'Coming soon':'Buy '+catalog().formatPrice(item),function(){action(item);});purchase.disabled=stateName(item)==='soon';
    banner.replaceChildren(countdown,purchase,button('Revert',function(){revert(true);}));
    function tick(){var seconds=trial.remaining(Date.now());if(!seconds){revert(true);return;}countdown.textContent='Preview · 0:'+String(seconds).padStart(2,'0')+' · '+item.name;}
    tick();timer=setInterval(tick,250);focus(banner.querySelector('button:not(:disabled)'));
  }
  function revert(reopen){
    clearInterval(timer);timer=null;trial.revert();banner.hidden=true;trialItem=null;
    if(trialCreatedLayer){var layer=document.getElementById('hs-theme-layer');if(layer && !readSlot('theme'))layer.remove();trialCreatedLayer=false;}
    else if(previousLayerHidden!==null && !readSlot('theme')) {var originalLayer=document.getElementById('hs-theme-layer');if(originalLayer)originalLayer.hidden=previousLayerHidden;}
    previousLayerHidden=null;previewApplied=null;
    if(reopen){dialog.showModal();render();focus(selected?viewer.querySelector('button'):tabs.querySelector('[aria-current="page"]'));}
  }
  function open(source,opts){ensure();if(opts&&opts.tab){widgetAdder.invalidate();widgetPending=null;tab=opts.tab;selected=null;if(opts.tab==='widgets')widgetCategory='all';viewer.hidden=true;panel.hidden=false;}if(trial.active())revert(false);opener=source || document.activeElement;openerContainer=opener && opener.closest?opener.closest('.hs-store'):null;if(!dialog.open)dialog.showModal();render();focus(tabs.querySelector('[aria-current="page"]'));load(true);}
  function close(){loader.invalidate();widgetAdder.invalidate();widgetPending=null;if(trial.active())revert(false);selected=null;if(dialog){dialog.close();viewer.hidden=true;panel.hidden=false;}focus(resolveOpener(opener,openerContainer));}
  root.HearthStoreGallery={open:open,close:close}; root.openHearthStoreGallery=open;
})(typeof window!=='undefined'?window:null);
