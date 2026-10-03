import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

const db = { attendee: null };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    attendees: () => ({
      items: {
        query: ({ parameters }) => ({
          fetchAll: async () => ({
            resources: db.attendee?.magicLinkTokens.some(t => t.hash === parameters[0].value) ? [db.attendee] : [],
          }),
        }),
      },
    }),
    async patchAttendee(id, email, fields) { db.attendee = { ...db.attendee, ...fields }; return db.attendee; },
  },
});

const { hashToken } = await import('../lib/auth.js');
await import('./verifyToken.js');
const verify = (token) => handlers.verifyToken(fakeRequest({ url: `http://localhost/api/auth/verify?token=${token}` }));

const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

beforeEach(() => {
  db.attendee = {
    id: 'a1', email: 'ann@example.com', firstName: 'Ann', totalPoints: 0,
    magicLinkTokens: [
      { hash: hashToken('clicked'), expiry: inAnHour() },
      { hash: hashToken('other'),   expiry: inAnHour() },
    ],
  };
});

test('verifyToken: a link opened first by an email scanner still logs the attendee in', async () => {
  const scanner = await readJson(await verify('clicked'));
  assert.equal(scanner.status, 200);
  const person = await readJson(await verify('clicked'));
  assert.equal(person.status, 200);
  assert.ok(person.body.token);
});

test('verifyToken: other pending links are dropped once one is used', async () => {
  await verify('clicked');
  const { status } = await readJson(await verify('other'));
  assert.equal(status, 401);
});

test('verifyToken: a link stops working after 15 opens', async () => {
  for (let i = 0; i < 15; i++) assert.equal((await verify('clicked')).status, 200);
  const { status, body } = await readJson(await verify('clicked'));
  assert.equal(status, 401);
  assert.match(body.error, /already been used/);
});

test('verifyToken: an expired link is rejected', async () => {
  db.attendee.magicLinkTokens[0].expiry = new Date(Date.now() - 1000).toISOString();
  const { status, body } = await readJson(await verify('clicked'));
  assert.equal(status, 401);
  assert.match(body.error, /expired/);
});
