import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.PASSPORT_LIVE = 'true';
process.env.CONFERENCE_YEAR = '2026';

const db = { attendees: new Map(), emailFailWith: null, sent: [], allowIp: () => true };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAttendeeByEmail(email) { return db.attendees.get(email) ?? null; },
    async createAttendee(doc) {
      if (db.attendees.has(doc.email)) throw Object.assign(new Error('conflict'), { code: 409 });
      db.attendees.set(doc.email, doc);
      return doc;
    },
    async patchAttendee(id, email, fields) {
      const doc = { ...db.attendees.get(email), ...fields };
      db.attendees.set(email, doc);
      return doc;
    },
  },
});
mock.module(import.meta.resolve('../lib/email.js'), {
  namedExports: {
    async sendMagicLinkEmail(to, rawToken, firstName, next) {
      if (db.emailFailWith) throw db.emailFailWith;
      db.sent.push({ to, rawToken, firstName, next });
      return 'graph:ok';
    },
  },
});
mock.module(import.meta.resolve('../lib/rateLimit.js'), {
  namedExports: { isAllowed: (key) => (key.startsWith('sendMagicLink-ip:') ? db.allowIp(key) : true) },
});

await import('./sendMagicLink.js');
const handler = handlers.sendMagicLink;

function post(body, headers = {}) {
  return handler(fakeRequest({ method: 'POST', url: 'http://localhost/api/auth/sendMagicLink', body, headers }));
}

beforeEach(() => { db.attendees = new Map(); db.emailFailWith = null; db.sent = []; db.allowIp = () => true; });

test('sendMagicLink: a returning attendee keeps their points and stamps (only login fields are touched)', async () => {
  db.attendees.set('ann@example.com', {
    id: 'a1', email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee',
    totalPoints: 250, completedStamps: ['sp1', 'sp2'], isComplete: false, magicLinkTokens: [],
  });
  await post({ email: 'ann@example.com' });
  const stored = db.attendees.get('ann@example.com');
  assert.equal(stored.totalPoints, 250);
  assert.deepEqual(stored.completedStamps, ['sp1', 'sp2']);
  assert.equal(stored.firstName, 'Ann', 'blank name in the request does not erase the saved one');
  assert.equal(stored.magicLinkTokens.length, 1);
});

test('sendMagicLink: new attendees get an id derived from their email (no duplicate docs on double-submit)', async () => {
  await post({ email: 'new@example.com', firstName: 'N', lastName: 'W' });
  const first = db.attendees.get('new@example.com').id;
  db.attendees.clear();
  await post({ email: 'new@example.com', firstName: 'N', lastName: 'W' });
  assert.equal(db.attendees.get('new@example.com').id, first);
});

test('sendMagicLink: 429 once a single source IP exceeds its limit; nothing sent', async () => {
  db.allowIp = (key) => key !== 'sendMagicLink-ip:203.0.113.9';
  const { status } = await readJson(await post({ email: 'ann@example.com' }, { 'x-forwarded-for': '203.0.113.9:51234, 10.0.0.1' }));
  assert.equal(status, 429);
  assert.equal(db.sent.length, 0);
});

test('sendMagicLink: IP key strips ports and brackets; IPv6 and missing header are handled', async () => {
  const seen = [];
  db.allowIp = (key) => { seen.push(key); return true; };
  await post({ email: 'a@example.com' }, { 'x-forwarded-for': '[2001:db8::1]:443' });
  await post({ email: 'b@example.com' }, { 'x-forwarded-for': '2001:db8::2' });
  await post({ email: 'c@example.com' }, { 'x-forwarded-for': '198.51.100.7' });
  await post({ email: 'd@example.com' });
  assert.deepEqual(seen, [
    'sendMagicLink-ip:2001:db8::1',
    'sendMagicLink-ip:2001:db8::2',
    'sendMagicLink-ip:198.51.100.7',
  ], 'no IP header → no IP check (not a shared "null" bucket)');
  assert.equal(db.sent.length, 4);
});

test('sendMagicLink: if a simultaneous request created the attendee first, this one patches instead of failing', async () => {
  const realGet = db.attendees.get.bind(db.attendees);
  let calls = 0;
  // First lookup misses (race window), then the other request's doc appears
  db.attendees.get = (email) => (calls++ === 0 ? undefined : realGet(email));
  db.attendees.set('race@example.com', { id: 'x', email: 'race@example.com', totalPoints: 0, magicLinkTokens: [] });
  const { status } = await readJson(await post({ email: 'race@example.com', firstName: 'R', lastName: 'C' }));
  assert.equal(status, 200);
  const stored = realGet('race@example.com');
  assert.equal(stored.id, 'x');
  assert.equal(stored.firstName, 'R');
  assert.equal(stored.magicLinkTokens.length, 1);
});

test('sendMagicLink: 200 only after the email has actually been accepted by the provider', async () => {
  const { status, body } = await readJson(await post({ email: 'Ann@Example.com', firstName: 'Ann', lastName: 'Lee' }));
  assert.equal(status, 200);
  assert.match(body.message, /on its way/);
  assert.equal(db.sent.length, 1);
  assert.equal(db.sent[0].to, 'ann@example.com');
  const stored = db.attendees.get('ann@example.com');
  assert.equal(stored.magicLinkTokens.length, 1);
  assert.notEqual(stored.magicLinkTokens[0].hash, db.sent[0].rawToken, 'only the hash is stored');
});

test('sendMagicLink: 502 with a user-facing message when every email provider fails (no false "check your inbox")', async () => {
  db.emailFailWith = new Error('Graph sendMail failed (429)');
  const { status, body } = await readJson(await post({ email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee' }));
  assert.equal(status, 502);
  assert.match(body.error, /couldn.t send your login email/i);
  assert.match(body.error, /registration desk/i);
});

test('sendMagicLink: repeated requests keep earlier unexpired tokens (max 5) so any delivered link works', async () => {
  for (let i = 0; i < 7; i++) await post({ email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee' });
  const stored = db.attendees.get('ann@example.com');
  assert.equal(stored.magicLinkTokens.length, 5);
  assert.equal(db.sent.length, 7);
});

test('sendMagicLink: 400 on a malformed email, nothing sent', async () => {
  const { status } = await readJson(await post({ email: 'not-an-email', firstName: 'A', lastName: 'B' }));
  assert.equal(status, 400);
  assert.equal(db.sent.length, 0);
});
