import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLeaderboard } from './leaderboard.js';

const a = (id, firstName, totalPoints, extra = {}) => ({ id, firstName, lastName: 'Lee', totalPoints, isComplete: false, ...extra });

test('buildLeaderboard: ties share a rank and the next rank skips ahead (1, 2, 2, 4)', () => {
  const lb = buildLeaderboard([a('1', 'Ann', 300), a('2', 'Bo', 200), a('3', 'Cy', 200), a('4', 'Di', 100)], '3');
  assert.deepEqual(lb.groups.map(g => [g.rank, g.points, g.count]), [[1, 300, 1], [2, 200, 2], [4, 100, 1]]);
  assert.equal(lb.myRank, 2);
  assert.equal(lb.myTiedWith, 1);
  assert.equal(lb.totalParticipants, 4);
});

test('buildLeaderboard: the caller is listed first inside their tie group', () => {
  const lb = buildLeaderboard([a('1', 'Ann', 0), a('2', 'Bo', 0), a('3', 'Zed', 0)], '3');
  const g = lb.groups[0];
  assert.equal(g.includesCurrentUser, true);
  assert.equal(g.members[0].firstName, 'Zed');
  assert.equal(g.members[0].isCurrentUser, true);
});

test('buildLeaderboard: no 200 cap \u2014 everyone counts, and page=me finds a low-ranked caller', () => {
  const people = Array.from({ length: 260 }, (_, i) => a(`p${i}`, `P${i}`, 1000 - i));
  const lb = buildLeaderboard(people, 'p250', 'me', 20);
  assert.equal(lb.totalParticipants, 260);
  assert.equal(lb.totalPages, 13);
  assert.equal(lb.myRank, 251);
  assert.equal(lb.myPage, 13);
  assert.equal(lb.page, 13);
  assert.ok(lb.groups.some(g => g.includesCurrentUser));
});

test('buildLeaderboard: pages hold whole tie groups and clamp out-of-range pages', () => {
  const people = [a('1', 'A', 50), ...Array.from({ length: 30 }, (_, i) => a(`t${i}`, `T${i}`, 10)), a('z', 'Z', 0)];
  const p1 = buildLeaderboard(people, '1', 1, 2);
  assert.deepEqual(p1.groups.map(g => g.count), [1, 30]);
  assert.equal(p1.totalPages, 2);
  const p9 = buildLeaderboard(people, '1', 9, 2);
  assert.equal(p9.page, 2);
  assert.equal(p9.groups[0].rank, 32);
});

test('buildLeaderboard: huge ties only list up to 50 names but report the true count', () => {
  const people = Array.from({ length: 120 }, (_, i) => a(`p${i}`, `P${i}`, 0));
  const g = buildLeaderboard(people, 'p0').groups[0];
  assert.equal(g.count, 120);
  assert.equal(g.members.length, 50);
});

test('buildLeaderboard: nameless attendees are not ranked; string points are coerced', () => {
  const lb = buildLeaderboard([a('1', 'Ann', '150'), a('2', null, 999)], '2');
  assert.equal(lb.totalParticipants, 1);
  assert.equal(lb.groups[0].points, 150);
  assert.equal(lb.myRank, null);
  assert.equal(lb.myPage, null);
});
