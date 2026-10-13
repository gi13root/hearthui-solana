/* QA-only Chrome adapter. In-memory state; no production storage, signer, or purchase messages. */
(function(){
  'use strict';
  var params = new URLSearchParams(location.search), mode = params.get('qa') || 'chain';
  var data = {}, listeners = [], writes = [], actions = [];
  var wallet = 'CxFm2rFCZfDE5XgWQUPgeyns4ZJ9zj3HkSLVGD4kHZ8L'; // public devnet buyer with three existing pass receipts
  if (mode !== 'disconnected') data['hearth.solana.session'] = {address:wallet,jwt:null,network:'devnet'};
  if (mode === 'cached' || mode === 'offline') data['hearth.solana.owned'] = {skus:['theme_aurora'],items:[{sku:'theme_aurora',source:'pass',verified:'onchain'}]};
  function read(keys){if(keys===null)return Object.assign({},data); var out={};(Array.isArray(keys)?keys:[keys]).forEach(function(k){if(k in data)out[k]=data[k];});return out;}
  function set(obj,cb){var changes={};Object.keys(obj).forEach(function(k){changes[k]={oldValue:data[k],newValue:obj[k]};data[k]=obj[k];});writes.push(Object.keys(obj));document.documentElement.dataset.qaWrites=JSON.stringify(writes);document.documentElement.dataset.qaApplied=JSON.stringify(data['hearth.solana.applied']||null);listeners.forEach(function(fn){fn(changes,'local');});if(cb)queueMicrotask(cb);return Promise.resolve();}
  window.chrome = {storage:{local:{get:function(keys,cb){var out=read(keys);if(cb){if(mode==='slow' && [].concat(keys).some(function(k){return /^hearth\.solana\./.test(k);}))setTimeout(function(){cb(out);},1200);else queueMicrotask(function(){cb(out);});}return Promise.resolve(out);},set:set,remove:function(keys,cb){var ch={};(Array.isArray(keys)?keys:[keys]).forEach(function(k){ch[k]={oldValue:data[k]};delete data[k];});listeners.forEach(function(fn){fn(ch,'local');});if(cb)queueMicrotask(cb);return Promise.resolve();}},onChanged:{addListener:function(fn){listeners.push(fn);},removeListener:function(fn){listeners=listeners.filter(function(x){return x!==fn;});}}},runtime:{getURL:function(p){return new URL(p,location.href).href;},getManifest:function(){return {version:'QA',manifest_version:3};},onMessageExternal:{addListener:function(){}}},tabs:{create:function(o,cb){actions.push(o.url);document.getElementById('qa-actions').textContent='Navigation requested: '+o.url;if(cb)queueMicrotask(cb);}}};
  window.__STORE_QA__={data:data,writes:writes,actions:actions};
  var realFetch=window.fetch.bind(window);
  window.fetch=function(url,opts){if(mode==='offline' && String(url).includes('api.devnet.solana.com'))return Promise.reject(Error('QA offline RPC'));return realFetch(url,opts);};
  window.addEventListener('keydown',function(e){if(e.altKey && e.shiftKey && e.key.toLowerCase()==='r'){mode='cached';document.documentElement.dataset.qaRpcRestored='true';e.preventDefault();}});
  document.addEventListener('DOMContentLoaded',function(){
    if(mode==='widget-add-error')window.addWidget=function(){throw Error('QA widget creation failure');};
    var bar=document.createElement('aside');bar.id='qa-controls';bar.style.cssText='position:fixed;left:12px;bottom:12px;z-index:2147482999;display:flex;gap:8px;padding:8px;border-radius:12px;background:#18251eee;color:white;font:12px system-ui';
    function btn(label,fn){var b=document.createElement('button');b.textContent=label;b.type='button';b.style.cssText='padding:7px 10px;color:white;background:#ffffff16;border:1px solid #ffffff40;border-radius:8px';b.onclick=fn;bar.append(b);return b;}
    var badge=document.createElement('span');badge.textContent='Local QA · '+mode;bar.append(badge);
    btn('Open Hearth Store',function(){HearthStoreGallery.open(this);});
    btn('Store widget',function(){var widget=createHearthStoreWidget();widget.update(3,3);widget.el.style.cssText='position:fixed;right:22px;top:120px;width:310px;height:280px;background:#18251ecc;border-radius:22px;z-index:40';document.body.append(widget.el);});
    btn('Capture desktop',function(){bar.hidden=true;});
    if(mode==='offline')btn('Restore RPC',function(){mode='cached';badge.textContent='Local QA · cached · RPC restored';});
    var out=document.createElement('span');out.id='qa-actions';bar.append(out);document.body.append(bar);
    var capture=params.get('capture');
    if(capture){
      bar.hidden=true;
      setTimeout(function(){document.body.dataset.qaCaptureReady='true';},1800);
      if(capture.indexOf('widget_')===0){
        (async function(){
          var type=capture.slice(7), item=HearthStoreWidgets.getItems().find(function(it){return it.widgetType===type;});
          if(!item || !await WidgetRegistry.load(type))throw Error('Widget unavailable: '+type);
          var stage=document.createElement('div');stage.id='qa-widget-stage';stage.style.cssText='position:fixed;inset:0;z-index:2147482900;display:grid;place-content:center;gap:24px;background:radial-gradient(ellipse at 25% 20%,#426c70,#12232d 70%);';
          var label=document.createElement('h1');label.textContent=item.name;label.style.cssText='font:500 26px system-ui;color:#eff9f6;margin:0;text-align:center;letter-spacing:-.02em';stage.append(label);
          var config={_persistConfig:function(){return Promise.resolve();}};
          if(type==='pin'){config.skin='surface';config.title='Make room for focus';config.body='One thought, always visible.\nChoose one small thing to finish today.';}
          var instance=WidgetRegistry.create(type,config), frame=document.createElement('div');frame.className='glass-card';frame.style.cssText='position:relative;width:640px;height:400px;padding:22px;border-radius:32px;overflow:hidden;border:1px solid #ffffff32;background:#ffffff0b;box-shadow:0 30px 80px #0004;';
          instance.el.classList.add('widget-content');frame.append(instance.el);stage.append(frame);document.body.append(stage);
          var spec=WidgetRegistry.WIDGET_SIZES[type], size=spec&&spec.preferred||[3,3];if(instance.update)instance.update(size[0],size[1]);
          setTimeout(function(){stage.dataset.ready='true';},1200);
        })().catch(function(error){document.body.dataset.qaWidgetError=error.message;var message=document.createElement('p');message.textContent=error.message;document.body.append(message);});
      }
      var classes={theme_aurora:['hs-theme-aurora'],theme_dune:['hs-theme-dune'],theme_midnight:['hs-theme-midnight'],icons_glass:['hs-icons-glass'],icons_mono:['hs-icons-mono'],clock_orbit:['hs-clock-orbit'],bundle_focus:['hs-theme-aurora','hs-icons-glass','hs-clock-orbit'],supporter:['hs-theme-midnight']};
      (classes[capture]||[]).forEach(function(c){document.documentElement.classList.add(c);});
      if(capture.indexOf('theme_')===0 || capture==='bundle_focus' || capture==='supporter'){
        var layer=document.createElement('div');layer.id='hs-theme-layer';layer.setAttribute('aria-hidden','true');document.body.append(layer);
      }
      var sources={half_dome:'assets/wallpapers/themes/half-dome.avif',astronaut:'assets/wallpapers/themes/astronaut.avif',green:'assets/wallpapers/themes/green.avif',yosemite_depth:'assets/wallpapers/depth-yosemite/yosemite-base.avif'};
      var packs={landscapes_pack:['landscapes/desert-sunset.webp','landscapes/coast-waves.webp','landscapes/rice-terraces-aerial.webp'],flora_fauna_pack:['flora-fauna/bougainvillea-wall.webp','flora-fauna/chameleon.webp','flora-fauna/dew-lotus-leaf.webp'],space_abstract_pack:['space-abstract/jupiter.webp','space-abstract/solar-prominence.webp','space-abstract/pearl-fluid-wave.webp']};
      if(sources[capture] || packs[capture] || capture==='deep_sea'){
        var art=document.createElement('div');art.id='qa-preview-art';art.style.cssText='position:fixed;inset:0;z-index:2147482900;display:flex;background:linear-gradient(135deg,#031b2f,#07566b,#00111c)';
        (packs[capture]||[sources[capture]]).filter(Boolean).forEach(function(p){var img=document.createElement('img');img.src=packs[capture]?'assets/wallpapers/thumbs/'+p:p;img.style.cssText='width:0;flex:1;min-width:0;height:100%;object-fit:cover';art.append(img);});document.body.append(art);
      }
      if(capture==='icons_glass'||capture==='icons_mono'||capture==='clock_orbit'||capture==='retro_flip'){
        setTimeout(function(){
          var stage=document.createElement('div');stage.id='qa-preview-stage';stage.style.cssText='position:fixed;inset:0;z-index:2147482900;display:grid;place-content:center;background:radial-gradient(ellipse at 30% 20%,#486b71,#11202f 70%);gap:32px';
          if(capture.indexOf('icons_')===0){
            var grid=document.createElement('div');grid.className='appgrid-wrap';grid.style.cssText='display:grid;grid-template-columns:repeat(3,180px);gap:32px';
            Array.from(document.querySelectorAll('.appgrid-app-item')).slice(0,6).forEach(function(node){var tile=node.cloneNode(true);tile.style.cssText='width:180px;height:180px;display:grid;place-items:center;background:#ffffff0b;border:1px solid #ffffff25;border-radius:32px;font-size:20px';grid.append(tile);});stage.append(grid);
          }else{
            var clock=document.querySelector('.clk-widget');if(clock){var copy=clock.cloneNode(true);copy.style.cssText='width:640px;height:340px;position:relative;background:#ffffff0c;border:1px solid #ffffff25;border-radius:36px';stage.append(copy);}
          }
          document.body.append(stage);
        },800);
      }
    }
    if(mode==='offline') HearthSolana.refreshOwned();
  });
})();
