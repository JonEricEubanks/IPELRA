import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from './redirect.js';

test('safeNextPath: accepts a scan path with a code', () => {
  assert.equal(
    safeNextPath('/scan/sponsor-5dfb4c3e-4dab-493b-8e51-24c28aa7da1d?c=4CClcG7jfvNXEp2p'),
    '/scan/sponsor-5dfb4c3e-4dab-493b-8e51-24c28aa7da1d?c=4CClcG7jfvNXEp2p'
  );
});

test('safeNextPath: accepts a scan path without a code', () => {
  assert.equal(safeNextPath('/scan/abc-123'), '/scan/abc-123');
});

test('safeNextPath: rejects absolute URLs and protocol-relative paths (open redirect)', () => {
  assert.equal(safeNextPath('https://evil.example.com/scan/x'), null);
  assert.equal(safeNextPath('//evil.example.com/scan/x'), null);
  assert.equal(safeNextPath('javascript:alert(1)'), null);
});

test('safeNextPath: rejects non-scan in-app paths', () => {
  assert.equal(safeNextPath('/admin/dashboard'), null);
  assert.equal(safeNextPath('/'), null);
});

test('safeNextPath: rejects extra query params, traversal, and junk', () => {
  assert.equal(safeNextPath('/scan/x?c=abc&foo=bar'), null);
  assert.equal(safeNextPath('/scan/../admin'), null);
  assert.equal(safeNextPath(''), null);
  assert.equal(safeNextPath(null), null);
  assert.equal(safeNextPath(42), null);
});
