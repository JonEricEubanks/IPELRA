import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// auth.js reads these lazily via functions, so set them before importing
process.env.JWT_SECRET   = 'test-secret-do-not-use-in-prod';
process.env.ADMIN_EMAILS = 'admin@example.com, Other.Admin@Example.com';
process.env.EXPORT_SECRET = 'test-export-secret';

const {
  hashToken,
  generateMagicToken,
  signAttendeeToken,
  verifyAttendeeToken,
  signAdminToken,
  requireAdminAuth,
  validateExportSecret,
} = await import('./auth.js');

function fakeRequest(headers = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (name) => map.get(name.toLowerCase()) ?? null } };
}

test('hashToken: is deterministic for the same input', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
});

test('hashToken: different inputs hash differently', () => {
  assert.notEqual(hashToken('abc'), hashToken('abd'));
});

test('generateMagicToken: returns a raw token, its hash, and a ~15 min expiry', () => {
  const { rawToken, tokenHash, expiry } = generateMagicToken();
  assert.equal(tokenHash, hashToken(rawToken));
  const minutesFromNow = (new Date(expiry).getTime() - Date.now()) / 60000;
  assert.ok(minutesFromNow > 14 && minutesFromNow <= 15, `expected ~15 min, got ${minutesFromNow}`);
});

test('signAttendeeToken/verifyAttendeeToken: round-trips attendee id and email', () => {
  const token = signAttendeeToken('att-123', 'Person@Example.com');
  const payload = verifyAttendeeToken(token);
  assert.equal(payload.sub, 'att-123');
  assert.equal(payload.email, 'person@example.com');
});

test('verifyAttendeeToken: throws on a garbage token', () => {
  assert.throws(() => verifyAttendeeToken('not-a-real-token'));
});

test('requireAdminAuth: accepts a valid admin token for an allowlisted email', () => {
  const token = signAdminToken('admin@example.com');
  const result = requireAdminAuth(fakeRequest({ authorization: `Bearer ${token}` }));
  assert.equal(result.email, 'admin@example.com');
});

test('requireAdminAuth: rejects a token for an email not on the allowlist', () => {
  const token = signAdminToken('not-an-admin@example.com');
  assert.throws(() => requireAdminAuth(fakeRequest({ authorization: `Bearer ${token}` })), /Forbidden/);
});

test('requireAdminAuth: rejects a missing Authorization header', () => {
  assert.throws(() => requireAdminAuth(fakeRequest({})), /Not authenticated/);
});

test('validateExportSecret: accepts the correct secret', () => {
  assert.doesNotThrow(() => validateExportSecret(fakeRequest({ 'x-export-secret': 'test-export-secret' })));
});

test('validateExportSecret: rejects an incorrect secret', () => {
  assert.throws(() => validateExportSecret(fakeRequest({ 'x-export-secret': 'wrong' })), /Invalid export secret/);
});
