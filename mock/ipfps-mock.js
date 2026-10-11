/* In-browser mock of the IPFPS endpoints HearthUI uses (see docs/CONTRACT.md + friend brief).
 * Owner: A1. Same request/response shapes and error codes; state persisted in localStorage.
 * Browser: loading this file installs window.fetch shim for HEARTH_IPFPS_BASE (default https://heartui.ipfps.org)
 *          when window.HEARTH_IPFPS_BASE === 'mock'. Node: module.exports.createMockFetch({storage}). */
(function (root) {
  'use strict';
  var KEY = 'hearth.ipfps.mock.v1';
  var CATALOG = { supporter: { price: '4.99', source: 'usdc' }, theme_aurora: { price: '1.99', source: 'pass' },
    theme_dune: { price: '1.99', source: 'pass' }, icons_glass: { price: '2.99', source: 'pass' } };
  var B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

  function b58dec(s) {
    var A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    if (typeof s !== 'string' || !B58.test(s)) return null;
    var z = 0; while (s[z] === '1') z++;
    var b = [];
    for (var i = z; i < s.length; i++) { var c = A.indexOf(s[i]); for (var j = 0; j < b.length; j++) { c += b[j] * 58; b[j] = c & 255; c >>= 8; } while (c) { b.push(c & 255); c >>= 8; } }
    var o = new Uint8Array(z + b.length); for (var k = 0; k < b.length; k++) o[o.length - 1 - k] = b[k]; return o;
  }
  function uuid() { var c = globalThis.crypto; return c.randomUUID ? c.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
  function b64u(s) { return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); return typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); }

  async function edVerify(pub, sig, msg) {
    try {
      var s = globalThis.crypto.subtle;
      var key = await s.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
      return await s.verify({ name: 'Ed25519' }, key, sig, msg);
    } catch (e) { return 'unsupported'; } // older browsers without WebCrypto Ed25519: mock accepts
  }

  function createMockFetch(opts) {
    opts = opts || {};
    var storage = opts.storage, realFetch = opts.realFetch, base = (opts.base || 'https://heartui.ipfps.org').replace(/\/$/, '');
    function load() { try { return JSON.parse(storage.getItem(KEY)) || null; } catch (e) { return null; } }
    var db = load() || { users: {}, byAddress: {}, nonces: {}, txUsed: {}, focus: {} };
    function save() { storage.setItem(KEY, JSON.stringify(db)); }
    function res(status, body) {
      var text = JSON.stringify(body);
      return { ok: status >= 200 && status < 300, status: status, headers: { get: function () { return 'application/json'; } },
        json: async function () { return JSON.parse(text); }, text: async function () { return text; } };
    }
    function auth(headers) {
      var t = headers && (headers['Init-Data'] || headers['init-data'] || (headers.get && headers.get('Init-Data')));
      if (!t || t.indexOf('mock.') !== 0) return null;
      try { var c = JSON.parse(unb64u(t.split('.')[1])); return db.users[c.sub] || null; } catch (e) { return null; }
    }
    function rankOf(u) {
      var list = Object.values(db.users).sort(function (a, b) { return b.focus_xp - a.focus_xp; });
      return list.indexOf(u) + 1;
    }

    var routes = {
      'GET /api/auth/nonce': async function (q) {
        var a = q.get('address'); var b = b58dec(a);
        if (!b || b.length !== 32) return res(400, { error: 'invalid solana public key format' });
        var n = uuid(); db.nonces[a] = { nonce: n, exp: Date.now() + 5 * 60000 }; save();
        return res(200, { nonce: n });
      },
      'POST /api/auth/web3/verify': async function (q, body, h) {
        var pub = b58dec(body.address), sig = b58dec(body.signature);
        if (!pub || pub.length !== 32) return res(400, { error: 'invalid solana public key format' });
        if (!sig || sig.length !== 64) return res(400, { error: 'invalid signature format' });
        if (!String(body.chain || '').startsWith('solana')) return res(400, { error: 'unsupported blockchain network' });
        if (typeof body.message !== 'string' || body.message.length > 500) return res(400, { error: 'input data exceeds size limits' });
        var n = db.nonces[body.address];
        if (!n || n.exp < Date.now()) return res(401, { error: 'invalid or expired authentication request' });
        if (body.message.indexOf(n.nonce) < 0) return res(401, { error: 'message does not contain the required nonce payload' });
        var ok = await edVerify(pub, sig, new TextEncoder().encode(body.message));
        delete db.nonces[body.address]; save();
        if (ok === false) return res(401, { error: 'invalid cryptographic signature' });
        var isNew = !db.byAddress[body.address];
        if (isNew) {
          var id = uuid();
          db.users[id] = { id: id, address: body.address, nickname: body.address.slice(0, 4) + '…' + body.address.slice(-4), owned: [], focus_xp: 0 };
          db.byAddress[body.address] = id;
        }
        save();
        var token = 'mock.' + b64u(JSON.stringify({ sub: db.byAddress[body.address], app_slug: 'heartui', iat: Date.now() })) + '.sig';
        return res(200, { token: token, is_new_user: isNew });
      },
      'GET /api/user/me': async function (q, b, h, u) {
        return res(200, { id: u.id, telegram_id: null, username: u.address, nickname: u.nickname, photo_url: '', balance_wp: 0, balance_rub: 0,
          balances: {}, language: 'en', season_xp: u.focus_xp, current_season: '2026_10',
          level_info: { current_level: 1, current_xp: u.focus_xp, level_start_xp: 0, next_level_xp: 1000, progress_percent: Math.min(100, u.focus_xp / 10) },
          bonuses: { multiplier: 1, faucet: { nextAvailableAt: 0, baseReward: 0 }, streak: { currentDay: 0, nextAvailableAt: 0, expiresAt: 0 } },
          level_rewards: [], projects: [], has_password: false, is_ftue_completed: true });
      },
      'GET /api/hearth/owned': async function (q, b, h, u) { return res(200, { owned: u.owned, catalog_version: 1 }); },
      'POST /api/hearth/claim': async function (q, body, h, u) {
        var item = CATALOG[body.sku];
        if (!item) return res(400, { error: 'unknown_sku' });
        var sig = b58dec(body.tx_signature);
        if (!sig || sig.length !== 64) return res(400, { error: 'invalid_signature_format' });
        var have = u.owned.filter(function (o) { return o.sku === body.sku; })[0];
        if (have) return res(200, { status: 'granted', entitlement: have });
        if (db.txUsed[body.tx_signature]) return res(409, { error: 'tx_already_used' });
        var ent = { sku: body.sku, source: item.source, tx_signature: body.tx_signature, amount: item.price, token: 'USDC', granted_at: new Date().toISOString() };
        u.owned.push(ent); db.txUsed[body.tx_signature] = u.id; save();
        return res(200, { status: 'granted', entitlement: ent });
      },
      'POST /api/hearth/focus': async function (q, body, h, u) {
        var key = u.id + ':' + body.session_id;
        if (db.focus[key]) return res(200, db.focus[key].resp);
        var m = body.minutes, start = Date.parse(body.started_at);
        if (!Number.isInteger(m) || m < 5 || m > 90 || isNaN(start)) return res(400, { error: 'invalid_minutes' });
        var end = start + m * 60000;
        if (Date.now() < end) return res(422, { error: 'too_early' });
        var mine = Object.keys(db.focus).filter(function (k) { return k.indexOf(u.id + ':') === 0; }).map(function (k) { return db.focus[k]; });
        if (mine.some(function (s) { return start < s.end && s.start < end; })) return res(409, { error: 'overlapping_session' });
        var day = Date.now() - 864e5;
        var today = mine.filter(function (s) { return s.start > day; }).reduce(function (a, s) { return a + s.minutes; }, 0);
        if (today + m > 16 * 60) return res(429, { error: 'daily_cap' });
        u.focus_xp += m * 10;
        var resp = { xp_added: m * 10, season_xp: u.focus_xp, rank: rankOf(u) };
        db.focus[key] = { start: start, end: end, minutes: m, resp: resp }; save();
        return res(200, resp);
      },
      'GET /api/leaderboard': async function (q) {
        // Real field names per brief: nickname, score, rank. Wrapper key `entries` is an ASSUMPTION until IPFPS confirms.
        var lim = Math.max(1, Math.min(100, parseInt(q.get('limit'), 10) || 10));
        var list = Object.values(db.users).filter(function (u) { return u.focus_xp > 0; }).sort(function (a, b) { return b.focus_xp - a.focus_xp; }).slice(0, lim);
        return res(200, { season: q.get('season') || 'focus_2026_10', entries: list.map(function (u, i) { return { rank: i + 1, nickname: u.nickname, score: u.focus_xp }; }) });
      },
    };
    var PUBLIC = { 'GET /api/auth/nonce': 1, 'POST /api/auth/web3/verify': 1, 'GET /api/leaderboard': 1 };

    return async function mockFetch(input, init) {
      var url = typeof input === 'string' ? input : input.url;
      var u; try { u = new URL(url, base + '/'); } catch (e) { u = null; }
      if (!u || u.origin !== new URL(base).origin || u.pathname.indexOf('/api/') !== 0) {
        if (realFetch) return realFetch(input, init);
        throw new Error('mock: no real fetch for ' + url);
      }
      init = init || {};
      var route = (init.method || 'GET').toUpperCase() + ' ' + u.pathname;
      var fn = routes[route];
      if (!fn) return res(404, { error: 'not_found' });
      var body = {}; try { body = init.body ? JSON.parse(init.body) : {}; } catch (e) { return res(400, { error: 'invalid_json' }); }
      db = load() || db;
      var user = auth(init.headers || {});
      if (!PUBLIC[route] && !user) return res(401, { error: 'unauthorized' });
      return fn(u.searchParams, body, init.headers || {}, user);
    };
  }

  var api = { createMockFetch: createMockFetch, STORAGE_KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.HearthIpfpsMock = api;
  if (root.HEARTH_IPFPS_BASE === 'mock' && root.fetch && root.localStorage) {
    root.fetch = createMockFetch({ storage: root.localStorage, realFetch: root.fetch.bind(root) });
    root.HEARTH_IPFPS_MOCK_ACTIVE = true;
  }
})(typeof window !== 'undefined' ? window : globalThis);
