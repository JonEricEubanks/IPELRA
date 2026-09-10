import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidQrCode } from './qr.js';

test('isValidQrCode: matches identical codes', () => {
  assert.equal(isValidQrCode('abc123XYZ', 'abc123XYZ'), true);
});

test('isValidQrCode: rejects a different code of the same length', () => {
  assert.equal(isValidQrCode('abc123XYZ', 'abc123XYA'), false);
});

test('isValidQrCode: rejects a code of a different length', () => {
  assert.equal(isValidQrCode('abc123XYZ', 'abc123'), false);
});

test('isValidQrCode: rejects when the sponsor has no code configured', () => {
  assert.equal(isValidQrCode(undefined, 'abc'), false);
  assert.equal(isValidQrCode(null, 'abc'), false);
  assert.equal(isValidQrCode('', 'abc'), false);
});

test('isValidQrCode: rejects empty or non-string submissions', () => {
  assert.equal(isValidQrCode('abc', ''), false);
  assert.equal(isValidQrCode('abc', null), false);
  assert.equal(isValidQrCode('abc', 123), false);
});
