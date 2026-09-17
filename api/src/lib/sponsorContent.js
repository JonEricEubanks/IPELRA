/**
 * sponsorContent.js — sanity checks on sponsor copy before/while it's live.
 *
 * Catches template text that slipped into a real sponsor record, e.g. a
 * promptQuestion that still says "[Company Name]". Cheap, deterministic,
 * used by both the readiness check and the dashboard's "needs attention" card.
 */

const PLACEHOLDER_PATTERNS = [
  { re: /\[[^\]]{1,40}\]/,                       label: 'has bracketed placeholder text like "[Company Name]"' },
  { re: /\{\{?[^}]{1,40}\}?\}/,                  label: 'has template braces like "{{name}}"' },
  { re: /\b(company|sponsor|vendor) name\b/i,    label: 'still says "company name" instead of the sponsor\'s name' },
  { re: /\b(TODO|TBD|FIXME|XXX)\b/,              label: 'contains TODO/TBD' },
  { re: /\blorem ipsum\b/i,                      label: 'contains lorem ipsum' },
];

const FIELDS = [
  ['promptQuestion',      'Question'],
  ['promptAnswerKeyword', 'Answer keyword'],
  ['tagline',             'Tagline'],
  ['description',         'Description'],
];

/**
 * Returns human-readable issue strings for a sponsor document (empty = clean).
 * e.g. ['Question has bracketed placeholder text like "[Company Name]"']
 */
export function findPlaceholderIssues(sponsor) {
  const issues = [];
  for (const [field, label] of FIELDS) {
    const value = sponsor?.[field];
    if (typeof value !== 'string' || !value) continue;
    for (const { re, label: what } of PLACEHOLDER_PATTERNS) {
      if (re.test(value)) { issues.push(`${label} ${what}`); break; }
    }
  }
  if (typeof sponsor?.promptQuestion === 'string' && sponsor.promptQuestion.trim() && !/[?]\s*$/.test(sponsor.promptQuestion.trim())) {
    issues.push('Question doesn\'t end with a question mark');
  }
  return issues;
}
