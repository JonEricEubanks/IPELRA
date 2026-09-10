import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCorrectAnswer, generateHint } from './fuzzyMatch.js';

test('isCorrectAnswer: exact match passes', () => {
  assert.equal(isCorrectAnswer('CivicSuite', 'CivicSuite'), true);
});

test('isCorrectAnswer: keyword contained in a longer answer passes', () => {
  assert.equal(isCorrectAnswer('CivicSuite', 'I think it is called CivicSuite Pro'), true);
});

test('isCorrectAnswer: is case-insensitive and ignores punctuation', () => {
  assert.equal(isCorrectAnswer('CivicSuite', 'civic-suite!'), true);
});

test('isCorrectAnswer: minor typo within 30% Levenshtein tolerance passes', () => {
  // "CivicSuit" vs "CivicSuite" — 1 char edit distance, keyword length 10 -> threshold 3
  assert.equal(isCorrectAnswer('CivicSuite', 'CivicSuit'), true);
});

test('isCorrectAnswer: completely wrong answer fails', () => {
  assert.equal(isCorrectAnswer('CivicSuite', 'banana'), false);
});

test('isCorrectAnswer: multi-word keyword passes when all tokens present out of order', () => {
  assert.equal(isCorrectAnswer('Civic Suite Pro', 'pro civic suite'), true);
});

test('isCorrectAnswer: missing keyword or answer fails', () => {
  assert.equal(isCorrectAnswer('', 'anything'), false);
  assert.equal(isCorrectAnswer('CivicSuite', ''), false);
});

test('generateHint: redacts letters after the first in each word', () => {
  assert.equal(generateHint('CivicSuite Pro'), 'c_________ p__');
});
