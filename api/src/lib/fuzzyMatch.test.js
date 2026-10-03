import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCorrectAnswer, matchAnswer, acceptedAnswers, generateHint } from './fuzzyMatch.js';

const ok  = (keyword, answer) => assert.equal(isCorrectAnswer(keyword, answer), true,  `expected PASS: "${answer}" for "${keyword}"`);
const bad = (keyword, answer) => assert.equal(isCorrectAnswer(keyword, answer), false, `expected FAIL: "${answer}" for "${keyword}"`);

// ── Original behaviour still holds ───────────────────────────────────────────
test('basics: exact, contained, case/punctuation-insensitive, close typo, word order', () => {
  ok('CivicSuite', 'CivicSuite');
  ok('CivicSuite', 'I think it is called CivicSuite Pro');
  ok('CivicSuite', 'civic-suite!');
  ok('CivicSuite', 'CivicSuit');
  ok('Civic Suite Pro', 'pro civic suite');
  bad('CivicSuite', 'banana');
  bad('', 'anything');
  bad('CivicSuite', '');
  bad('CivicSuite', '   ');
});

// ── Multiple accepted answers ────────────────────────────────────────────────
test('"|" separates accepted answers; any one passes and the matched one is reported', () => {
  assert.deepEqual(acceptedAnswers(' A | B ||  C '), ['A', 'B', 'C']);
  const r = matchAnswer('A365 Services | Cloud Services', 'they do cloud services');
  assert.equal(r.pass, true);
  assert.equal(r.matched, 'Cloud Services');
});

// ── Word-by-word forgiveness ─────────────────────────────────────────────────
test('filler words, "&", abbreviations, plurals and per-word typos are forgiven', () => {
  const k = 'Mapping and Cloud Services for Local Government';
  ok(k, 'Cloud and mapping services for local government');    // reordered
  ok(k, 'Mapping & Cloud Services for Local Gov');             // & + abbreviation
  ok(k, 'mappng cloud servces local goverment');               // typos, no filler
});

test('long answers need ~75% of key words; short ones need all', () => {
  const k = 'Mapping and Cloud Services for Local Government';     // 5 key words → need 4
  bad(k, 'mapping services');
  ok('Acme HCM', 'HCM by Acme');
  bad('Acme HCM | Human Capital Management', 'capital');
});

test('numbers must be exact (no "close enough" years)', () => {
  ok('1984', 'It was 1984');
  bad('1984', '1983');
  bad('1984', '19840');
  ok('403b', '403(b)');
  ok('403b', '403 b');
  ok('Water bottle', 'waterbottle');
  bad('403b', '401k');
});

test('whole-word containment: short answers do not match inside other words', () => {
  bad('GIS', 'logistics');
  ok('GIS', 'they do GIS mapping');
  bad('Rex', 'my dog is called Buddy');
});

test('stray "A:" style prefixes on a stored answer do not block correct replies', () => {
  ok('A: 1925', '1925');
  ok('A: 1925', 'It was formed in 1925');
});

// ── The live sponsor answers ─────────────────────────────────────────────────
const SAMPLE = {
  tech:      'A365 Services | A365 | Acme 365 | Cloud Services | Cloud | GIS | Mapping and Cloud Services for Local Government | Technology Services',
  plan:      '403b | 403 | Deferred Annuity',
  hr:        'Acme HCM | HCM | Human Capital Management',
  swag:      'Water bottle and lanyard | Water bottle | Bottle | Lanyard',
  law:       'Webinars, guides, and checklists | Webinars | Guides | Checklists',
};

test('sample sponsor (fictional; repo is public): tagline, short codes, product variants, reorderings', () => {
  ok(SAMPLE.tech, 'Mapping and Cloud Services for Local Government');
  ok(SAMPLE.tech, 'Cloud and mapping services for local government');
  ok(SAMPLE.tech, 'A365');
  ok(SAMPLE.tech, 'acme 365 stuff');
  ok(SAMPLE.tech, 'tech services');
  bad(SAMPLE.tech, 'payroll');
});

test('sample sponsors: obvious variants pass, unrelated answers fail', () => {
  ok(SAMPLE.plan, '403 plan');
  ok(SAMPLE.plan, 'deferred annu');
  ok(SAMPLE.hr, 'Acme Human Capital Management');
  ok(SAMPLE.hr, 'human capital mgmt');
  ok(SAMPLE.swag, 'a lanyard and a water bottle');
  ok(SAMPLE.swag, 'bottle');
  ok(SAMPLE.law, 'webinars, guides, checklists');
  ok(SAMPLE.law, 'guide');
  bad(SAMPLE.law, 'free lunch');
});

test('generateHint uses the first accepted answer only', () => {
  assert.equal(generateHint('CivicSuite Pro | Civic'), 'c_________ p__');
});

test('the admin page copy (app/src/lib/answerMatch.js) is identical to this file', () => {
  const api = readFileSync(new URL('./fuzzyMatch.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../../app/src/lib/answerMatch.js', import.meta.url), 'utf8');
  assert.equal(app, api, 'copy api/src/lib/fuzzyMatch.js over app/src/lib/answerMatch.js');
});
