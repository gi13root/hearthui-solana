const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../addon/store-gallery.js');
const clock={id:'widget_clock',kind:'widget',widgetType:'clock',status:'included'};
test('a registry-ready included widget closes the gallery then adds its validated type',async()=>{
  assert.equal(typeof G.createWidgetAdder,'function');
  const events=[];
  const add=G.createWidgetAdder({items:()=>[clock],load:async type=>{events.push('load:'+type);return true;},close:()=>events.push('close'),add:type=>events.push('add:'+type),onError:()=>events.push('error')});
  assert.equal(await add(clock),true);
  assert.deepEqual(events,['load:clock','close','add:clock']);
});
test('failed registry readiness leaves gallery open and reports failure',async()=>{
  assert.equal(typeof G.createWidgetAdder,'function');
  const events=[];
  const add=G.createWidgetAdder({items:()=>[clock],load:async()=>false,close:()=>events.push('close'),add:()=>events.push('add'),onError:()=>events.push('error')});
  assert.equal(await add(clock),false);assert.deepEqual(events,['error']);
});
test('unknown types cannot trigger loading or adding and duplicate clicks share one addition',async()=>{
  assert.equal(typeof G.createWidgetAdder,'function');
  const events=[];let ready;
  const add=G.createWidgetAdder({items:()=>[clock],load:type=>{events.push(type);return new Promise(r=>{ready=r;});},close:()=>events.push('close'),add:type=>events.push('add:'+type),onError:()=>events.push('error')});
  assert.equal(await add({...clock,widgetType:'unknown'}),false);assert.deepEqual(events,[]);
  const first=add(clock),second=add(clock);ready(true);await Promise.all([first,second]);
  assert.deepEqual(events,['clock','close','add:clock']);
});
test('dismissed gallery cannot add a widget after delayed registry load',async()=>{
  assert.equal(typeof G.createWidgetAdder,'function');
  let active=true,ready;const events=[];
  const add=G.createWidgetAdder({items:()=>[clock],isActive:()=>active,load:()=>new Promise(r=>{ready=r;}),close:()=>events.push('close'),add:()=>events.push('add'),onError:()=>events.push('error')});
  const pending=add(clock);active=false;ready(true);assert.equal(await pending,false);assert.deepEqual(events,[]);
});
test('an obsolete load cannot clear a newer widget addition after reopening',async()=>{
  const ready=[],events=[];
  const add=G.createWidgetAdder({items:()=>[clock],load:()=>new Promise(r=>ready.push(r)),close:()=>events.push('close'),add:type=>events.push(type),onError:()=>events.push('error')});
  const old=add(clock);add.invalidate();const current=add(clock);
  ready[0](true);assert.equal(await old,false);
  const repeated=add(clock);
  assert.equal(ready.length,2);
  ready[1](true);await Promise.all([current,repeated]);assert.deepEqual(events,['close','clock']);
});
test('an add failure is reported even after closing invalidates the pending operation',async()=>{
  let active=true,adder;const errors=[];
  adder=G.createWidgetAdder({items:()=>[clock],load:async()=>true,isActive:()=>active,
    close:()=>{active=false;adder.invalidate();},add:async()=>{throw new Error('render failed');},
    onError:(error,item)=>errors.push({message:error.message,id:item.id})});
  assert.equal(await adder(clock),false);
  assert.deepEqual(errors,[{message:'render failed',id:'widget_clock'}]);
});
