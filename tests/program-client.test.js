'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('../program/client/hearth-pass-client.js');
const HP = globalThis.HearthPass;

const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

test('base58 round-trip and known values', () => {
  const zero = HP.base58Decode('11111111111111111111111111111111');
  assert.equal(zero.length, 32);
  assert.ok(zero.every((b) => b === 0));
  const usdc = HP.base58Decode(USDC);
  assert.equal(usdc.length, 32);
  assert.equal(HP.base58Encode(usdc), USDC);
});

test('anchor discriminators match sha256("global:<name>")[0..8]', async () => {
  // Well-known Anchor value for "initialize".
  assert.equal(Buffer.from(await HP.discriminator('global', 'initialize')).toString('hex'), 'afaf6d1f0d989bed');
  for (const n of ['buy_pass', 'create_theme']) {
    const exp = createHash('sha256').update('global:' + n).digest().subarray(0, 8);
    assert.deepEqual(Buffer.from(await HP.discriminator('global', n)), exp);
  }
  const acct = createHash('sha256').update('account:PassReceipt').digest().subarray(0, 8);
  assert.deepEqual(Buffer.from(await HP.discriminator('account', 'PassReceipt')), acct);
});

test('themeId pads sku to 32 bytes and rejects long skus', () => {
  const id = HP.themeId('theme_aurora');
  assert.equal(id.length, 32);
  assert.equal(Buffer.from(id.subarray(0, 12)).toString(), 'theme_aurora');
  assert.ok(id.subarray(12).every((b) => b === 0));
  assert.throws(() => HP.themeId('x'.repeat(33)));
});

test('isOnCurve: real wallet keys are on curve', () => {
  assert.equal(HP.isOnCurve(HP.base58Decode(USDC)), true);
  assert.equal(HP.isOnCurve(new Uint8Array(32)), true); // y=0 is a valid point
});

// Independent reference: Node createHash + same curve check.
function refPda(seeds, programId) {
  for (let bump = 255; bump >= 0; bump--) {
    const h = createHash('sha256');
    for (const s of seeds) h.update(s);
    h.update(Buffer.from([bump])).update(programId).update('ProgramDerivedAddress');
    const d = new Uint8Array(h.digest());
    if (!HP.isOnCurve(d)) return [d, bump];
  }
}

test('deriveThemePda / derivePassPda match reference and are off-curve', async () => {
  const pid = HP.base58Decode(HP.config.programId);
  const tid = HP.themeId('theme_dune');
  const [t, tb] = await HP.deriveThemePda('theme_dune');
  const [rt, rtb] = refPda([Buffer.from('theme'), tid], pid);
  assert.equal(t, HP.base58Encode(rt));
  assert.equal(tb, rtb);
  assert.equal(HP.isOnCurve(HP.base58Decode(t)), false);

  const [p, pb] = await HP.derivePassPda(USDC, 'theme_dune');
  const [rp, rpb] = refPda([Buffer.from('pass'), HP.base58Decode(USDC), tid], pid);
  assert.equal(p, HP.base58Encode(rp));
  assert.equal(pb, rpb);
});

test('receipt encode/decode round-trip', async () => {
  const data = await HP.encodeReceipt({ buyer: USDC, sku: 'icons_glass', price: 2990000n, paidAt: 1760200000n, bump: 254 });
  assert.equal(data.length, HP.RECEIPT_SIZE);
  const r = await HP.decodeReceipt(data);
  assert.deepEqual(r, { buyer: USDC, sku: 'icons_glass', price: 2990000n, paidAt: 1760200000n, bump: 254 });
  data[0] ^= 1;
  await assert.rejects(HP.decodeReceipt(data));
});

test('buildBuyPassInstruction: data + account order', async () => {
  const ix = await HP.buildBuyPassInstruction({ buyer: USDC, sku: 'theme_aurora', creator: USDC, treasury: USDC });
  assert.equal(ix.programId, HP.config.programId);
  assert.equal(ix.data.length, 40);
  assert.deepEqual(Buffer.from(ix.data.subarray(0, 8)), createHash('sha256').update('global:buy_pass').digest().subarray(0, 8));
  assert.deepEqual(Buffer.from(ix.data.subarray(8)), Buffer.from(HP.themeId('theme_aurora')));
  const names = ix.keys.map((k) => k.name);
  assert.deepEqual(names, ['buyer', 'theme', 'pass', 'mint', 'buyerAta', 'creatorAta', 'treasuryAta', 'tokenProgram', 'associatedTokenProgram', 'systemProgram']);
  assert.equal(ix.keys[0].isSigner, true);
  assert.equal(ix.keys[3].pubkey, USDC);
});

test('fetchPass / isOwned with stub rpc', async () => {
  const data = await HP.encodeReceipt({ buyer: USDC, sku: 'theme_aurora', price: 1990000n, paidAt: 1n, bump: 255 });
  const b64 = Buffer.from(data).toString('base64');
  const mk = (owner) => async (method, params) => {
    assert.equal(method, 'getAccountInfo');
    return { value: owner ? { owner, data: [b64, 'base64'] } : null };
  };
  const p = await HP.fetchPass(mk(HP.config.programId), USDC, 'theme_aurora');
  assert.equal(p.price, 1990000n);
  assert.equal(await HP.isOwned(mk(HP.config.programId), USDC, 'theme_aurora'), true);
  assert.equal(await HP.isOwned(mk(null), USDC, 'theme_aurora'), false);
  assert.equal(await HP.isOwned(mk('11111111111111111111111111111111'), USDC, 'theme_aurora'), false);
});

test('kill switch: method per sku follows config', () => {
  assert.equal(HP.methodFor('theme_aurora'), 'pass');
  assert.equal(HP.methodFor('supporter'), 'usdc');
  HP.configure({ passEnabled: false });
  assert.equal(HP.methodFor('theme_aurora'), 'usdc');
  HP.configure({ passEnabled: true });
});
