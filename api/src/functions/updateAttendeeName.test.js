import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

const db = { attendee: null, readArgs: null, patches: [] };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAttendeeById(id, email) { db.readArgs = { id, email }; return db.attendee; },
    async patchAttendee(id, email, fields) { db.patches.push({ id, email, fields }); return { ...db.attendee, ...fields }; },
  },
});

const { signAttendeeToken } = await import('../lib/auth.js');
await import('./updateAttendeeName.js');

function patch(body, { token = signAttendeeToken('a1', 'ann@example.com') } = {}) {
  return handlers.updateAttendeeName(fakeRequest({
    method: 'PATCH',
    url: 'http://localhost/api/attendee/name',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  }));
}

beforeEach(() => {
  db.attendee = { id: 'a1', email: 'ann@example.com', totalPoints: 250, completedStamps: ['sp1'] };
  db.readArgs = null;
  db.patches = [];
});

test('updateAttendeeName: reads by id + email (single-partition) and patches only the name fields', async () => {
  const { status, body } = await readJson(await patch({ firstName: ' Ann ', lastName: 'Lee' }));
  assert.equal(status, 200);
  assert.deepEqual(body, { firstName: 'Ann', lastName: 'Lee' });
  assert.deepEqual(db.readArgs, { id: 'a1', email: 'ann@example.com' });
  assert.deepEqual(db.patches, [{ id: 'a1', email: 'ann@example.com', fields: { firstName: 'Ann', lastName: 'Lee' } }]);
});

test('updateAttendeeName: 400 when a name is missing or too long; nothing written', async () => {
  assert.equal((await patch({ firstName: 'Ann' })).status, 400);
  assert.equal((await patch({ firstName: 'A'.repeat(61), lastName: 'Lee' })).status, 400);
  assert.equal(db.patches.length, 0);
});

test('updateAttendeeName: 401 without a token, 404 for an unknown attendee', async () => {
  assert.equal((await patch({ firstName: 'A', lastName: 'B' }, { token: null })).status, 401);
  db.attendee = null;
  assert.equal((await patch({ firstName: 'A', lastName: 'B' })).status, 404);
});
