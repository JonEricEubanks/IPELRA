/**
 * sponsorContent.js — client-side twin of api/src/lib/sponsorContent.js.
 *
 * Lets the sponsor edit form warn about placeholder text *as staff type*, so
 * the Dashboard's "Fix" link lands on a page that highlights the exact problem.
 * Keep the patterns in sync with the server copy.
 */

const PLACEHOLDER_PATTERNS = [
  { re: /\[[^\]]{1,40}\]/,                    label: 'has bracketed placeholder text like "[Company Name]"' },
  { re: /\{\{?[^}]{1,40}\}?\}/,               label: 'has template braces like "{{name}}"' },
  { re: /\b(company|sponsor|vendor) name\b/i, label: 'still says "company name" instead of the sponsor\'s name' },
  { re: /\b(TODO|TBD|FIXME|XXX)\b/,           label: 'contains TODO/TBD' },
  { re: /\blorem ipsum\b/i,                   label: 'contains lorem ipsum' },
];

const FIELDS = [
  ['promptQuestion',      'Question'],
  ['promptAnswerKeyword', 'Answer keyword'],
  ['tagline',             'Tagline'],
  ['description',         'Description'],
];

export function findPlaceholderIssues(sponsor) {
  const issues = [];
  for (const [field, label] of FIELDS) {
    const value = sponsor?.[field];
    if (typeof value !== 'string' || !value) continue;
    for (const { re, label: what } of PLACEHOLDER_PATTERNS) {
      if (re.test(value)) { issues.push({ field, text: `${label} ${what}` }); break; }
    }
  }
  const q = sponsor?.promptQuestion;
  if (typeof q === 'string' && q.trim() && !/[?]\s*$/.test(q.trim())) {
    issues.push({ field: 'promptQuestion', text: 'Question doesn\'t end with a question mark' });
  }
  return issues;
}
