const test=require('node:test');
const assert=require('node:assert/strict');
let S;try{S=require('../addon/store-supporter.js');}catch{S={};}
const soon={sku:'supporter',status:'soon',price:4.99};
const ready={sku:'supporter',status:'available',price:4.99};
function offer(options){assert.equal(typeof S.supporterOffer,'function');return S.supporterOffer(options);}
test('unavailable Supporter payments remain disabled even with a connected wallet',()=>{
  assert.deepEqual(offer({item:soon,state:'soon',connected:true}),{enabled:false,action:'none',label:'Coming soon',price:'$4.99 USDC'});
});
test('available Supporter directs signed-out users to wallet connection',()=>{
  assert.deepEqual(offer({item:ready,state:'available',connected:false}),{enabled:true,action:'signin',label:'Connect wallet',price:'$4.99 USDC'});
});
test('available Supporter directs a connected user to the existing support action',()=>{
  assert.deepEqual(offer({item:ready,state:'available',connected:true}),{enabled:true,action:'support',label:'Support HearthUI',price:'$4.99 USDC'});
});
test('an owned Supporter offers the verified transaction receipt',()=>{
  assert.deepEqual(offer({item:soon,state:'owned',hasReceipt:true}),{enabled:true,action:'receipt',label:'View receipt ↗',price:'$4.99 USDC'});
});
test('an owned Supporter without a receipt shows active status without initiating another payment',()=>{
  assert.deepEqual(offer({item:soon,state:'owned',hasReceipt:false}),{enabled:false,action:'none',label:'Supporter active',price:'$4.99 USDC'});
});
test('malformed or unrelated items never enable Supporter checkout',()=>{
  for(const item of [null,[],{...ready,sku:'theme_aurora'},{...ready,status:'included'},{...ready,price:0},{...ready,price:NaN}])assert.equal(offer({item,state:'available',connected:true}).enabled,false);
});
test('receipt and wallet eligibility require explicit booleans and format the supplied valid price',()=>{
  assert.deepEqual(offer({item:{...ready,price:7},state:'available',connected:'yes'}),{enabled:true,action:'signin',label:'Connect wallet',price:'$7.00 USDC'});
  assert.equal(offer({item:ready,state:'owned',hasReceipt:'yes'}).enabled,false);
});
