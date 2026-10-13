/* Run the shipped plain scripts through their public DOM controls. This bounded
 * DOM fixture models trees, attributes, selectors, focus and click dispatch;
 * it does not implement gallery navigation or substitute its rendered views. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function selectors(value){
  const parts=[];let part='',depth=0;
  for(const char of value){if(char==='[')depth++;if(char===']')depth--;if(/\s/.test(char)&&depth===0){if(part)parts.push(part);part='';}else part+=char;}
  if(part)parts.push(part);return parts;
}
function dataKey(name){return name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
function fixture(options={}){
  let document;
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.className='';this.hidden=false;this.disabled=false;this.listeners={};this.text='';this.open=false;this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>this.classList.toggle(c,true),toggle:(c,on)=>{const list=new Set(this.className.split(/\s+/).filter(Boolean));on=on===undefined?!list.has(c):on;if(on)list.add(c);else list.delete(c);this.className=Array.from(list).join(' ');return on;}};}
    get lastChild(){return this.children.at(-1)||null;}
    get isConnected(){return this===document.documentElement || !!(this.parentElement && this.parentElement.isConnected);}
    get textContent(){return this.text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this.replaceChildren();this.text=String(value);}
    append(...nodes){for(const node of nodes){if(typeof node==='string')throw new Error('Text nodes not needed by this surface');node.remove();node.parentElement=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this.text='';this.append(...nodes);}
    remove(){if(this.parentElement){const list=this.parentElement.children;list.splice(list.indexOf(this),1);this.parentElement=null;}}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=String(value);if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);}
    getAttribute(name){if(name==='id')return this.id??null;if(name.startsWith('data-'))return this.dataset[dataKey(name)]??null;return this.attributes[name]??null;}
    matches(part){
      if(part.startsWith('#'))return this.id===part.slice(1);
      if(part.startsWith('.'))return this.classList.contains(part.slice(1));
      if(part.startsWith('[')){const match=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part);if(!match)throw new Error('Unsupported selector '+part);if(match[1]==='hidden')return this.hidden;if(match[1]==='disabled')return this.disabled;const value=this.getAttribute(match[1]);return match[2]===undefined?value!==null:value===match[2];}
      return this.tagName===part.toUpperCase();
    }
    closest(selector){let node=this;while(node){if(node.matches(selector))return node;node=node.parentElement;}return null;}
    contains(node){while(node){if(node===this)return true;node=node.parentElement;}return false;}
    querySelectorAll(selector){
      const parts=selectors(selector),result=[];
      function matchesChain(node){if(!node.matches(parts.at(-1)))return false;let ancestor=node.parentElement;for(let i=parts.length-2;i>=0;i--){while(ancestor&&!ancestor.matches(parts[i]))ancestor=ancestor.parentElement;if(!ancestor)return false;ancestor=ancestor.parentElement;}return true;}
      function visit(node){for(const child of node.children){if(matchesChain(child))result.push(child);visit(child);}}visit(this);return result;
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
    dispatchEvent(event){event.target=this;event.defaultPrevented??=false;event.preventDefault??=()=>{event.defaultPrevented=true;};let node=this;while(node){for(const listener of node.listeners[event.type]||[])listener.call(node,event);if(event.bubbles===false)break;node=node.parentElement;}return !event.defaultPrevented;}
    click(){if(this.disabled)return;this.dispatchEvent({type:'click',bubbles:true});}
    focus(){if(this.isConnected&&!this.disabled)document.activeElement=this;}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  document={createElement:tag=>new Element(tag),getElementById:id=>document.documentElement.querySelector('#'+id)};
  document.documentElement=new Element('html');document.body=new Element('body');document.documentElement.append(document.body);document.activeElement=document.body;
  const requests=[],loaded=[],added=[],owned=options.owned||[];
  const window={document,addEventListener(){},addWidget:type=>added.push(type),WidgetRegistry:{has:()=>true,sourceOf:()=>null,load:async type=>{loaded.push(type);return true;}},HearthStore:{state:()=>({effective:{},applied:{}}),subscribe:()=>()=>{}},HearthSolana:{getOwned:async()=>owned,getSession:async()=>null,refreshOwned:async()=>owned,lastError:()=>null,onChange:()=>()=>{},openBridge:(action,sku)=>requests.push([action,sku])}};
  const context=vm.createContext({window,document,console,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:callback=>callback()});
  for(const name of ['store-date-concepts.js','store-catalog.js','store-widget-catalog.js','store-supporter.js','store-gallery.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../addon',name),'utf8'),context,{filename:name});
  return {window,document,requests,loaded,added,owned};
}
async function opened(options){const env=fixture(options);env.window.HearthStoreGallery.open();await new Promise(resolve=>setImmediate(resolve));return env;}
function click(node){assert.ok(node,'Expected the rendered control to exist');node.click();}
function assertSupporter(env){
  const grid=env.document.getElementById('hsg-items');
  assert.equal(grid.classList.contains('hsg-presentation'),true,'Supporter must use its benefits presentation rather than the generic item viewer');
  assert.equal(env.document.documentElement.querySelector('[data-focus-key="tab:supporter"]').getAttribute('aria-current'),'page');
  assert.equal(env.document.documentElement.querySelector('.hsg-viewer').hidden,true);
  assert.equal(env.document.activeElement.id,'hsg-supporter-title','Focus must move to the presentation heading');
  assert.equal(grid.querySelectorAll('.hsg-card').length,0,'Supporter must not remain a generic store card');
  const primary=grid.querySelector('[data-focus-key="supporter-primary"]');
  assert.ok(primary,'Supporter must expose its gated contribution action');
  assert.equal(primary.disabled,true,'Unavailable Supporter payments must stay disabled');
  assert.equal(primary.textContent,'Coming soon');
}
test('Featured Focus Bundle → Next routes to the Supporter presentation and focuses its heading',async()=>{
  const env=await opened();
  click(env.document.documentElement.querySelector('[data-item="bundle_focus"] button'));
  const viewer=env.document.documentElement.querySelector('.hsg-viewer');
  assert.equal(viewer.hidden,false);assert.match(viewer.textContent,/Focus Bundle/);
  click(viewer.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='Next item'));
  assertSupporter(env);env.window.HearthStoreGallery.close();
});
test('Featured View Supporter routes directly to the presentation, then Explore opens included widgets',async()=>{
  const env=await opened();
  click(env.document.documentElement.querySelector('[data-item="supporter"] button'));
  assertSupporter(env);
  click(env.document.documentElement.querySelector('[data-focus-key="supporter-widgets"]'));
  assert.equal(env.document.documentElement.querySelector('[data-focus-key="tab:widgets"]').getAttribute('aria-current'),'page');
  assert.equal(env.document.documentElement.querySelector('.hsg-subtabs').hidden,false);
  assert.equal(env.document.getElementById('hsg-items').classList.contains('hsg-presentation'),false);
  assert.ok(env.document.documentElement.querySelector('[data-item="widget_clock"]'));
  assert.equal(env.document.activeElement.dataset.focusKey,'tab:widgets');env.window.HearthStoreGallery.close();
});

function widgets(env){
  click(env.document.documentElement.querySelector('[data-focus-key="tab:widgets"]'));
  return env.document.getElementById('hsg-items');
}
function dateDesigns(env){
  const grid=widgets(env);
  const category=env.document.documentElement.querySelector('[data-widget-category="date"]');
  assert.ok(category,'Date Designs must be a rendered category');assert.match(category.textContent,/Date Designs/);click(category);
  return grid;
}
function change(node,value){assert.ok(node,'Expected the native filter to exist');node.value=value;node.dispatchEvent({type:'change',bubbles:true});}
test('Widgets includes 19 functional widgets plus four paid date stacks and buys the whole selected stack',async()=>{
  const env=await opened(),grid=widgets(env);
  assert.equal(grid.querySelectorAll('.hsg-card').length,23);
  click(env.document.documentElement.querySelector('[data-widget-category="date"]'));
  assert.equal(grid.querySelectorAll('.hsg-card').length,4);
  assert.equal(env.document.documentElement.querySelector('[data-focus-key="date-style"]'),null);
  assert.equal(env.document.documentElement.querySelector('[data-focus-key="date-period"]'),null,'Period filtering belongs inside a stack viewer');
  const card=grid.querySelector('[data-item="date_nothing_stack"]'),buy=card.querySelector('.hsg-price');
  assert.equal(buy.disabled,false);assert.match(buy.textContent,/Buy/);click(buy);
  assert.deepEqual(env.requests,[['buy','date_nothing_stack']]);
  assert.deepEqual(env.loaded,[]);assert.deepEqual(env.added,[]);assert.deepEqual(env.owned,[]);
  assert.equal(card.dataset.state,'available');env.window.HearthStoreGallery.close();
});
function samples(viewer){return viewer.querySelectorAll('button').filter(button=>button.dataset.design || (button.dataset.focusKey||'').startsWith('design:'));}
test('a stack viewer filters its 24 samples and enlarges artwork while keeping the whole-stack heading and checkout SKU',async()=>{
  const env=await opened(),grid=dateDesigns(env);
  assert.equal(grid.querySelectorAll('.hsg-card').length,4);
  click(grid.querySelector('[data-item="date_nothing_stack"] button'));
  const viewer=env.document.documentElement.querySelector('.hsg-viewer');
  assert.equal(viewer.hidden,false);
  const heading=viewer.querySelector('h2').textContent;
  assert.match(heading,/Nothing OS/);assert.equal(samples(viewer).length,24);
  assert.equal(viewer.querySelector('[data-focus-key="date-style"]'),null);
  const period=viewer.querySelector('[data-focus-key="date-period"]');
  assert.equal(period.getAttribute('aria-label'),'Date period');change(period,'month');
  assert.equal(samples(viewer).length,8);
  const imageBefore=viewer.querySelector('.hsg-picture img').src;
  const sample=samples(viewer).find(button=>button.dataset.design==='date_nothing_month_8'||button.dataset.focusKey==='design:date_nothing_month_8');
  click(sample);
  assert.equal(viewer.querySelector('h2').textContent,heading,'Sample enlargement must keep the stack product selected');
  const enlarged=viewer.querySelector('.hsg-picture img').src;
  assert.notEqual(enlarged,imageBefore);assert.match(enlarged,/date_nothing_month_8/);
  const actions=viewer.querySelectorAll('button');
  assert.equal(actions.some(button=>button.textContent==='Try on'||button.textContent==='Add widget'),false);
  const buy=viewer.querySelector('[data-focus-key="viewer-primary"]');assert.equal(buy.disabled,false);assert.match(buy.textContent,/Buy \$0\.99/);click(buy);
  assert.deepEqual(env.requests,[['buy','date_nothing_stack']]);assert.deepEqual(env.loaded,[]);assert.deepEqual(env.added,[]);
  click(viewer.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='Previous item'));
  assert.match(viewer.querySelector('h2').textContent,/Color E-Ink/,'Previous from the first stack must wrap to the fourth stack');
  click(viewer.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='Next item'));
  assert.equal(viewer.querySelector('h2').textContent,heading,'Next from the fourth stack must wrap back to the first stack');
  env.window.HearthStoreGallery.close();
});
test('child, malformed, pending, and explicitly unowned entitlements cannot grant a date stack',async()=>{
  const owned=[null,{sku:'date_nothing_stack',owned:false},{sku:'date_nothing_stack',status:'pending'},{sku:'date_nothing_day_1',source:'pass',verified:'bridge'}];
  const env=await opened({owned}),grid=dateDesigns(env),card=grid.querySelector('[data-item="date_nothing_stack"]');
  assert.ok(card,'The parent date stack must be rendered');assert.equal(card.dataset.state,'available');assert.doesNotMatch(card.textContent,/Owned/);assert.equal(card.querySelector('.hsg-price').disabled,false);
  env.window.HearthStoreGallery.close();
});
test('verified parent ownership displays disabled Owned for the stack and never starts another checkout or adds a widget',async()=>{
  const env=await opened({owned:[{sku:'date_nothing_stack',source:'pass',verified:'bridge'}]}),grid=dateDesigns(env),card=grid.querySelector('[data-item="date_nothing_stack"]');
  assert.ok(card,'The verified parent date stack must be rendered');assert.equal(card.dataset.state,'owned');assert.match(card.querySelector('.hsg-price').textContent,/Owned/);assert.equal(card.querySelector('.hsg-price').disabled,true);click(card.querySelector('.hsg-price'));
  assert.deepEqual(env.requests,[]);assert.deepEqual(env.loaded,[]);assert.deepEqual(env.added,[]);env.window.HearthStoreGallery.close();
});

test('arrow keys in the native Date period selector do not switch the parent stack, while viewer arrows still navigate',async()=>{
  const env=await opened(),grid=dateDesigns(env);
  click(grid.querySelector('[data-item="date_nothing_stack"] button'));
  const viewer=env.document.documentElement.querySelector('.hsg-viewer'),heading=viewer.querySelector('h2').textContent;
  let period=viewer.querySelector('[data-focus-key="date-period"]');change(period,'month');
  assert.equal(samples(viewer).length,8);
  period=viewer.querySelector('[data-focus-key="date-period"]');period.focus();
  const selectorArrow={type:'keydown',key:'ArrowRight',bubbles:true};period.dispatchEvent(selectorArrow);
  assert.equal(viewer.querySelector('h2').textContent,heading,'The native select must not activate stack navigation');
  assert.equal(samples(viewer).length,8);assert.equal(viewer.querySelector('[data-focus-key="date-period"]').value,'month');
  assert.equal(selectorArrow.defaultPrevented,false,'The gallery must let the native selector handle its keys');
  viewer.dispatchEvent({type:'keydown',key:'ArrowRight',bubbles:true,defaultPrevented:true});
  assert.equal(viewer.querySelector('h2').textContent,heading,'Already handled keyboard events must not activate stack navigation');
  const viewerArrow={type:'keydown',key:'ArrowRight',bubbles:true};viewer.dispatchEvent(viewerArrow);
  assert.match(viewer.querySelector('h2').textContent,/Liquid Glass/,'ArrowRight outside form controls must navigate to the next stack');
  assert.equal(viewerArrow.defaultPrevented,true);
  assert.deepEqual(env.requests,[]);assert.deepEqual(env.loaded,[]);assert.deepEqual(env.added,[]);env.window.HearthStoreGallery.close();
});
