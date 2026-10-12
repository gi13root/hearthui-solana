const test = require('node:test');
const assert = require('node:assert');
require('../program/client/hearth-pass-client.js');
const H = globalThis.HearthPass, C = globalThis.HearthPassClient;

test('HearthPassClient adapter: reads creator from theme PDA and targets treasury', async () => {
  const creator = 'CGvJ5c7uhiQjngSRzt5ce5fAtG5wwTinY5N4YeSAet49';
  const data = new Uint8Array(8 + 32 + 8 + 2 + 1); data.set(H.base58Decode(creator), 8);
  const rpc = async (method) => { assert.strictEqual(method, 'getAccountInfo');
    return { value: { owner: H.config.programId, data: [Buffer.from(data).toString('base64'), 'base64'] } }; };
  const buyer = '7jhqV2NTmWJayyUFUKJ8Xv97EJovAEqACzqCLXXCGnoV';
  const ix = await C.buildBuyPassIx({ buyer, sku: 'theme_aurora', rpc });
  const k = Object.fromEntries(ix.keys.map((x) => [x.name, x.pubkey]));
  assert.strictEqual(k.creatorAta, await H.deriveAta(creator, H.config.usdcMint));
  assert.strictEqual(k.treasuryAta, await H.deriveAta(H.config.treasury, H.config.usdcMint));
  assert.strictEqual(typeof C.isPassOwned, 'function');
});

test('HearthPassClient adapter: missing theme account is an error', async () => {
  const rpc = async () => ({ value: null });
  await assert.rejects(C.buildBuyPassIx({ buyer: '7jhqV2NTmWJayyUFUKJ8Xv97EJovAEqACzqCLXXCGnoV', sku: 'theme_dune', rpc }), /theme_not_found/);
});
