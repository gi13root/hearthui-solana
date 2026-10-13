/* QA capture only: renders a chosen, static card from the user's HTML artwork. */
(async function () {
  'use strict';
  var inventory=await (await fetch('/__qa-date-concepts.json')).json();
  var controls=document.createElement('aside');controls.style.cssText='position:fixed;left:12px;top:12px;z-index:100;font:12px system-ui;color:white';
  var label=document.createElement('label');label.textContent='Capture concept ';var select=document.createElement('select');select.setAttribute('aria-label','Capture concept');
  inventory.entries.forEach(function(item){var option=document.createElement('option'),source=document.querySelector(item.source.selector),caption=source.querySelector('.'+item.source.captionClass+' span');option.value=item.id;option.textContent=item.styleLabel+' · '+item.period+' · '+(caption?caption.textContent:item.name);select.append(option);});
  label.append(select);controls.append(label);document.body.append(controls);
  var stage=document.createElement('main');stage.id='date-concept-stage';stage.style.cssText='position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:#0e1218';
  var frame=document.createElement('div');frame.id='date-concept-frame';frame.style.cssText='width:800px;height:500px;display:grid;place-items:center;overflow:hidden';stage.append(frame);document.body.append(stage);
  document.querySelector('.wrapper').hidden=true;document.querySelector('.footer-note').hidden=true;
  function show(){
    var item=inventory.entries.find(function(entry){return entry.id===select.value;});
    var original=document.querySelector(item.source.selector);if(!original)throw Error('Missing source design: '+item.id);
    var copy=original.cloneNode(true);copy.style.width='320px';copy.style.minHeight='210px';copy.style.maxHeight='285px';copy.style.transform='scale(1.6)';
    frame.style.background={nothing:'#0e1014',liquid:'#14323d',terminal:'#041109',eink:'#d9d3c8'}[item.style];
    frame.replaceChildren(copy);stage.dataset.concept=item.id;
  }
  select.addEventListener('change',show);show();
})();
