const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../addon/store-gallery.js');
test('viewer navigation wraps inside the active category and handles a removed item',()=>{
  assert.equal(typeof G.nextItem,'function');
  const items=[{id:'aurora'},{id:'glass'},{id:'orbit'}];
  assert.equal(G.nextItem(items,'orbit',1).id,'aurora');
  assert.equal(G.nextItem(items,'aurora',-1).id,'orbit');
  assert.equal(G.nextItem(items,'removed',1).id,'aurora');
  assert.equal(G.nextItem([],'aurora',1),null);
});
test('successful Retry clears a previous RPC error even when refresh emits a newer cache load',async()=>{
  assert.equal(typeof G.createLoadCoordinator,'function');
  let lastError=new Error('offline'), coordinator;
  const rendered=[];
  const api={
    getOwned:async()=>['theme_aurora'],getSession:async()=>({address:'wallet'}),lastError:()=>lastError,
    refreshOwned:async()=>{lastError=null;await coordinator.load(false);return ['theme_aurora'];}
  };
  coordinator=G.createLoadCoordinator({api:()=>api,onSnapshot:s=>rendered.push(s),onError:e=>{throw e;}});
  await coordinator.load(false);
  assert.equal(rendered.at(-1).error.message,'offline');
  await coordinator.load(true);
  assert.equal(rendered.at(-1).error,null);
  assert.deepEqual(rendered.at(-1).owned,['theme_aurora']);
});
test('closing gallery invalidates an outstanding cache load',async()=>{
  assert.equal(typeof G.createLoadCoordinator,'function');
  let resolveOwned;const rendered=[];
  const coordinator=G.createLoadCoordinator({api:()=>({getOwned:()=>new Promise(r=>{resolveOwned=r;}),getSession:async()=>null}),onSnapshot:s=>rendered.push(s)});
  const pending=coordinator.load(false);coordinator.invalidate();resolveOwned(['theme_aurora']);await pending;
  assert.equal(rendered.length,0);
});
test('an ownership update retains action focus and an applied action falls back to its preview',()=>{
  assert.equal(typeof G.findFocusTarget,'function');
  const preview={dataset:{focusKey:'preview:aurora'},closest:()=>null};
  const action={dataset:{focusKey:'action:aurora'},disabled:false,closest:()=>null};
  assert.equal(G.findFocusTarget([preview,action],'action:aurora'),action);
  action.disabled=true;
  assert.equal(G.findFocusTarget([preview,action],'action:aurora'),preview);
  preview.closest=()=>({hidden:true});
  assert.equal(G.findFocusTarget([preview,action],'action:aurora'),null);
});
test('closing resolves a replacement See all button in the original store widget',()=>{
  assert.equal(typeof G.resolveOpener,'function');
  const oldButton={isConnected:false};
  const newButton={isConnected:true};
  const originalWidget={isConnected:true,querySelector:selector=>selector==='[data-store-gallery]'?newButton:null};
  assert.equal(G.resolveOpener(oldButton,originalWidget),newButton);
  oldButton.isConnected=true;
  assert.equal(G.resolveOpener(oldButton,originalWidget),oldButton);
  oldButton.isConnected=false;originalWidget.isConnected=false;
  assert.equal(G.resolveOpener(oldButton,originalWidget),null);
});
