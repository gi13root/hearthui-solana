const test = require('node:test');
const assert = require('node:assert');
const L = require('../addon/solana-logic.js');

test('focus payload only for completed focus >= 60s', () => {
  assert.strictEqual(L.focusPayload({ mode: 'break', durationSec: 1500 }), null);
  assert.strictEqual(L.focusPayload({ mode: 'focus', durationSec: 20 }), null);
  assert.deepStrictEqual(L.focusPayload({ durationSec: 1500, endedAt: 1700000000000 }),
    { session_id: '00000000-0000-4000-8000-018bcfe56800', minutes: 25, started_at: '2023-11-14T21:48:20.000Z' });
  assert.strictEqual(L.focusPayload({ durationSec: 240, endedAt: 1700000000000 }), null, 'under 5 min rejected by IPFPS');
  assert.strictEqual(L.focusPayload({ durationSec: 7200, endedAt: 1700000000000 }).minutes, 90, 'capped at 90');
});

test('leaderboard parsing', () => {
  const rows = L.parseLeaderboard({ entries: [{ rank: 2, address: 'BBBBBBBBBBBBBBBB', minutes: 50 }, { rank: 1, display: 'alice', minutes: 90 }] }, 5);
  assert.deepStrictEqual(rows.map(r => [r.rank, r.name, r.minutes]), [[1, 'alice', 90], [2, 'BBBB…BBBB', 50]]);
  assert.deepStrictEqual(L.parseLeaderboard(null, 5), []);
  const brief = L.parseLeaderboard({ entries: [{ rank: 1, nickname: 'bob', score: 250 }] }, 5);
  assert.deepStrictEqual(brief.map(r => [r.name, r.minutes]), [['bob', 25]]);
});
