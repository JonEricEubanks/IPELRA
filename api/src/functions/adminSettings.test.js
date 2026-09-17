import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { captureHandlers, fakeRequest, readJson } from '../test/testUtils.js';

process.env.JWT_SECRET   = 'test-secret-do-not-use-in-prod';
process.env.ADMIN_EMAILS = 'admin@example.com';

const db = { sponsors: new Map() };

const { namedExports: functionsMock, handlers } = captureHandlers();
mock.module('@azure/functions', { namedExports: functionsMock });

mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAllSponsors() { return [...db.sponsors.values()]; },
    async getSponsorById(id) { return db.sponsors.get(id) ?? null; },
    async upsertSponsor(doc) { db.sponsors.set(doc.id, doc); return doc; },
    async deleteSponsor(id) { db.sponsors.delete(id); },
  },
});

const { signAdminToken } = await import('../lib/auth.js');
await import('./adminSettings.js');

const ADMIN = `Bearer ${signAdminToken('admin@example.com')}`;

function patch(id, body, auth = ADMIN) {
  return handlers.adminPatchSponsor(fakeRequest({
    method: 'PATCH',
    url: `http://localhost/api/mgmt/sponsors/${id}`,
    headers: auth ? { Authorization: auth } : {},
    params: { id },
    body,
  }));
}

function create(body) {
  return handlers.adminCreateSponsor(fakeRequest({
    method: 'POST',
    url: 'http://localhost/api/mgmt/sponsors',
    headers: { Authorization: ADMIN },
    body,
  }));
}

beforeEach(() => {
  db.sponsors = new Map([['sp1', {
    id: 'sp1', name: 'Acme', tier: 'partnership', pointValue: 100,
    promptQuestion: 'Q?', promptAnswerKeyword: 'ans', isActive: false, displayOrder: 10,
  }]]);
});

test('PATCH sponsor: 403 without an admin token', async () => {
  const { status } = await readJson(await patch('sp1', { isActive: true }, null));
  assert.equal(status, 403);
});

test('PATCH sponsor: 403 for an attendee token', async () => {
  const { signAttendeeToken } = await import('../lib/auth.js');
  const { status } = await readJson(await patch('sp1', { isActive: true }, `Bearer ${signAttendeeToken('a1', 'a@x.com')}`));
  assert.equal(status, 403);
});

test('PATCH sponsor: 404 for unknown id', async () => {
  const { status } = await readJson(await patch('nope', { isActive: true }));
  assert.equal(status, 404);
});

test('PATCH sponsor: toggles isActive and leaves other fields intact', async () => {
  const { status, body } = await readJson(await patch('sp1', { isActive: true }));
  assert.equal(status, 200);
  assert.equal(body.sponsor.isActive, true);
  assert.equal(body.sponsor.name, 'Acme');
  assert.equal(body.sponsor.pointValue, 100);
});

test('PATCH sponsor: coerces a string pointValue to a number before storing', async () => {
  const { status, body } = await readJson(await patch('sp1', { pointValue: '150' }));
  assert.equal(status, 200);
  assert.strictEqual(body.sponsor.pointValue, 150);
  assert.strictEqual(db.sponsors.get('sp1').pointValue, 150);
});

test('PATCH sponsor: coerces displayOrder to a number', async () => {
  const { body } = await readJson(await patch('sp1', { displayOrder: '3' }));
  assert.strictEqual(body.sponsor.displayOrder, 3);
});

test('PATCH sponsor: rejects a negative or non-numeric pointValue', async () => {
  let r = await readJson(await patch('sp1', { pointValue: 'lots' }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /pointValue/);

  r = await readJson(await patch('sp1', { pointValue: -5 }));
  assert.equal(r.status, 400);
  assert.equal(db.sponsors.get('sp1').pointValue, 100, 'nothing written on validation failure');
});

test('PATCH sponsor: rejects an unknown tier and a non-boolean isActive', async () => {
  let r = await readJson(await patch('sp1', { tier: 'gold' }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /tier/);

  r = await readJson(await patch('sp1', { isActive: 'yes' }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /isActive/);
});

test('PATCH sponsor: rejects blanking a required field', async () => {
  const { status, body } = await readJson(await patch('sp1', { name: '   ' }));
  assert.equal(status, 400);
  assert.match(body.error, /name/);
});

test('PATCH sponsor: ignores fields outside the allowlist (e.g. id, qrCode)', async () => {
  const { body } = await readJson(await patch('sp1', { id: 'hacked', qrCode: 'leak', tagline: 'New' }));
  assert.equal(body.sponsor.id, 'sp1');
  assert.equal(body.sponsor.qrCode, undefined);
  assert.equal(body.sponsor.tagline, 'New');
});

test('POST sponsor: defaults pointValue from tier and stores a number', async () => {
  const { status, body } = await readJson(await create({
    name: 'New Co', tier: 'leadership', promptQuestion: 'Q', promptAnswerKeyword: 'A',
  }));
  assert.equal(status, 201);
  assert.strictEqual(body.sponsor.pointValue, 150);
  assert.equal(body.sponsor.isActive, false);
});
