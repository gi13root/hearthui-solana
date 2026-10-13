const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../addon/store-date-concepts.js');
const C = require('../addon/config.js');
const S = require('../addon/solana-session.js');
const B = require('../bridge/bridge-core.js');
const A = require('../program/scripts/store-catalog-accounts.cjs');
require('../program/client/hearth-pass-client.js');
const P=globalThis.HearthPass, PC=globalThis.HearthPassClient;
const parents=['date_nothing_stack','date_liquid_stack','date_terminal_stack','date_eink_stack'];
const wallet='7jhqV2NTmWJayyUFUKJ8Xv97EJovAEqACzqCLXXCGnoV';
function session(owned=[],extra={}) {
  const data={[S.SESSION_KEY]:{address:wallet,jwt:null,network:'devnet'},[S.OWNED_KEY]:{skus:owned}};
  const chrome={storage:{local:{get(keys,cb){cb(Object.fromEntries(keys.map(key=>[key,data[key]])));},set(obj,cb){Object.assign(data,obj);cb();}}}};
  return S.create({chrome,open(){},...extra});
}
test('four style stacks route to their own 0.99 pass checkout without readiness promotion',()=>{
  assert.deepEqual(D.items.map(x=>x.sku),parents);
  assert.equal(A.CATALOG.length,11);
  for(const item of D.items){
    assert.equal(C.CATALOG.find(x=>x.sku===item.sku)?.price,.99);
    assert.equal(P.methodFor(item.sku),'pass');
    assert.deepEqual(B.parseHash('#action=buy&sku='+item.sku),{action:'buy',sku:item.sku});
    assert.equal(B.parseHash('#action=pay&sku='+item.sku).error,'wrong_method');
    assert.equal(B.CATALOG[item.sku].amount,990000n);
    assert.equal(S.validateMessage({v:1,type:'purchase',sku:item.sku,method:'pass',tx_signature:'5'.repeat(88),status:'confirmed'}).ok,true);
    assert.ok(session().openBridge('buy',item.sku).endsWith('&sku='+item.sku));
    assert.equal(A.CATALOG.find(x=>x[0]===item.sku)?.[1],990000);
    assert.ok(!C.READY_PASS_SKUS.includes(item.sku));
  }
});
test('unknown concept variants cannot enter purchase or ownership routes',async()=>{
  for(const sku of ['date_studio_stack','date_nothing_day_1','date_liquid_week_8','date_terminal_month_1','date_eink_day_1','date_unknown_stack','date_eink_stack_extra']){
    assert.equal(B.parseHash('#action=buy&sku='+sku).error,'unknown_sku');
    assert.notEqual(P.methodFor(sku),'pass');
    assert.equal(S.validateMessage({v:1,type:'purchase',sku,method:'pass',tx_signature:'5'.repeat(88),status:'confirmed'}).ok,false);
    assert.throws(()=>session().openBridge('buy',sku));
  }
});
test('concept ownership refresh queries only cached concepts plus the original seven passes',async()=>{
  const calls=[];const api=session(['date_eink_stack'],{passCheck:async(_,sku)=>{calls.push(sku);return sku==='date_eink_stack';}});
  assert.deepEqual((await api.refreshOwned()).map(x=>x.sku),['date_eink_stack']);
  assert.equal(calls.length,8);
  assert.ok(!calls.includes('date_nothing_stack'));
});
test('explicitly ready concepts are checked but unknown readiness entries are ignored',async()=>{
  const calls=[];const api=session([],{readySkus:['date_liquid_stack','date_unknown_stack'],passCheck:async(_,sku)=>{calls.push(sku);return false;}});
  await api.refreshOwned();assert.equal(calls.length,8);assert.ok(calls.includes('date_liquid_stack'));
});
async function theme(price){
  const data=new Uint8Array(51);data.set(await P.discriminator('account','Theme'));data.set(P.base58Decode(wallet),8);
  const view=new DataView(data.buffer);view.setBigUint64(40,BigInt(price),true);view.setUint16(48,500,true);
  return {value:{owner:P.config.programId,data:[Buffer.from(data).toString('base64'),'base64']}};
}
test('concept checkout rejects on-chain price mismatch before producing transaction instructions',async()=>{
  await assert.rejects(PC.buildBuyPassIx({buyer:wallet,sku:'date_nothing_stack',rpc:async()=>theme(1990000)}),/theme_price_mismatch/);
  const ix=await PC.buildBuyPassIx({buyer:wallet,sku:'date_nothing_stack',rpc:async()=>theme(990000)});
  assert.equal(ix.programId,P.config.programId);
  assert.equal(ix.keys.find(x=>x.name==='theme').pubkey,(await P.deriveThemePda('date_nothing_stack'))[0]);
});

test('browser plain scripts recognize canonical concepts without Node require',()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  const context=vm.createContext({TextEncoder,TextDecoder,URLSearchParams});context.window=context;
  for(const file of ['addon/store-date-concepts.js','addon/config.js','addon/solana-session.js','program/client/hearth-pass-client.js','bridge/bridge-core.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  assert.equal(context.HearthSolanaConfig.CATALOG.filter(x=>x.kind==='concept-stack').length,4);
  assert.equal(context.HearthPass.methodFor('date_terminal_stack'),'pass');
  assert.equal(context.HearthBridgeCore.parseHash('#action=buy&sku=date_terminal_stack').sku,'date_terminal_stack');
  assert.equal(context.HearthBridgeCore.parseHash('#action=buy&sku=__proto__').error,'unknown_sku');
});
test('missing concept theme cannot create checkout instructions or grant ownership',async()=>{
  await assert.rejects(PC.buildBuyPassIx({buyer:wallet,sku:'date_eink_stack',rpc:async()=>({value:null})}),/theme_not_found/);
  const api=session([],{passCheck:async()=>false});
  assert.deepEqual(await api.refreshOwned(),[]);
});
test('temporary concept RPC failure preserves exact cached SKU without granting unrelated concepts',async()=>{
  const api=session(['date_nothing_stack'],{passCheck:async(_,sku)=>{if(sku==='date_nothing_stack')throw Error('offline');return false;}});
  assert.deepEqual((await api.refreshOwned()).map(x=>x.sku),['date_nothing_stack']);
  assert.equal(await api.isOwned('date_liquid_stack'),false);
});

test('former individual date designs cannot produce pass instructions even when an account exists',async()=>{
  await assert.rejects(PC.buildBuyPassIx({buyer:wallet,sku:'date_nothing_day_1',rpc:async()=>theme(990000)}),/unknown_sku/);
});
