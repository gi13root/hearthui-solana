/* hearth-pass-client.js — zero-dependency client for the hearth_pass program.
 * IIFE; attaches globalThis.HearthPass (window in browser, global in Node >= 20).
 * Needs WebCrypto (crypto.subtle) for SHA-256. No bundler, no eval, MV3-safe. */
(function (root) {
  'use strict';

  var config = {
    // TODO(A3): replace with real program id after `anchor deploy` (see program/DEPLOY.md).
    programId: '4reMmBoV39ykPDMtm8XqrGxazE332kDx2KcJvAVriivA',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    rpcUrl: 'https://api.devnet.solana.com',
    treasury: '7jhqV2NTmWJayyUFUKJ8Xv97EJovAEqACzqCLXXCGnoV', // ADMIN in lib.rs (devnet deployer)
    // Kill switch (plan M): set false and every `pass` sku is sold via direct `usdc`.
    passEnabled: true,
    passSkus: ['theme_aurora', 'theme_dune', 'icons_glass'],
  };
  var TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  var SYSTEM_PROGRAM = '11111111111111111111111111111111';
  var RECEIPT_SIZE = 8 + 32 + 32 + 8 + 8 + 1; // 89

  // ---------- base58 ----------
  var ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Encode(bytes) {
    var n = 0n, i;
    for (i = 0; i < bytes.length; i++) n = n * 256n + BigInt(bytes[i]);
    var s = '';
    while (n > 0n) { s = ALPHA[Number(n % 58n)] + s; n /= 58n; }
    for (i = 0; i < bytes.length && bytes[i] === 0; i++) s = '1' + s;
    return s;
  }
  function base58Decode(str) {
    var n = 0n, i, zeros = 0;
    for (i = 0; i < str.length; i++) {
      var v = ALPHA.indexOf(str[i]);
      if (v < 0) throw new Error('invalid base58');
      n = n * 58n + BigInt(v);
    }
    for (i = 0; i < str.length && str[i] === '1'; i++) zeros++;
    var out = [];
    while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
    var res = new Uint8Array(zeros + out.length);
    res.set(out, zeros);
    return res;
  }
  function toKey(k) {
    var b = typeof k === 'string' ? base58Decode(k) : new Uint8Array(k);
    if (b.length !== 32) throw new Error('pubkey must be 32 bytes');
    return b;
  }

  // ---------- sha256 / concat ----------
  function concat(parts) {
    var len = 0, i, off = 0;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    for (i = 0; i < parts.length; i++) { out.set(parts[i], off); off += parts[i].length; }
    return out;
  }
  var enc = new TextEncoder();
  async function sha256(bytes) {
    return new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes));
  }
  async function discriminator(ns, name) {
    return (await sha256(enc.encode(ns + ':' + name))).slice(0, 8);
  }

  // ---------- ed25519 on-curve check (matches curve25519-dalek decompress) ----------
  var P = (1n << 255n) - 19n;
  function mod(a) { var r = a % P; return r < 0n ? r + P : r; }
  function pow(b, e) { var r = 1n; b = mod(b); while (e > 0n) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; } return r; }
  var D = mod(-121665n * pow(121666n, P - 2n));
  function isOnCurve(bytes) {
    var y = 0n;
    for (var i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
    y = mod(y);
    var y2 = mod(y * y);
    var u = mod(y2 - 1n), v = mod(D * y2 + 1n);
    var x2 = mod(u * pow(v, P - 2n));
    if (x2 === 0n) return true;
    return pow(x2, (P - 1n) / 2n) === 1n;
  }

  // ---------- PDA ----------
  async function findProgramAddress(seeds, programId) {
    var pid = toKey(programId);
    for (var bump = 255; bump >= 0; bump--) {
      var h = await sha256(concat(seeds.concat([new Uint8Array([bump]), pid, enc.encode('ProgramDerivedAddress')])));
      if (!isOnCurve(h)) return [base58Encode(h), bump];
    }
    throw new Error('no viable bump');
  }
  function themeId(sku) {
    var b = enc.encode(sku);
    if (b.length > 32) throw new Error('sku longer than 32 bytes');
    var out = new Uint8Array(32); out.set(b); return out;
  }
  function deriveThemePda(sku) {
    return findProgramAddress([enc.encode('theme'), themeId(sku)], config.programId);
  }
  function derivePassPda(wallet, sku) {
    return findProgramAddress([enc.encode('pass'), toKey(wallet), themeId(sku)], config.programId);
  }
  async function deriveAta(owner, mint) {
    return (await findProgramAddress([toKey(owner), toKey(TOKEN_PROGRAM), toKey(mint)], ATA_PROGRAM))[0];
  }

  // ---------- receipt layout ----------
  function u64le(n) { var b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return b; }
  async function encodeReceipt(r) {
    var d = await discriminator('account', 'PassReceipt');
    return concat([d, toKey(r.buyer), themeId(r.sku), u64le(r.price), u64le(BigInt.asUintN(64, BigInt(r.paidAt))), new Uint8Array([r.bump])]);
  }
  async function decodeReceipt(data) {
    data = new Uint8Array(data);
    if (data.length < RECEIPT_SIZE) throw new Error('receipt too short');
    var d = await discriminator('account', 'PassReceipt');
    for (var i = 0; i < 8; i++) if (data[i] !== d[i]) throw new Error('not a PassReceipt');
    var dv = new DataView(data.buffer, data.byteOffset);
    var tid = data.subarray(40, 72), end = 32;
    while (end > 0 && tid[end - 1] === 0) end--;
    return {
      buyer: base58Encode(data.subarray(8, 40)),
      sku: new TextDecoder().decode(tid.subarray(0, end)),
      price: dv.getBigUint64(72, true),
      paidAt: dv.getBigInt64(80, true),
      bump: data[88],
    };
  }

  // ---------- instruction ----------
  /** opts: {buyer, sku, creator, treasury}. Returns {programId, keys[{name,pubkey,isSigner,isWritable}], data}.
   *  Account order must match BuyPass in programs/hearth_pass/src/lib.rs. */
  async function buildBuyPassInstruction(opts) {
    var mint = config.usdcMint;
    var theme = (await deriveThemePda(opts.sku))[0];
    var pass = (await derivePassPda(opts.buyer, opts.sku))[0];
    function m(name, pubkey, s, w) { return { name: name, pubkey: pubkey, isSigner: s, isWritable: w }; }
    return {
      programId: config.programId,
      keys: [
        m('buyer', opts.buyer, true, true),
        m('theme', theme, false, false),
        m('pass', pass, false, true),
        m('mint', mint, false, false),
        m('buyerAta', await deriveAta(opts.buyer, mint), false, true),
        m('creatorAta', await deriveAta(opts.creator, mint), false, true),
        m('treasuryAta', await deriveAta(opts.treasury, mint), false, true),
        m('tokenProgram', TOKEN_PROGRAM, false, false),
        m('associatedTokenProgram', ATA_PROGRAM, false, false),
        m('systemProgram', SYSTEM_PROGRAM, false, false),
      ],
      data: concat([await discriminator('global', 'buy_pass'), themeId(opts.sku)]),
    };
  }

  // ---------- RPC ----------
  /** rpc: function(method, params) -> result, or a URL string (JSON-RPC over fetch). */
  function rpcCall(rpc, method, params) {
    if (typeof rpc === 'function') return rpc(method, params);
    return root.fetch(rpc || config.rpcUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    });
  }
  function b64(s) {
    if (typeof atob === 'function') { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    return new Uint8Array(Buffer.from(s, 'base64'));
  }
  /** Returns decoded receipt or null. Only trusts accounts owned by the program. */
  async function fetchPass(rpc, wallet, sku) {
    var pda = (await derivePassPda(wallet, sku))[0];
    var res = await rpcCall(rpc, 'getAccountInfo', [pda, { encoding: 'base64', commitment: 'confirmed' }]);
    var acc = res && res.value;
    if (!acc || acc.owner !== config.programId) return null;
    var r = await decodeReceipt(b64(acc.data[0]));
    if (r.buyer !== wallet || r.sku !== sku) return null;
    return r;
  }
  async function isOwned(rpc, wallet, sku) {
    try { return (await fetchPass(rpc, wallet, sku)) !== null; } catch (e) { return false; }
  }

  function methodFor(sku) {
    return config.passEnabled && config.passSkus.indexOf(sku) >= 0 ? 'pass' : 'usdc';
  }
  function configure(o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) config[k] = o[k]; return config; }

  /** Theme account: 8-byte discriminator, then creator Pubkey. */
  async function fetchThemeCreator(rpc, sku) {
    var pda = (await deriveThemePda(sku))[0];
    var res = await rpcCall(rpc, 'getAccountInfo', [pda, { encoding: 'base64', commitment: 'confirmed' }]);
    var acc = res && res.value;
    if (!acc || acc.owner !== config.programId) throw Object.assign(new Error('theme_not_found: ' + sku), { code: 'theme_not_found' });
    return base58Encode(b64(acc.data[0]).slice(8, 40));
  }

  // Interface the bridge and the extension session expect (see docs/CONTRACT.md handoffs).
  root.HearthPassClient = {
    buildBuyPassIx: async function (o) {
      var creator = await fetchThemeCreator(o.rpc, o.sku);
      return buildBuyPassInstruction({ buyer: o.buyer, sku: o.sku, creator: creator, treasury: config.treasury });
    },
    isPassOwned: function (address, sku) { return isOwned(config.rpcUrl, address, sku); },
  };

  root.HearthPass = {
    config: config, configure: configure, methodFor: methodFor,
    RECEIPT_SIZE: RECEIPT_SIZE,
    base58Encode: base58Encode, base58Decode: base58Decode, sha256: sha256,
    discriminator: discriminator, isOnCurve: isOnCurve, findProgramAddress: findProgramAddress,
    themeId: themeId, deriveThemePda: deriveThemePda, derivePassPda: derivePassPda, deriveAta: deriveAta,
    encodeReceipt: encodeReceipt, decodeReceipt: decodeReceipt,
    buildBuyPassInstruction: buildBuyPassInstruction, fetchPass: fetchPass, isOwned: isOwned,
  };
})(typeof window !== 'undefined' ? window : globalThis);
