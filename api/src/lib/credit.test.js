import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { cosmosError } from '../test/testUtils.js';

process.env.COMPLETION_THRESHOLD_POINTS = '300';

// ── Mock cosmos.js ────────────────────────────────────────────────────────────
const store = { attendee: null, replaceCalls: [], failNextReplaceWith: null };

mock.module(import.meta.resolve('./cosmos.js'), {
  namedExports: {
    async getAttendeeById() { return store.attendee; },
    async replaceAttendee(doc) {
      store.replaceCalls.push(doc);
      if (store.failNextReplaceWith) {
        const err = store.failNextReplaceWith;
        store.failNextReplaceWith = null;
        throw err;
      }
      store.attendee = { ...doc, _etag: `etag-${store.replaceCalls.length}` };
      return store.attendee;
    },
  },
});

const { creditAttendee } = await import('./credit.js');

function baseAttendee(overrides = {}) {
  return {
    id: 'a1', email: 'a@example.com', totalPoints: 100, completedStamps: ['s0'],
    isComplete: false, completedAt: null, _etag: 'etag-0', ...overrides,
  };
}

beforeEach(() => {
  store.attendee = null;
  store.replaceCalls = [];
  store.failNextReplaceWith = null;
});

test('creditAttendee: adds points, stamps the sponsor, and keeps completedAt null below threshold', async () => {
  const result = await creditAttendee(baseAttendee(), 's1', 100, '2026-10-05T10:00:00Z');
  assert.equal(result.alreadyCompleted, false);
  assert.equal(result.newlyComplete, false);
  assert.equal(result.attendee.totalPoints, 200);
  assert.deepEqual(result.attendee.completedStamps, ['s0', 's1']);
  assert.equal(result.attendee.completedAt, null);
});

test('creditAttendee: coerces string totals/points so they never concatenate', async () => {
  const result = await creditAttendee(baseAttendee({ totalPoints: '0100' }), 's1', '100', 'now');
  assert.equal(result.attendee.totalPoints, 200);
});

test('creditAttendee: marks complete and sets completedAt when crossing the threshold', async () => {
  const result = await creditAttendee(baseAttendee({ totalPoints: 250 }), 's1', 100, 'T');
  assert.equal(result.newlyComplete, true);
  assert.equal(result.attendee.isComplete, true);
  assert.equal(result.attendee.completedAt, 'T');
});

test('creditAttendee: does not reset completedAt for an already-complete attendee', async () => {
  const result = await creditAttendee(
    baseAttendee({ totalPoints: 500, isComplete: true, completedAt: 'EARLIER' }), 's1', 100, 'LATER'
  );
  assert.equal(result.newlyComplete, false);
  assert.equal(result.attendee.completedAt, 'EARLIER');
});

test('creditAttendee: returns alreadyCompleted without writing if the stamp exists', async () => {
  const result = await creditAttendee(baseAttendee(), 's0', 100, 'now');
  assert.equal(result.alreadyCompleted, true);
  assert.equal(store.replaceCalls.length, 0);
});

test('creditAttendee: on a 412 conflict it re-reads and retries with the fresh doc', async () => {
  // Another writer credited s9 (+50) between our read and our write
  store.attendee = baseAttendee({ totalPoints: 150, completedStamps: ['s0', 's9'], _etag: 'etag-fresh' });
  store.failNextReplaceWith = cosmosError(412);

  const result = await creditAttendee(baseAttendee(), 's1', 100, 'now');

  assert.equal(store.replaceCalls.length, 2);
  assert.equal(result.attendee.totalPoints, 250);
  assert.deepEqual(result.attendee.completedStamps, ['s0', 's9', 's1']);
  assert.equal(store.replaceCalls[1]._etag, 'etag-fresh');
});

test('creditAttendee: on a 412 where the re-read already has the stamp, reports alreadyCompleted', async () => {
  store.attendee = baseAttendee({ totalPoints: 200, completedStamps: ['s0', 's1'] });
  store.failNextReplaceWith = cosmosError(412);

  const result = await creditAttendee(baseAttendee(), 's1', 100, 'now');

  assert.equal(result.alreadyCompleted, true);
  assert.equal(store.replaceCalls.length, 1);
});

test('creditAttendee: rethrows non-412 errors', async () => {
  store.failNextReplaceWith = cosmosError(500);
  await assert.rejects(() => creditAttendee(baseAttendee(), 's1', 100, 'now'), { code: 500 });
});
