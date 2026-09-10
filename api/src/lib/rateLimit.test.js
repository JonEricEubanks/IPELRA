import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, _resetForTests } from './rateLimit.js';

beforeEach(() => {
  _resetForTests();
});

test('isAllowed: allows requests up to the max, then blocks', () => {
  const key = 'test-key-1';
  for (let i = 0; i < 5; i++) {
    assert.equal(isAllowed(key), true, `attempt ${i + 1} should be allowed`);
  }
  assert.equal(isAllowed(key), false, '6th attempt within the window should be blocked');
});

test('isAllowed: different keys have independent buckets', () => {
  for (let i = 0; i < 5; i++) assert.equal(isAllowed('key-a'), true);
  assert.equal(isAllowed('key-a'), false);
  // key-b has never been used, so it should still be allowed
  assert.equal(isAllowed('key-b'), true);
});

test('isAllowed: resets after the window elapses', () => {
  const key = 'test-key-window';
  assert.equal(isAllowed(key, { windowMs: 10, maxAttempts: 1 }), true);
  assert.equal(isAllowed(key, { windowMs: 10, maxAttempts: 1 }), false);
  // Force the bucket to look expired by waiting past the tiny window
  const start = Date.now();
  while (Date.now() - start < 15) { /* busy-wait past the 10ms window */ }
  assert.equal(isAllowed(key, { windowMs: 10, maxAttempts: 1 }), true);
});
