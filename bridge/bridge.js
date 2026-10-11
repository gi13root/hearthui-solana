/* HearthUI wallet bridge (web page, not extension). Owner: A1.
 * Hash: #action=signin|pay|buy&sku=<sku>[&escrow=<base58>]  Query: ?ipfps=mock forces the IPFPS mock.
 * Flow: Phantom connect -> sign-in (nonce/signMessage/verify) -> [pay|buy tx -> confirm] -> notify extension -> claim. */
(function () {
  'use strict';
  var SL = window.SolanaLite, C = window.HearthBridgeCore, CFG = C.CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var req = C.parseHash(location.hash);
  var qs = new URLSearchParams(location.search);
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var useMock = qs.get('ipfps') === 'mock' || (isLocal && qs.get('ipfps') !== 'live');
  var STEPS = { signin: ['Connect wallet', 'Sign in message', 'Notify HearthUI'],
    pay: ['Connect wallet', 'Sign in message', 'Approve USDC transfer', 'Confirm on devnet', 'Unlock in HearthUI'],
    buy: ['Connect wallet', 'Sign in message', 'Approve pass purchase', 'Confirm on devnet', 'Unlock in HearthUI'] };

  function setStatus(text, kind) { var s = $('status'); s.textContent = text; s.className = 'status' + (kind ? ' ' + kind : ''); }
  function step(i, state) { var li = $('steps').children[i]; if (li) li.className = state; }
  function loadScript(src) {
    return new Promise(function (resolve) { var s = document.createElement('script'); s.src = src; s.onload = function () { resolve(true); }; s.onerror = function () { s.remove(); resolve(false); }; document.head.appendChild(s); });
  }
  function provider() {
    var p = (window.phantom && window.phantom.solana) || window.solana;
    return p && p.isPhantom ? p : null;
  }
  function sendToExtension(msg) {
    return new Promise(function (resolve) {
      var rt = window.chrome && window.chrome.runtime;
      if (!rt || !rt.sendMessage) return resolve({ ok: false, error: 'extension_unreachable' });
      try {
        rt.sendMessage(CFG.extensionId, msg, function (reply) {
          var err = window.chrome.runtime.lastError;
          resolve(err ? { ok: false, error: err.message } : (reply || { ok: false, error: 'no_reply' }));
        });
      } catch (e) { resolve({ ok: false, error: String(e.message || e) }); }
    });
  }
  async function api(method, path, body, jwt) {
    var h = {}; if (body) h['Content-Type'] = 'application/json'; if (jwt) h['Init-Data'] = jwt;
    var r = await fetch(CFG.ipfpsBase + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined });
    var j = {}; try { j = await r.json(); } catch (e) { /* empty */ }
    return { status: r.status, ok: r.ok, body: j };
  }

  var state = { address: null, jwt: sessionStorage.getItem('hearth.bridge.jwt') || null };

  async function connect() {
    var p = provider();
    if (!p) throw Object.assign(new Error('Phantom not found. Install Phantom and switch it to Devnet.'), { code: 'no_wallet' });
    var res = await p.connect();
    state.address = (res && res.publicKey ? res.publicKey : p.publicKey).toString();
    if (sessionStorage.getItem('hearth.bridge.addr') !== state.address) state.jwt = null;
  }
  async function signIn() {
    if (state.jwt) return;
    var n = await api('GET', '/api/auth/nonce?address=' + encodeURIComponent(state.address));
    if (!n.ok) throw Object.assign(new Error('Nonce failed: ' + (n.body.error || n.status)), { code: 'nonce_failed' });
    var message = C.buildSignInMessage(n.body.nonce);
    var signed = await provider().signMessage(new TextEncoder().encode(message), 'utf8');
    var sig = SL.base58Encode(signed.signature || signed);
    var v = await api('POST', '/api/auth/web3/verify', { address: state.address, chain: 'solana', walletName: 'Phantom', message: message, signature: sig, device_id: 'hearthui-bridge', language: 'en' });
    if (!v.ok) throw Object.assign(new Error('Sign-in rejected: ' + (v.body.error || v.status)), { code: 'verify_failed' });
    state.jwt = v.body.token;
    sessionStorage.setItem('hearth.bridge.jwt', state.jwt); sessionStorage.setItem('hearth.bridge.addr', state.address);
  }

  async function buildIxs(sku) {
    var item = C.CATALOG[sku];
    if (item.method === 'usdc') {
      var escrow = new URLSearchParams(location.hash.slice(1)).get('escrow') || CFG.escrow || window.HEARTH_ESCROW_DEVNET;
      if (!escrow || !SL.isPubkey(escrow)) throw Object.assign(new Error('Escrow wallet is not configured yet.'), { code: 'escrow_not_configured' });
      var src = await SL.getAssociatedTokenAddress(state.address, CFG.usdcMint);
      var dst = await SL.getAssociatedTokenAddress(escrow, CFG.usdcMint);
      return [SL.createAtaIdempotentIx({ payer: state.address, ata: dst, owner: escrow, mint: CFG.usdcMint }),
        SL.transferCheckedIx({ source: src, mint: CFG.usdcMint, destination: dst, owner: state.address, amount: item.amount, decimals: CFG.usdcDecimals })];
    }
    var client = window.HearthPassClient;
    if (!client || typeof client.buildBuyPassIx !== 'function') throw Object.assign(new Error('Pass program client not loaded yet.'), { code: 'pass_client_missing' });
    var ix = await client.buildBuyPassIx({ buyer: state.address, sku: sku, rpc: CFG.rpc });
    return [].concat(ix);
  }
  async function sendTx(ixs) {
    var bh = await SL.rpc(CFG.rpc, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
    var msg = SL.compileLegacyMessage({ payer: state.address, recentBlockhash: bh.value.blockhash, instructions: ixs });
    // Phantom request API accepts a base58 serialized legacy message (no web3.js needed).
    var r = await provider().request({ method: 'signAndSendTransaction', params: { message: SL.base58Encode(msg) } });
    var sig = r && (r.signature || r);
    if (typeof sig !== 'string') throw Object.assign(new Error('Wallet returned no signature'), { code: 'no_signature' });
    return sig;
  }
  async function claim(sku, sig) {
    for (var i = 0; i < 10; i++) {
      var r = await api('POST', '/api/hearth/claim', { sku: sku, tx_signature: sig, chain: 'solana-devnet' }, state.jwt);
      if (r.ok) return r.body;
      if (r.status === 404 || r.status === 503 || r.status === 429) { await new Promise(function (x) { setTimeout(x, 3000); }); continue; }
      throw Object.assign(new Error('Claim failed: ' + (r.body.error || r.status) + (r.body.reason ? ' (' + r.body.reason + ')' : '')), { code: r.body.error || 'claim_failed' });
    }
    throw Object.assign(new Error('Claim timed out; HearthUI will retry from on-chain data.'), { code: 'claim_timeout' });
  }

  async function run() {
    var btn = $('go'); btn.disabled = true;
    var cur = 0, action = req.action;
    var mark = function (i) { for (var k = 0; k < i; k++) step(k, 'done'); step(i, 'active'); cur = i; };
    try {
      mark(0); setStatus('Approve the connection in Phantom…'); await connect();
      mark(1); setStatus('Sign the sign-in message (no fee)…');
      try { await signIn(); } catch (e) { if (action === 'signin') throw e; state.jwt = null; }
      if (action === 'signin') {
        mark(2); var rep = await sendToExtension(C.sessionMsg(state.address, state.jwt));
        step(2, 'done');
        setStatus(rep.ok ? 'Signed in. You can close this tab.' : 'Signed in, but HearthUI did not answer (' + rep.error + '). Keep the new tab open and retry.', rep.ok ? 'ok' : 'err');
        return;
      }
      await sendToExtension(C.sessionMsg(state.address, state.jwt));
      mark(2); setStatus('Approve the transaction in Phantom…');
      var sig = await sendTx(await buildIxs(req.sku));
      mark(3); setStatus('Waiting for devnet confirmation…');
      var ex = $('explorer'); ex.href = 'https://explorer.solana.com/tx/' + sig + '?cluster=devnet'; ex.hidden = false;
      await SL.confirmSignature(CFG.rpc, sig, { timeoutMs: 90000 });
      mark(4); setStatus('Unlocking in HearthUI…');
      var reply = await sendToExtension(C.purchaseMsg(req.sku, sig));
      var claimNote = '';
      if (state.jwt) { try { await claim(req.sku, sig); } catch (e) { claimNote = ' Server check pending: ' + e.message; } }
      else claimNote = ' (Not signed in to IPFPS; ownership is read on-chain.)';
      step(4, 'done');
      setStatus((reply.ok ? 'Done! It is unlocked in HearthUI.' : 'Payment confirmed. HearthUI did not answer: ' + reply.error + '.') + claimNote, reply.ok ? 'ok' : 'err');
    } catch (e) {
      step(cur, 'fail');
      var code = (e && (e.code === 4001 || /reject/i.test(e.message))) ? 'user_rejected' : (typeof e.code === 'string' ? e.code : 'failed');
      setStatus(e.message || String(e), 'err');
      await sendToExtension(C.errorMsg(action, String(code), e.message || String(e)));
      btn.disabled = false; btn.textContent = 'Try again';
    }
  }

  async function init() {
    if (useMock) { window.HEARTH_IPFPS_BASE = 'mock'; await loadScript('../mock/ipfps-mock.js'); }
    if (!(await loadScript('vendor/hearth-pass-client.js'))) await loadScript('../program/client/hearth-pass-client.js');
    $('env').textContent = 'Devnet · IPFPS: ' + (window.HEARTH_IPFPS_MOCK_ACTIVE ? 'mock (local)' : CFG.ipfpsBase);
    if (req.error) { setStatus('Invalid link: ' + req.error, 'err'); return; }
    var titles = { signin: 'Sign in with Phantom', pay: 'Support HearthUI', buy: 'Buy theme pass' };
    $('title').textContent = titles[req.action];
    if (req.sku) {
      var s = $('summary'); s.hidden = false;
      s.innerHTML = '<span></span><b></b>';
      s.firstChild.textContent = req.sku; s.lastChild.textContent = C.CATALOG[req.sku].price + ' USDC';
    }
    STEPS[req.action].forEach(function (t) { var li = document.createElement('li'); li.textContent = t; $('steps').appendChild(li); });
    var btn = $('go');
    btn.textContent = req.action === 'signin' ? 'Connect Phantom' : 'Pay ' + C.CATALOG[req.sku].price + ' USDC';
    btn.disabled = false; btn.addEventListener('click', run);
    setStatus(provider() ? 'Ready. Make sure Phantom is on Devnet.' : 'Phantom not detected. Install it, then reload.', provider() ? '' : 'err');
  }
  init();
})();
