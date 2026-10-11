'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../bridge/bridge-core.js');

test('parseHash accepts valid actions and skus', () => {
  assert.deepEqual(C.parseHash('#action=signin'), { action: 'signin', sku: null });
  assert.deepEqual(C.parseHash('#action=pay&sku=supporter'), { action: 'pay', sku: 'supporter' });
  assert.deepEqual(C.parseHash('action=buy&sku=theme_aurora'), { action: 'buy', sku: 'theme_aurora' });
});

test('parseHash rejects bad input', () => {
  assert.equal(C.parseHash('').error, 'missing_action');
  assert.equal(C.parseHash('#action=steal').error, 'unknown_action');
  assert.equal(C.parseHash('#action=pay').error, 'missing_sku');
  assert.equal(C.parseHash('#action=pay&sku=theme_aurora').error, 'wrong_method');
  assert.equal(C.parseHash('#action=buy&sku=supporter').error, 'wrong_method');
  assert.equal(C.parseHash('#action=buy&sku=nope').error, 'unknown_sku');
});

test('sign-in message format matches brief F2', () => {
  const m = C.buildSignInMessage('abc-123', new Date('2026-10-12T01:02:03.456Z'));
  assert.equal(m, 'Sign in to HearthUI (heartui.ipfps.org)\n\nNonce: abc-123\nIssued At: 2026-10-12T01:02:03Z');
  assert.ok(m.length <= 500);
});

test('catalog prices in base units', () => {
  assert.equal(C.CATALOG.supporter.amount, 4990000n);
  assert.equal(C.CATALOG.theme_aurora.method, 'pass');
});

test('message builders produce contract-shaped messages', () => {
  assert.deepEqual(C.sessionMsg('Addr', 'jwt'), { v: 1, type: 'session', address: 'Addr', jwt: 'jwt', network: 'devnet' });
  assert.deepEqual(C.purchaseMsg('supporter', 'sig'), { v: 1, type: 'purchase', sku: 'supporter', method: 'usdc', tx_signature: 'sig', status: 'confirmed' });
  assert.deepEqual(C.errorMsg('pay', 'rejected', 'x'), { v: 1, type: 'error', action: 'pay', code: 'rejected', message: 'x' });
});
