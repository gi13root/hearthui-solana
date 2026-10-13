const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../addon/config.js');
const { createStoreController } = require('../addon/store.js');
function deferred() { let resolve; const promise=new Promise(r=>resolve=r);return {promise,resolve}; }
function controller(set) {
  let notify;
  const storage={get:async()=>({[C.STORAGE_OWNED]:['theme_aurora','theme_dune','icons_glass'],[C.STORAGE_APPLIED]:{theme:'theme_dune'}}),set,onChanged:fn=>notify=fn};
  const c=createStoreController({config:C,storage,openBridge(){}});return {c,notify:changes=>notify(changes,'local')};
}
test('rejected persistence preserves previously applied theme and reports failure',async()=>{
  const {c}=controller(async()=>{throw new Error('quota exceeded');});await c.ready;
  assert.equal(await c.apply('theme_aurora'),false);
  assert.equal(c.state().effective.theme,'theme_dune');
  assert.match(c.lastError().message,/quota exceeded/);
});
test('pending persistence never advertises Applied before durable success',async()=>{
  const gate=deferred();const {c}=controller(()=>gate.promise);await c.ready;
  const pending=c.apply('theme_aurora');await Promise.resolve();
  assert.equal(c.state().effective.theme,'theme_dune');
  gate.resolve();assert.equal(await pending,true);assert.equal(c.state().effective.theme,'theme_aurora');
});
test('concurrent multi-slot writes serialize without losing earlier slot',async()=>{
  const gate=deferred(),entered=deferred();let count=0;const writes=[];
  const {c}=controller(async value=>{writes.push(value);if(++count===1){entered.resolve();await gate.promise;}});await c.ready;
  const first=c.apply('theme_aurora');await entered.promise;const second=c.apply('icons_glass');
  gate.resolve();assert.equal(await first,true);assert.equal(await second,true);
  assert.equal(writes[1][C.STORAGE_APPLIED].theme,'theme_aurora');
  assert.equal(c.state().effective.icons,'icons_glass');
});
test('late write completion does not undo a more recent external preference change',async()=>{
  const gate=deferred(),entered=deferred();const {c,notify}=controller(async()=>{entered.resolve();await gate.promise;});await c.ready;
  const pending=c.apply('theme_aurora');await entered.promise;
  notify({[C.STORAGE_APPLIED]:{newValue:{theme:'theme_dune',icons:'icons_glass'}}});
  gate.resolve();await pending;assert.equal(c.state().effective.icons,'icons_glass');assert.equal(c.state().effective.theme,'theme_dune');
});

const vm=require('node:vm');const fs=require('node:fs');
function browserStore(failGet) {
  const runtime={};
  const root={HearthSolanaConfig:C,HearthSolanaLogic:require('../addon/solana-logic.js'),chrome:{runtime,storage:{onChanged:{addListener(){}},local:{
    get(keys,cb){if(failGet)runtime.lastError={message:'read failed'};cb({[C.STORAGE_OWNED]:['theme_aurora']});delete runtime.lastError;},
    set(value,cb){runtime.lastError={message:'write failed'};cb();delete runtime.lastError;}
  }}}};
  const document={documentElement:{classList:{toggle(){}}},getElementById(){return null;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../addon/store.js'),'utf8'),{window:root,document,Set});return root.HearthStore;
}
test('Chrome callback write errors reject application and retain prior state',async()=>{
  const c=browserStore(false);await c.ready;
  assert.equal(await c.apply('theme_aurora'),false);assert.equal(c.state().effective.theme,null);assert.match(c.lastError().message,/write failed/);
});
test('Chrome callback read errors are reported without granting ownership',async()=>{
  const c=browserStore(true);await c.ready;
  assert.match(c.lastError().message,/read failed/);assert.equal(await c.apply('theme_aurora'),false);
});
