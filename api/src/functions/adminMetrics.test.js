import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET   = 'test-secret-do-not-use-in-prod';
process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.CONFERENCE_YEAR = '2026';
process.env.COMPLETION_THRESHOLD_POINTS = '300';
process.env.PASSPORT_LIVE = 'true';
process.env.PASSPORT_LOCK_UTC = '2999-01-01T00:00:00Z';

const db = { attendees: [], checkins: [], sponsors: [] };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAllAttendees() { return db.attendees; },
    async getAllCheckins()  { return db.checkins; },
    async getAllSponsors()  { return db.sponsors; },
  },
});

const { signAdminToken, signAttendeeToken } = await import('../lib/auth.js');
await import('./adminMetrics.js');

const ADMIN = `Bearer ${signAdminToken('admin@example.com')}`;

function get(auth = ADMIN) {
  return handlers.adminMetrics(fakeRequest({
    url: 'http://localhost/api/mgmt/metrics',
    headers: auth ? { Authorization: auth } : {},
  }));
}

function ok(attendeeId, sponsorId, sponsorName, points, timestamp, extra = {}) {
  return { id: `${attendeeId}-${sponsorId}`, attendeeId, attendeeEmail: `${attendeeId}@x.com`, sponsorId, sponsorName, pointsAwarded: points, timestamp, failed: false, ...extra };
}

beforeEach(() => {
  db.sponsors = [
    { id: 'sp1', name: 'Acme',  tier: 'partnership', pointValue: 100, isActive: true },
    { id: 'sp2', name: 'Bravo', tier: 'leadership',  pointValue: 150, isActive: true },
    { id: 'sp3', name: 'Ghost', tier: 'partnership', pointValue: 100, isActive: true },
    { id: 'sp4', name: 'Old',   tier: 'partnership', pointValue: 100, isActive: false },
  ];
  db.attendees = [
    // complete
    { id: 'a1', email: 'a1@x.com', firstName: 'Ann', lastName: 'Lee', totalPoints: 350, isComplete: true, completedAt: '2026-10-05T16:05:00Z', completedStamps: ['sp1', 'sp2', 'sp3'] },
    // one stop away (200 + 150 Bravo remaining >= 300)
    { id: 'a2', email: 'a2@x.com', firstName: 'Bob', lastName: null, totalPoints: 200, isComplete: false, completedStamps: ['sp1', 'sp3'] },
    // started
    { id: 'a3', email: 'a3@x.com', firstName: null, lastName: null, totalPoints: 100, isComplete: false, completedStamps: ['sp1'] },
    // registered, nothing yet
    { id: 'a4', email: 'a4@x.com', firstName: 'Dee', lastName: 'Kay', totalPoints: 0, isComplete: false, completedStamps: [] },
  ];
  db.checkins = [
    ok('a1', 'sp1', 'Acme',  100, '2026-10-05T14:10:00Z'),
    ok('a1', 'sp2', 'Bravo', 150, '2026-10-05T14:40:00Z'),
    ok('a1', 'sp3', 'Ghost', 100, '2026-10-05T16:05:00Z'),
    ok('a2', 'sp1', 'Acme',  100, '2026-10-05T14:20:00Z'),
    ok('a2', 'sp3', 'Ghost', 100, '2026-10-05T16:30:00Z', { manualCredit: true }),
    ok('a3', 'sp1', 'Acme',  100, '2026-10-05T14:50:00Z'),
    // a3 burned all attempts on Bravo; a4 has one wrong answer on Acme
    { id: 'f1', attendeeId: 'a3', attendeeEmail: 'a3@x.com', sponsorId: 'sp2', sponsorName: 'Bravo', failed: true, attemptCount: 3, timestamp: '2026-10-05T15:00:00Z' },
    { id: 'f2', attendeeId: 'a4', attendeeEmail: 'a4@x.com', sponsorId: 'sp1', sponsorName: 'Acme',  failed: true, attemptCount: 1, timestamp: '2026-10-05T15:10:00Z' },
  ];
});

test('metrics: 403 without an admin token, and for an attendee token', async () => {
  assert.equal((await readJson(await get(null))).status, 403);
  assert.equal((await readJson(await get(`Bearer ${signAttendeeToken('a1', 'a1@x.com')}`))).status, 403);
});

test('metrics: totals distinguish registered / active / completed and count real activity', async () => {
  const { status, body } = await readJson(await get());
  assert.equal(status, 200);
  assert.equal(body.totals.registeredAttendees, 4);
  assert.equal(body.totals.activeAttendees, 3, 'attendees with ≥1 stamp');
  assert.equal(body.totals.completedPassports, 1);
  assert.equal(body.totals.totalCheckins, 6, 'failed docs are not check-ins');
  assert.equal(body.totals.failedAttempts, 2);
  assert.equal(body.totals.manualCredits, 1);
  assert.equal(body.totals.activeSponsors, 3);
  assert.equal(body.totals.totalSponsors, 4);
  assert.equal(body.completionRate, 25);
});

test('metrics: almostThere counts attendees exactly one stop from the threshold', async () => {
  const { body } = await readJson(await get());
  // a2 (200 + Bravo 150) qualifies; a3 (100 + 150 = 250) does not; a4 does not; a1 is complete
  assert.equal(body.totals.almostThere, 1);
});

test('metrics: sponsors includes every sponsor (even zero check-ins) sorted by count, with stuck counts', async () => {
  const { body } = await readJson(await get());
  assert.deepEqual(body.sponsors.map(s => s.sponsorName), ['Acme', 'Ghost', 'Bravo', 'Old']);
  const bravo = body.sponsors.find(s => s.sponsorId === 'sp2');
  assert.equal(bravo.checkinCount, 1);
  assert.equal(bravo.stuckAttendees, 1, 'a3 used all 3 attempts');
  const old = body.sponsors.find(s => s.sponsorId === 'sp4');
  assert.equal(old.checkinCount, 0);
  assert.equal(old.isActive, false);
  assert.deepEqual(body.needsAttention, [{ sponsorId: 'sp2', sponsorName: 'Bravo', stuckAttendees: 1 }]);
});

test('metrics: contentIssues flags placeholder text in ACTIVE sponsors only', async () => {
  db.sponsors[0].promptQuestion = 'What does [Company Name] do?';   // active → flagged
  db.sponsors[3].promptQuestion = 'What does [Company Name] do?';   // inactive → ignored
  const { body } = await readJson(await get());
  assert.equal(body.contentIssues.length, 1);
  assert.equal(body.contentIssues[0].sponsorId, 'sp1');
  assert.match(body.contentIssues[0].issue, /bracketed placeholder/);
});

test('metrics: hourly buckets are contiguous UTC hours with zero-fill', async () => {
  const { body } = await readJson(await get());
  assert.deepEqual(body.hourly, [
    { hour: '2026-10-05T14:00:00.000Z', count: 4 },
    { hour: '2026-10-05T15:00:00.000Z', count: 0 },
    { hour: '2026-10-05T16:00:00.000Z', count: 2 },
  ]);
});

test('metrics: funnel covers 0..activeSponsors stops', async () => {
  const { body } = await readJson(await get());
  assert.deepEqual(body.funnel, [
    { stops: 0, count: 1 },
    { stops: 1, count: 1 },
    { stops: 2, count: 1 },
    { stops: 3, count: 1 },
  ]);
});

test('metrics: recent check-ins are newest first with display names and manual flag', async () => {
  const { body } = await readJson(await get());
  assert.equal(body.recentCheckins[0].sponsorName, 'Ghost');
  assert.equal(body.recentCheckins[0].attendeeName, 'Bob', 'first name only when last is missing');
  assert.equal(body.recentCheckins[0].manualCredit, true);
  assert.equal(body.recentCheckins.find(c => c.attendeeEmail === 'a3@x.com').attendeeName, 'a3@x.com', 'falls back to email');
  assert.equal(body.recentCompletions[0].name, 'Ann Lee');
});

test('metrics: passport block reflects env config', async () => {
  const { body } = await readJson(await get());
  assert.deepEqual(body.passport, {
    live: true, closed: false, lockUtc: '2999-01-01T00:00:00Z', threshold: 300, conferenceYear: 2026,
  });
});

test('metrics: empty conference returns zeros, not NaN or crashes', async () => {
  db.attendees = []; db.checkins = []; db.sponsors = [];
  const { status, body } = await readJson(await get());
  assert.equal(status, 200);
  assert.equal(body.completionRate, 0);
  assert.deepEqual(body.hourly, []);
  assert.deepEqual(body.funnel, [{ stops: 0, count: 0 }]);
  assert.equal(body.totals.almostThere, 0);
});
