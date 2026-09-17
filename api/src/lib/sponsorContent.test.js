import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPlaceholderIssues } from './sponsorContent.js';

test('findPlaceholderIssues: flags the real Workday case — "[Company Name]" left in the question', () => {
  const issues = findPlaceholderIssues({
    name: 'Workday',
    promptQuestion: 'What is the main benefit [Company Name] provides to help HR teams streamline their operations from hire to retire? ',
    promptAnswerKeyword: 'Workday HCM',
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /^Question has bracketed placeholder/);
});

test('findPlaceholderIssues: catches "company name", TODO/TBD, template braces and lorem ipsum across fields', () => {
  const issues = findPlaceholderIssues({
    promptQuestion: 'What does the company name do?',
    promptAnswerKeyword: 'TBD',
    tagline: 'Hello {{sponsor}}',
    description: 'Lorem ipsum dolor sit amet',
  });
  assert.equal(issues.length, 4);
  assert.ok(issues.some(i => i.startsWith('Question ')));
  assert.ok(issues.some(i => i.startsWith('Answer keyword ')));
  assert.ok(issues.some(i => i.startsWith('Tagline ')));
  assert.ok(issues.some(i => i.startsWith('Description ')));
});

test('findPlaceholderIssues: notes a question missing its question mark', () => {
  const issues = findPlaceholderIssues({ promptQuestion: 'Name our flagship product', promptAnswerKeyword: 'Acme' });
  assert.deepEqual(issues, ['Question doesn\'t end with a question mark']);
});

test('findPlaceholderIssues: clean sponsor returns no issues; missing fields are ignored', () => {
  assert.deepEqual(findPlaceholderIssues({ promptQuestion: 'What year was Acme founded?', promptAnswerKeyword: '1985' }), []);
  assert.deepEqual(findPlaceholderIssues({}), []);
  assert.deepEqual(findPlaceholderIssues(null), []);
});
