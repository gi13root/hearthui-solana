const test = require('node:test');
const assert = require('node:assert/strict');
let G; try { G = require('../addon/store-gallery.js'); } catch { G = {}; }
test('trial expiry restores its slot while preserving an unrelated desktop edit', () => {
  assert.equal(typeof G.createTrial, 'function');
  let state = {theme:'dune',icons:'glass'};
  const trial = G.createTrial({read:slot=>state[slot],write:(slot,value)=>{state[slot]=value;}});
  trial.start({theme:'aurora'}, 100);
  state.icons='mono';
  assert.equal(trial.remaining(30100), 0);
  trial.revert();
  assert.deepEqual(state,{theme:'dune',icons:'mono'});
});
test('replacement trials restore the original state and never overwrite a later edit', () => {
  assert.equal(typeof G.createTrial, 'function');
  let state={theme:'dune'};
  const trial=G.createTrial({read:s=>state[s],write:(s,v)=>{state[s]=v;}});
  trial.start({theme:'aurora'},0); trial.start({theme:'midnight'},100);
  trial.revert(); assert.equal(state.theme,'dune');
  trial.start({theme:'aurora'},200); state.theme='green'; trial.revert();
  assert.equal(state.theme,'green');
});
test('receipt URLs reject untrusted signatures and encode valid devnet identifiers', () => {
  assert.equal(typeof G.receiptUrl, 'function');
  assert.equal(G.receiptUrl('tx','javascript:alert(1)'),null);
  assert.equal(G.receiptUrl('address','A'.repeat(32)),'https://explorer.solana.com/address/'+ 'A'.repeat(32)+'?cluster=devnet');
});
test('persistent application of the trial value takes ownership of that slot before cleanup',()=>{
  let state={theme:'dune',icons:'glass'};
  const trial=G.createTrial({read:s=>state[s],write:(s,v)=>{state[s]=v;}});
  trial.start({theme:'aurora',icons:'mono'},0);
  assert.equal(typeof trial.release,'function');
  trial.release('theme'); trial.revert();
  assert.deepEqual(state,{theme:'aurora',icons:'glass'});
});
