import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.CONFERENCE_YEAR = '2026';

const db = { attendees: [], queriedYear: null };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAllAttendeesForLeaderboard(year) { db.queriedYear = year; return db.attendees; },
  },
});

const { signAttendeeToken } = await import('../lib/auth.js');
await import('./getLeaderboard.js');

function get(query = '', { token = signAttendeeToken('me', 'me@example.com') } = {}) {
  return handlers.getLeaderboard(fakeRequest({
    url: `http://localhost/api/leaderboard${query}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }));
}

const person = (id, points) => ({ id, firstName: `F${id}`, lastName: 'L', totalPoints: points, isComplete: false });

beforeEach(() => {
  // 45 distinct scores, caller ranked 40th
  db.attendees = Array.from({ length: 45 }, (_, i) => person(i === 39 ? 'me' : `p${i}`, 1000 - i));
  db.queriedYear = null;
});

test('getLeaderboard: 401 without a token', async () => {
  const { status } = await readJson(await get('', { token: null }));
  assert.equal(status, 401);
});

test('getLeaderboard: defaults to page 1 of 20 groups for the current year', async () => {
  const { status, body } = await readJson(await get());
  assert.equal(status, 200);
  assert.equal(db.queriedYear, 2026);
  assert.equal(body.page, 1);
  assert.equal(body.groups.length, 20);
  assert.equal(body.totalPages, 3);
  assert.equal(body.totalParticipants, 45);
  assert.equal(body.myRank, 40);
  assert.equal(body.myPage, 2);
});

test('getLeaderboard: ?page=me jumps to the caller\'s page', async () => {
  const { body } = await readJson(await get('?page=me'));
  assert.equal(body.page, 2);
  assert.ok(body.groups.some(g => g.includesCurrentUser));
});

test('getLeaderboard: explicit page and pageSize are honoured; junk page falls back to 1', async () => {
  let { body } = await readJson(await get('?page=3&pageSize=10'));
  assert.equal(body.page, 3);
  assert.equal(body.pageSize, 10);
  assert.equal(body.groups[0].rank, 21);

  ({ body } = await readJson(await get('?page=banana')));
  assert.equal(body.page, 1);
});

test('getLeaderboard: pageSize is capped at 50', async () => {
  const { body } = await readJson(await get('?pageSize=500'));
  assert.equal(body.pageSize, 50);
});

test('getLeaderboard: response never exposes emails or ids', async () => {
  const { body } = await readJson(await get());
  const json = JSON.stringify(body);
  assert.doesNotMatch(json, /@example\.com/);
  assert.doesNotMatch(json, /"id"/);
});
