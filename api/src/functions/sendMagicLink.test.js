import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.PASSPORT_LIVE = 'true';
process.env.CONFERENCE_YEAR = '2026';

const db = { attendees: new Map(), emailFailWith: null, sent: [] };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAttendeeByEmail(email) { return db.attendees.get(email) ?? null; },
    async upsertAttendee(doc) { db.attendees.set(doc.email, doc); return doc; },
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
mock.module(import.meta.resolve('../lib/rateLimit.js'), { namedExports: { isAllowed: () => true } });

await import('./sendMagicLink.js');
const handler = handlers.sendMagicLink;

function post(body) {
  return handler(fakeRequest({ method: 'POST', url: 'http://localhost/api/auth/sendMagicLink', body }));
}

beforeEach(() => { db.attendees = new Map(); db.emailFailWith = null; db.sent = []; });

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
