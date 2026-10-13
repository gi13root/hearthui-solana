const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
let inspect;
let allowed;
try { inspect = require('../program/scripts/store-catalog-accounts.cjs').inspectThemeAccount; } catch {}
try { allowed = require('../program/scripts/store-catalog-accounts.cjs').isAllowedRpc; } catch {}
require('../program/client/hearth-pass-client.js');
const creator = 'CGvJ5c7uhiQjngSRzt5ce5fAtG5wwTinY5N4YeSAet49';
const programId = '4reMmBoV39ykPDMtm8XqrGxazE332kDx2KcJvAVriivA';
function account() {
  const data = Buffer.alloc(51);
  crypto.createHash('sha256').update('account:Theme').digest().copy(data,0,0,8);
  Buffer.from(HearthPass.base58Decode(creator)).copy(data,8);
  data.writeBigUInt64LE(1990000n,40); data.writeUInt16LE(500,48);
  return {owner:{toBase58:()=>programId},data};
}
test('existing devnet accounts must match owner, creator, price, discriminator and fee split', () => {
  assert.equal(typeof inspect,'function');
  assert.equal(inspect(account(),{programId,creator,price:1990000}).status,'ready');
  const wrong = account(); wrong.data.writeBigUInt64LE(1n,40);
  assert.equal(inspect(wrong,{programId,creator,price:1990000}).status,'mismatch');
  const foreign = account(); foreign.owner={toBase58:()=>creator};
  assert.equal(inspect(foreign,{programId,creator,price:1990000}).status,'mismatch');
  const malformed = account(); malformed.data[0]=0;
  assert.equal(inspect(malformed,{programId,creator,price:1990000}).status,'mismatch');
  assert.equal(inspect(null,{programId,creator,price:1990000}).status,'missing');
});
test('catalog provisioning cannot accept mainnet or an arbitrary host containing devnet', () => {
  assert.equal(typeof allowed,'function');
  assert.equal(allowed('https://api.devnet.solana.com'),true);
  assert.equal(allowed('http://127.0.0.1:8899'),true);
  assert.equal(allowed('https://api.mainnet-beta.solana.com/?devnet'),false);
  assert.equal(allowed('https://devnet.example.com'),false);
  assert.equal(allowed('not a URL'),false);
});
