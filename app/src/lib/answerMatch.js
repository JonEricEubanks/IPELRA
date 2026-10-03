/**
 * fuzzyMatch.js — forgiving answer matching.
 *
 * The keyword may list several accepted answers separated by "|"
 * (e.g. "Acme Cloud | Cloud Services | Acme"). An answer passes if it
 * matches ANY of them by one of these rules:
 *   1. Contains the accepted answer as whole words ("we do cloud services")
 *   2. Same, ignoring spaces between whole words ("403 b" = "403b", "water bottle" = "waterbottle")
 *   3. Close misspelling of the whole thing (≤30% edits) — not for numbers
 *   4. Word-by-word: order and filler words ignored, per-word typos and
 *      abbreviations allowed; numbers must match exactly. All key words are
 *      needed for 1–3 word answers, 75% for longer ones.
 *
 * Mirrored in app/src/lib/answerMatch.js (admin "test an answer" box) —
 * keep the two files identical.
 */

const FILLER = new Set(
  'a an the and or of for to in on at by with is are was were it its our your their my we i'.split(' ')
);

function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

const hasDigit = (s) => /\d/.test(s);

function wordMatches(keyWord, answerWord) {
  if (keyWord === answerWord) return true;
  if (hasDigit(keyWord) || hasDigit(answerWord)) return false;
  // "gov" → "government", "training" → "trainings"
  if (keyWord.length >= 3 && answerWord.startsWith(keyWord)) return true;
  // Attendee abbreviated: "admin" for "administration" (but not "add" for "address")
  if (answerWord.length >= 4 && answerWord.length >= keyWord.length * 0.3 && keyWord.startsWith(answerWord)) return true;
  const tolerance = keyWord.length >= 8 ? 2 : keyWord.length >= 4 ? 1 : 0;
  return tolerance > 0 && levenshtein(keyWord, answerWord) <= tolerance;
}

function matchOne(keyword, answer) {
  const k = normalize(keyword);
  const a = normalize(answer);
  if (!k || !a) return null;

  if (` ${a} `.includes(` ${k} `)) return 'contains the answer';

  const kCompact = k.replace(/ /g, '');
  const answerWords = a.split(' ');
  for (let i = 0; i < answerWords.length; i++) {
    let run = '';
    for (let j = i; j < answerWords.length && run.length < kCompact.length; j++) {
      run += answerWords[j];
      if (run === kCompact) return 'contains the answer';
    }
  }

  if (!hasDigit(k) && k.length >= 4) {
    const distance = levenshtein(k, a);
    if (distance <= Math.ceil(k.length * 0.3)) return `close spelling (${distance} letter${distance === 1 ? '' : 's'} off)`;
  }

  const allWords = k.split(' ');
  const keyWords = allWords.filter(w => !FILLER.has(w));
  const needed = keyWords.length ? keyWords : allWords;
  const found = needed.filter(kw => answerWords.some(aw => wordMatches(kw, aw))).length;
  const required = needed.length <= 3 ? needed.length : Math.ceil(needed.length * 0.75);
  if (found >= required) return `matched ${found} of ${needed.length} key word${needed.length === 1 ? '' : 's'}`;

  return null;
}

/** Splits "a | b | c" into accepted answers. */
export function acceptedAnswers(keyword) {
  return String(keyword ?? '').split('|').map(s => s.trim()).filter(Boolean);
}

/** Returns { pass, matched?, method? } — `matched` is the accepted answer that hit. */
export function matchAnswer(keyword, answer) {
  if (!answer || !String(answer).trim()) return { pass: false };
  for (const accepted of acceptedAnswers(keyword)) {
    const method = matchOne(accepted, answer);
    if (method) return { pass: true, matched: accepted, method };
  }
  return { pass: false };
}

export function isCorrectAnswer(keyword, answer) {
  return matchAnswer(keyword, answer).pass;
}

/**
 * Hint after 3 misses: first letter of each word of the FIRST accepted answer.
 * Example: "CivicSuite Pro | Civic" → "c_________ p__"
 */
export function generateHint(keyword) {
  return normalize(acceptedAnswers(keyword)[0] ?? '')
    .split(' ')
    .map(word => (word ? word[0] + '_'.repeat(word.length - 1) : ''))
    .join(' ');
}
