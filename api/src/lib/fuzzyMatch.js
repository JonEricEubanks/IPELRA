/**
 * fuzzyMatch.js — Answer validation with keyword containment + Levenshtein distance
 *
 * Rules:
 * 1. Normalize both strings (lowercase, strip punctuation, trim whitespace)
 * 2. Keyword containment: pass if the keyword appears anywhere in the answer
 * 3. If keyword is ≥ 4 characters: pass if Levenshtein distance ≤ 30% of keyword length
 * 4. Otherwise: reject
 *
 * This tolerates minor typos ("CivicSuit" for "CivicSuite") while preventing
 * completely wrong answers from passing.
 */

import levenshtein from 'fast-levenshtein';

/**
 * Normalizes a string for comparison.
 * Lowercases, trims, and removes non-alphanumeric characters (preserves spaces).
 */
function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Returns true if the provided answer matches the keyword.
 *
 * @param {string} keyword - The sponsor's answer keyword (from Cosmos)
 * @param {string} answer  - The attendee's submitted answer
 * @returns {boolean}
 */
export function isCorrectAnswer(keyword, answer) {
  if (!keyword || !answer) return false;

  const normKeyword = normalize(keyword);
  const normAnswer  = normalize(answer);

  // Rule 1: Exact keyword containment (most answers will pass this)
  if (normAnswer.includes(normKeyword)) return true;

  // Rule 2: Levenshtein distance tolerance (handles minor typos)
  // Only applied when the keyword is at least 4 characters
  if (normKeyword.length >= 4) {
    const distance = levenshtein.get(normKeyword, normAnswer);
    const threshold = Math.ceil(normKeyword.length * 0.30);
    if (distance <= threshold) return true;
  }

  // Rule 3: Token-level containment
  // If the keyword is a multi-word phrase, check if all words appear in the answer
  const keywordTokens = normKeyword.split(' ').filter(Boolean);
  if (keywordTokens.length > 1) {
    const answerTokens = new Set(normAnswer.split(' ').filter(Boolean));
    if (keywordTokens.every(t => answerTokens.has(t))) return true;
  }

  return false;
}

/**
 * Returns a normalized hint for the attendee after the max attempt threshold.
 * Shows the first letter of each word in the keyword, rest redacted.
 *
 * Example: "CivicSuite Pro" → "C_______ P__"
 */
export function generateHint(keyword) {
  return normalize(keyword)
    .split(' ')
    .map(word => {
      if (!word) return '';
      return word[0] + '_'.repeat(word.length - 1);
    })
    .join(' ');
}
