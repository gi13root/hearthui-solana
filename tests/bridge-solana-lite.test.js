'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const SL = require('../bridge/vendor/solana-lite.js');

test('base58 round-trips known vectors', () => {
  assert.deepEqual(Array.from(SL.base58Decode('11111111111111111111111111111111')), new Array(32).fill(0));
  assert.equal(SL.base58Encode(new Uint8Array(32)), '11111111111111111111111111111111');
  assert.equal(SL.base58Encode(new TextEncoder().encode('hello world')), 'StV1DL6CwTryKyV');
  assert.equal(SL.base58Decode(SL.TOKEN_PROGRAM_ID).length, 32);
  assert.equal(SL.base58Encode(SL.base58Decode(SL.ATA_PROGRAM_ID)), SL.ATA_PROGRAM_ID);
  assert.throws(() => SL.base58Decode('0OIl'));
});

test('sha256 matches node crypto', async () => {
  const d = new TextEncoder().encode('abc');
  const h = await SL.sha256(d);
  assert.equal(Buffer.from(h).toString('hex'), nodeCrypto.createHash('sha256').update('abc').digest('hex'));
});

test('isOnCurve: real ed25519 pubkeys are on curve', () => {
  for (let i = 0; i < 8; i++) {
    const { publicKey } = nodeCrypto.generateKeyPairSync('ed25519');
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
    assert.equal(SL.isOnCurve(new Uint8Array(raw)), true);
  }
});

test('isOnCurve: known off-curve point (y=2) rejected', () => {
  const b = new Uint8Array(32); b[0] = 2;
  assert.equal(SL.isOnCurve(b), false);
});

// Independent reference implementation of findProgramAddress built on node crypto,
// used to cross-check the WebCrypto path and the bump loop.
function refFind(seeds, programId) {
  for (let bump = 255; bump >= 0; bump--) {
    const h = nodeCrypto.createHash('sha256');
    seeds.forEach((s) => h.update(s));
    h.update(Buffer.from([bump])); h.update(Buffer.from(SL.base58Decode(programId))); h.update('ProgramDerivedAddress');
    const out = new Uint8Array(h.digest());
    if (!SL.isOnCurve(out)) return [SL.base58Encode(out), bump];
  }
}

test('findProgramAddress matches reference and is off-curve', async () => {
  const wallet = SL.base58Decode('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
  const mint = SL.base58Decode(SL.USDC_DEVNET_MINT);
  const [addr, bump] = await SL.findProgramAddress([wallet, SL.base58Decode(SL.TOKEN_PROGRAM_ID), mint], SL.ATA_PROGRAM_ID);
  const [rAddr, rBump] = refFind([wallet, SL.base58Decode(SL.TOKEN_PROGRAM_ID), mint], SL.ATA_PROGRAM_ID);
  assert.equal(addr, rAddr); assert.equal(bump, rBump);
  assert.equal(SL.isOnCurve(SL.base58Decode(addr)), false);
  assert.equal(await SL.getAssociatedTokenAddress('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', SL.USDC_DEVNET_MINT), addr);
});

test('themeId pads sku to 32 bytes; pass PDA seeds per contract', async () => {
  const t = SL.themeId('theme_aurora');
  assert.equal(t.length, 32);
  assert.equal(new TextDecoder().decode(t.subarray(0, 12)), 'theme_aurora');
  assert.ok(t.subarray(12).every((x) => x === 0));
  assert.throws(() => SL.themeId('x'.repeat(33)));
  const prog = SL.TOKEN_PROGRAM_ID; // any valid key works for derivation
  const buyer = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const [pda] = await SL.findPassPda(buyer, 'theme_aurora', prog);
  const [ref] = refFind([Buffer.from('pass'), SL.base58Decode(buyer), t], prog);
  assert.equal(pda, ref);
});

test('transferChecked instruction encoding', () => {
  const ix = SL.transferCheckedIx({ source: SL.SYSTEM_PROGRAM_ID, mint: SL.USDC_DEVNET_MINT, destination: SL.SYSTEM_PROGRAM_ID, owner: SL.SYSTEM_PROGRAM_ID, amount: 4990000n, decimals: 6 });
  assert.equal(ix.programId, SL.TOKEN_PROGRAM_ID);
  assert.deepEqual(Array.from(ix.data), [12, 0x30, 0x24, 0x4c, 0, 0, 0, 0, 0, 6]);
  assert.deepEqual(ix.keys.map((k) => [k.isSigner, k.isWritable]), [[false, true], [false, false], [false, true], [true, false]]);
});

test('compileLegacyMessage: header, ordering, compact-u16', () => {
  const payer = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const ix = { programId: SL.TOKEN_PROGRAM_ID, keys: [
    { pubkey: SL.USDC_DEVNET_MINT, isSigner: false, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: false },
  ], data: new Uint8Array([7]) };
  const bh = SL.base58Encode(new Uint8Array(32).fill(1));
  const msg = SL.compileLegacyMessage({ payer, recentBlockhash: bh, instructions: [ix] });
  assert.deepEqual(Array.from(msg.subarray(0, 4)), [1, 0, 2, 3]); // 1 signer, 0 ro-signed, 2 ro-unsigned, 3 keys
  assert.deepEqual(Array.from(msg.subarray(4, 36)), Array.from(SL.base58Decode(payer)));
  const tail = Array.from(msg.subarray(4 + 96 + 32));
  // 1 ix, program index 2 (mint=1, token=2 sorted? readonly order = first-seen), 2 accounts [1,0], data len 1, [7]
  assert.equal(tail[0], 1);
  const keys = [0, 1, 2].map((i) => SL.base58Encode(msg.subarray(4 + i * 32, 36 + i * 32)));
  assert.equal(tail[1], keys.indexOf(SL.TOKEN_PROGRAM_ID));
  assert.deepEqual(tail.slice(2), [2, keys.indexOf(SL.USDC_DEVNET_MINT), 0, 1, 7]);
  assert.deepEqual(Array.from(SL.compactU16(300)), [0xac, 0x02]);
});

test('PDA known vector from solana.com docs (seed "helloWorld", system program)', async () => {
  const [addr, bump] = await SL.findProgramAddress([new TextEncoder().encode('helloWorld')], SL.SYSTEM_PROGRAM_ID);
  assert.equal(addr, '46GZzzetjCURsdFPb7rcnspbEMnCBXe9kpjrsZAkKb6X');
  assert.equal(bump, 254);
});
