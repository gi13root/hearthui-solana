const test = require('node:test');
const assert = require('node:assert');
const L = require('../addon/solana-logic.js');

test('focus payload only for completed focus >= 60s', () => {
  assert.strictEqual(L.focusPayload({ mode: 'break', durationSec: 1500 }), null);
  assert.strictEqual(L.focusPayload({ mode: 'focus', durationSec: 20 }), null);
  assert.deepStrictEqual(L.focusPayload({ durationSec: 1500, endedAt: 1700000000000 }),
    { minutes: 25, ended_at: '2023-11-14T22:13:20.000Z', season: 'focus_2026_10', source: 'hearthui-pomodoro' });
});

test('leaderboard parsing', () => {
  const rows = L.parseLeaderboard({ entries: [{ rank: 2, address: 'BBBBBBBBBBBBBBBB', minutes: 50 }, { rank: 1, display: 'alice', minutes: 90 }] }, 5);
  assert.deepStrictEqual(rows.map(r => [r.rank, r.name, r.minutes]), [[1, 'alice', 90], [2, 'BBBB…BBBB', 50]]);
  assert.deepStrictEqual(L.parseLeaderboard(null, 5), []);
});
