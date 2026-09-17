import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson, cosmosError } from '../test/testUtils.js';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.PASSPORT_LIVE = 'true';
process.env.PASSPORT_LOCK_UTC = '2999-01-01T00:00:00Z';
process.env.COMPLETION_THRESHOLD_POINTS = '300';

// ── In-memory Cosmos + email doubles ─────────────────────────────────────────
const db = {
  sponsor: null,
  attendee: null,
  checkins: [],
  failNextUpsertCheckinWith: null,
  emails: [],
};

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });

mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getSponsorById(id) { return db.sponsor?.id === id ? db.sponsor : null; },
    async getAttendeeById() { return db.attendee; },
    async getCheckinsByAttendee() { return db.checkins; },
    async upsertCheckin(doc) {
      if (db.failNextUpsertCheckinWith) {
        const err = db.failNextUpsertCheckinWith;
        db.failNextUpsertCheckinWith = null;
        throw err;
      }
      const i = db.checkins.findIndex(c => c.id === doc.id);
      if (i >= 0) db.checkins[i] = doc; else db.checkins.push(doc);
      return doc;
    },
    async replaceAttendee(doc) {
      db.attendee = { ...doc, _etag: 'etag-next' };
      return db.attendee;
    },
  },
});

mock.module(import.meta.resolve('../lib/email.js'), {
  namedExports: {
    async sendCompletionEmail(email) { db.emails.push(email); },
  },
});

const { signAttendeeToken } = await import('../lib/auth.js');
await import('./checkin.js');
const checkin = handlers.checkin;
assert.ok(checkin, 'checkin handler should register via app.http');

// ── Helpers ───────────────────────────────────────────────────────────────────
function post(body, { token = signAttendeeToken('a1', 'a@example.com') } = {}) {
  return checkin(fakeRequest({
    method: 'POST',
    url: 'http://localhost/api/checkin',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  }));
}

beforeEach(() => {
  db.sponsor = {
    id: 'sp1', name: 'Acme', isActive: true, tier: 'partnership',
    pointValue: '100', // deliberately a string, as seen in hand-edited Cosmos docs
    promptAnswerKeyword: 'retirement', qrCode: 'QRCODE123',
  };
  db.attendee = {
    id: 'a1', email: 'a@example.com', firstName: 'Ann', totalPoints: 0,
    completedStamps: [], isComplete: false, completedAt: null, _etag: 'etag-0',
  };
  db.checkins = [];
  db.failNextUpsertCheckinWith = null;
  db.emails = [];
});

// ── Auth / validation ─────────────────────────────────────────────────────────
test('checkin: 401 without a bearer token', async () => {
  const { status } = await readJson(await post({ sponsorId: 'sp1', answer: 'x' }, { token: null }));
  assert.equal(status, 401);
});

test('checkin: 400 when answer is missing', async () => {
  const { status, body } = await readJson(await post({ sponsorId: 'sp1' }));
  assert.equal(status, 400);
  assert.match(body.error, /answer/);
});

test('checkin: 404 for an inactive sponsor', async () => {
  db.sponsor.isActive = false;
  const { status } = await readJson(await post({ sponsorId: 'sp1', answer: 'retirement' }));
  assert.equal(status, 404);
});

test('checkin: 409 when the attendee already has the stamp', async () => {
  db.attendee.completedStamps = ['sp1'];
  const { status } = await readJson(await post({ sponsorId: 'sp1', answer: 'retirement' }));
  assert.equal(status, 409);
});

// ── Prompt path ───────────────────────────────────────────────────────────────
test('checkin: correct answer awards numeric points and stamps the sponsor', async () => {
  const { status, body } = await readJson(await post({ sponsorId: 'sp1', answer: 'Retirement!' }));

  assert.equal(status, 200);
  assert.equal(body.correct, true);
  assert.strictEqual(body.pointsAwarded, 100);
  assert.strictEqual(body.totalPoints, 100);
  assert.equal(body.isComplete, false);

  assert.equal(db.checkins.length, 1);
  assert.strictEqual(db.checkins[0].pointsAwarded, 100);
  assert.equal(db.checkins[0].failed, false);
  assert.deepEqual(db.attendee.completedStamps, ['sp1']);
});

test('checkin: wrong answers return 422, count attempts, steer to the table, and reveal a hint on the 3rd', async () => {
  let r = await readJson(await post({ sponsorId: 'sp1', answer: 'nope' }));
  assert.equal(r.status, 422);
  assert.equal(r.body.attemptsUsed, 1);
  assert.equal(r.body.triesUntilHint, 2);
  assert.equal(r.body.hint, null);
  assert.match(r.body.message, /2 more tries before we show a hint/);
  assert.match(r.body.message, /Acme table/, 'always points at the sponsor table');
  assert.doesNotMatch(r.body.message, /remaining|chances/i, 'must not imply a hard cap on guesses');

  r = await readJson(await post({ sponsorId: 'sp1', answer: 'still no' }));
  assert.equal(r.body.attemptsUsed, 2);
  assert.equal(r.body.triesUntilHint, 1);
  assert.match(r.body.message, /One more try before we show a hint/);
  assert.match(r.body.message, /Acme rep/);

  r = await readJson(await post({ sponsorId: 'sp1', answer: 'nah' }));
  assert.equal(r.body.attemptsUsed, 3);
  assert.equal(r.body.triesUntilHint, 0);
  assert.ok(r.body.hint, 'hint should be revealed after the 3rd miss');
  assert.match(r.body.message, /stop by the Acme table/);

  // A 4th try is still allowed (never locked out) and still hints + steers
  r = await readJson(await post({ sponsorId: 'sp1', answer: 'again' }));
  assert.equal(r.status, 422);
  assert.equal(r.body.attemptsUsed, 4);
  assert.ok(r.body.hint);

  // Only one failed-attempt doc exists (unique key per sponsor)
  assert.equal(db.checkins.length, 1);
  assert.deepEqual(db.checkins[0].rejectedAnswers, ['nope', 'still no', 'nah', 'again']);
  assert.equal(db.attendee.totalPoints, 0);
});

test('checkin: a correct answer after misses reuses the failed-attempt doc id', async () => {
  await post({ sponsorId: 'sp1', answer: 'wrong' });
  const failedId = db.checkins[0].id;

  const { status } = await readJson(await post({ sponsorId: 'sp1', answer: 'retirement' }));
  assert.equal(status, 200);
  assert.equal(db.checkins.length, 1);
  assert.equal(db.checkins[0].id, failedId);
  assert.equal(db.checkins[0].failed, false);
  assert.equal(db.checkins[0].attemptCount, 2);
});

// ── Completion ────────────────────────────────────────────────────────────────
test('checkin: crossing the threshold marks complete and sends the completion email', async () => {
  db.attendee.totalPoints = 250;
  const { body } = await readJson(await post({ sponsorId: 'sp1', answer: 'retirement' }));
  assert.equal(body.isComplete, true);
  assert.ok(body.completedAt);
  // fire-and-forget: let the microtask queue drain
  await new Promise(r => setImmediate(r));
  assert.deepEqual(db.emails, ['a@example.com']);
});

// ── Concurrency ───────────────────────────────────────────────────────────────
test('checkin: a unique-key 409 from Cosmos becomes a friendly HTTP 409', async () => {
  db.failNextUpsertCheckinWith = cosmosError(409);
  const { status, body } = await readJson(await post({ sponsorId: 'sp1', answer: 'retirement' }));
  assert.equal(status, 409);
  assert.match(body.error, /already completed/);
  assert.equal(db.attendee.totalPoints, 0, 'attendee must not be credited');
});
