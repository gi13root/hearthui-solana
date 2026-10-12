/* solana-lite: minimal, dependency-free Solana helpers for no-bundler pages.
 * Owner: A1. Exposes window.SolanaLite (browser) / module.exports (node).
 * Scope: base58, sha256 (WebCrypto), ed25519 on-curve check, PDA/ATA derivation,
 * SPL transferChecked + ATA-idempotent ixs, legacy message compile, tiny JSON-RPC. */
(function (root) {
  'use strict';
  var ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var MAP = {}; for (var i = 0; i < ALPHA.length; i++) MAP[ALPHA[i]] = i;

  function b58enc(bytes) {
    var zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    var digits = [];
    for (var i = zeros; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
      while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    var s = ''; for (var z = 0; z < zeros; z++) s += '1';
    for (var q = digits.length - 1; q >= 0; q--) s += ALPHA[digits[q]];
    return s;
  }
  function base58Decode(str) {
    if (typeof str !== 'string') throw new Error('base58: not a string');
    var zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
    var bytes = [];
    for (var i = zeros; i < str.length; i++) {
      var v = MAP[str[i]]; if (v === undefined) throw new Error('base58: bad char');
      var carry = v;
      for (var j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    var out = new Uint8Array(zeros + bytes.length);
    for (var k = 0; k < bytes.length; k++) out[out.length - 1 - k] = bytes[k];
    return out;
  }
  function toBytes(k) { return typeof k === 'string' ? base58Decode(k) : k; }
  function isPubkey(s) { try { return base58Decode(s).length === 32; } catch (e) { return false; } }

  function concat(arrs) {
    var n = 0; arrs.forEach(function (a) { n += a.length; });
    var o = new Uint8Array(n), p = 0; arrs.forEach(function (a) { o.set(a, p); p += a.length; });
    return o;
  }
  function subtle() { var c = (root && root.crypto) || globalThis.crypto; return c.subtle; }
  async function sha256(data) { return new Uint8Array(await subtle().digest('SHA-256', data)); }

  // --- ed25519 on-curve check (mirrors curve25519-dalek CompressedEdwardsY::decompress) ---
  var P = (1n << 255n) - 19n;
  function mod(a) { var r = a % P; return r < 0n ? r + P : r; }
  function pow(b, e) { var r = 1n; b = mod(b); while (e > 0n) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; } return r; }
  var D = mod(-121665n * pow(121666n, P - 2n));
  function isOnCurve(bytes) {
    var b = toBytes(bytes); if (b.length !== 32) return false;
    var y = 0n; for (var i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? b[i] & 0x7f : b[i]);
    y = mod(y);
    var y2 = mod(y * y), u = mod(y2 - 1n), v = mod(D * y2 + 1n);
    var v3 = mod(v * v * v), v7 = mod(v3 * v3 * v);
    var x = mod(u * v3 * pow(u * v7, (P - 5n) / 8n));
    var vx2 = mod(v * x * x);
    if (vx2 === u) return true;
    return vx2 === mod(-u); // root is x * sqrt(-1)
  }

  var PDA_MARKER = new TextEncoder().encode('ProgramDerivedAddress');
  async function createProgramAddress(seeds, programId) {
    var h = await sha256(concat(seeds.map(toBytes).concat([toBytes(programId), PDA_MARKER])));
    if (isOnCurve(h)) throw new Error('on-curve');
    return b58enc(h);
  }
  async function findProgramAddress(seeds, programId) {
    for (var bump = 255; bump >= 0; bump--) {
      try { return [await createProgramAddress(seeds.concat([new Uint8Array([bump])]), programId), bump]; } catch (e) { /* next */ }
    }
    throw new Error('no viable bump');
  }

  var TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var ATA_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  var SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
  var USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  async function getAssociatedTokenAddress(owner, mint) {
    return (await findProgramAddress([toBytes(owner), toBytes(TOKEN_PROGRAM_ID), toBytes(mint)], ATA_PROGRAM_ID))[0];
  }
  function themeId(sku) {
    var raw = new TextEncoder().encode(sku);
    if (raw.length > 32) throw new Error('sku too long');
    var o = new Uint8Array(32); o.set(raw); return o;
  }
  function findPassPda(buyer, sku, programId) {
    return findProgramAddress([new TextEncoder().encode('pass'), toBytes(buyer), themeId(sku)], programId);
  }
  function u64le(n) { var o = new Uint8Array(8); n = BigInt(n); for (var i = 0; i < 8; i++) { o[i] = Number(n & 0xffn); n >>= 8n; } return o; }

  function transferCheckedIx(a) {
    return { programId: TOKEN_PROGRAM_ID, keys: [
      { pubkey: a.source, isSigner: false, isWritable: true },
      { pubkey: a.mint, isSigner: false, isWritable: false },
      { pubkey: a.destination, isSigner: false, isWritable: true },
      { pubkey: a.owner, isSigner: true, isWritable: false },
    ], data: concat([new Uint8Array([12]), u64le(a.amount), new Uint8Array([a.decimals])]) };
  }
  function createAtaIdempotentIx(a) {
    return { programId: ATA_PROGRAM_ID, keys: [
      { pubkey: a.payer, isSigner: true, isWritable: true },
      { pubkey: a.ata, isSigner: false, isWritable: true },
      { pubkey: a.owner, isSigner: false, isWritable: false },
      { pubkey: a.mint, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ], data: new Uint8Array([1]) };
  }

  function compactU16(n) {
    var o = []; for (;;) { var b = n & 0x7f; n >>= 7; if (n) o.push(b | 0x80); else { o.push(b); break; } }
    return new Uint8Array(o);
  }
  function keyStr(k) { return typeof k === 'string' ? k : b58enc(k); }

  // Legacy (v0-less) message. Order: payer, writable signers, ro signers, writable non-signers, ro non-signers.
  function compileLegacyMessage(opts) {
    var metas = new Map(), order = [];
    function add(k, s, w) {
      k = keyStr(k);
      if (!metas.has(k)) { metas.set(k, { s: false, w: false }); order.push(k); }
      var m = metas.get(k); m.s = m.s || s; m.w = m.w || w;
    }
    add(opts.payer, true, true);
    opts.instructions.forEach(function (ix) {
      ix.keys.forEach(function (k) { add(k.pubkey, k.isSigner, k.isWritable); });
      add(ix.programId, false, false);
    });
    var payer = keyStr(opts.payer);
    function rank(k) { var m = metas.get(k); if (k === payer) return 0; return m.s ? (m.w ? 1 : 2) : (m.w ? 3 : 4); }
    var keys = order.slice().sort(function (a, b) { return rank(a) - rank(b) || order.indexOf(a) - order.indexOf(b); });
    var nSig = keys.filter(function (k) { return metas.get(k).s; }).length;
    var nRoSig = keys.filter(function (k) { var m = metas.get(k); return m.s && !m.w; }).length;
    var nRoUn = keys.filter(function (k) { var m = metas.get(k); return !m.s && !m.w; }).length;
    var parts = [new Uint8Array([nSig, nRoSig, nRoUn]), compactU16(keys.length)];
    keys.forEach(function (k) { parts.push(base58Decode(k)); });
    parts.push(base58Decode(opts.recentBlockhash));
    parts.push(compactU16(opts.instructions.length));
    opts.instructions.forEach(function (ix) {
      parts.push(new Uint8Array([keys.indexOf(keyStr(ix.programId))]));
      parts.push(compactU16(ix.keys.length));
      parts.push(new Uint8Array(ix.keys.map(function (k) { return keys.indexOf(keyStr(k.pubkey)); })));
      parts.push(compactU16(ix.data.length)); parts.push(ix.data);
    });
    return concat(parts);
  }
  // Wire transaction for a single signer.
  function serializeTransaction(message, signatures) {
    return concat([compactU16(signatures.length)].concat(signatures).concat([message]));
  }

  // Unsigned wire transaction: one zeroed 64-byte slot per required signer (header byte 0), then the message.
  // Wallet request APIs (Phantom signAndSendTransaction) expect this, not the bare message.
  function unsignedTransaction(message) {
    var n = message[0], sigs = [];
    for (var i = 0; i < n; i++) sigs.push(new Uint8Array(64));
    return serializeTransaction(message, sigs);
  }

  async function rpc(url, method, params, fetchImpl) {
    var f = fetchImpl || root.fetch.bind(root);
    var r = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) });
    var j = await r.json(); if (j.error) throw new Error('rpc ' + method + ': ' + (j.error.message || j.error.code));
    return j.result;
  }
  async function confirmSignature(url, sig, opts) {
    opts = opts || {}; var deadline = Date.now() + (opts.timeoutMs || 60000);
    while (Date.now() < deadline) {
      var res = await rpc(url, 'getSignatureStatuses', [[sig], { searchTransactionHistory: true }], opts.fetch);
      var st = res && res.value && res.value[0];
      if (st && st.err) throw new Error('tx_failed');
      if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return st;
      await new Promise(function (r) { setTimeout(r, opts.intervalMs || 1500); });
    }
    throw new Error('confirm_timeout');
  }

  var api = { base58Encode: b58enc, base58Decode: base58Decode, isPubkey: isPubkey, sha256: sha256, isOnCurve: isOnCurve,
    createProgramAddress: createProgramAddress, findProgramAddress: findProgramAddress, getAssociatedTokenAddress: getAssociatedTokenAddress,
    themeId: themeId, findPassPda: findPassPda, u64le: u64le, transferCheckedIx: transferCheckedIx, createAtaIdempotentIx: createAtaIdempotentIx,
    compactU16: compactU16, compileLegacyMessage: compileLegacyMessage, serializeTransaction: serializeTransaction, unsignedTransaction: unsignedTransaction, rpc: rpc, confirmSignature: confirmSignature,
    TOKEN_PROGRAM_ID: TOKEN_PROGRAM_ID, ATA_PROGRAM_ID: ATA_PROGRAM_ID, SYSTEM_PROGRAM_ID: SYSTEM_PROGRAM_ID, USDC_DEVNET_MINT: USDC_DEVNET_MINT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SolanaLite = api;
})(typeof window !== 'undefined' ? window : globalThis);
