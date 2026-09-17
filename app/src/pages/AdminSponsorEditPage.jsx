/**
 * AdminSponsorEditPage.jsx — /admin/sponsors/new  and  /admin/sponsors/:id
 * Create or edit a sponsor record using the correct data model.
 * Includes a live fuzzy-match tester (mirrors server logic).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminGetSponsors, adminUpdateSponsor, adminCreateSponsor, adminGetSponsorWrongAnswers } from '../api';
import { findPlaceholderIssues } from '../lib/sponsorContent';
import { AlertTriangle, MessageSquareWarning, CheckCircle2 } from 'lucide-react';

// ── Client-side fuzzy match (mirrors api/src/lib/fuzzyMatch.js exactly) ─────
function normalize(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
function testFuzzy(answer, keyword) {
  if (!keyword.trim()) return null;
  const a = normalize(answer);
  const k = normalize(keyword);
  if (!a) return { pass: false, dist: Infinity, maxDist: 0 };
  if (a.includes(k)) return { pass: true, method: 'keyword found in answer' };
  const dist = levenshtein(a, k);
  const maxDist = Math.ceil(k.length * 0.3);
  if (k.length >= 4 && dist <= maxDist) return { pass: true, method: `close match (distance ${dist} ≤ ${maxDist})` };
  const kTokens = k.split(' ').filter(Boolean);
  if (kTokens.length > 1) {
    const aTokens = new Set(a.split(' ').filter(Boolean));
    if (kTokens.every(t => aTokens.has(t))) return { pass: true, method: 'every keyword word appears in answer' };
  }
  return { pass: false, dist, maxDist };
}

const TIER_POINTS = { partnership: 100, leadership: 150 };

const EMPTY = {
  name:               '',
  tier:               'partnership',
  tagline:            '',
  description:        '',
  website:            '',
  logoUrl:            '',
  pointValue:         100,
  promptQuestion:     '',
  promptAnswerKeyword: '',
  isActive:           false,
  displayOrder:       0,
};

export default function AdminSponsorEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?from=attention → arrived via the Dashboard's Fix/Review button
  const fromAttention = searchParams.get('from') === 'attention';
  const isNew = !id || id === 'new';

  const [form, setForm]     = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const [testAnswer, setTestAnswer] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [wrongAnswers, setWrongAnswers] = useState([]);

  // Live content warnings — the same rules the Dashboard uses to flag a sponsor
  const contentIssues = useMemo(() => findPlaceholderIssues(form), [form]);
  const fieldHasIssue = (field) => contentIssues.some(i => i.field === field);

  useEffect(() => {
    if (isNew) return;
    adminGetSponsors()
      .then(d => {
        const found = (d.sponsors ?? []).find(s => s.id === id);
        if (found) setForm({ ...EMPTY, ...found, description: found.description ?? '', website: found.website ?? '' });
        else setError('Sponsor not found.');
      })
      .catch(() => setError('Failed to load sponsor.'))
      .finally(() => setLoading(false));
    adminGetSponsorWrongAnswers(id).then(setWrongAnswers).catch(() => {});
  }, [id, isNew]);

  // Every distinct wrong guess, most common first — staff can eyeball whether the
  // rep is giving an answer the keyword doesn't accept.
  const guessTally = useMemo(() => {
    const tally = new Map();
    for (const w of wrongAnswers) for (const a of w.rejectedAnswers) {
      const k = String(a).trim();
      if (!k) continue;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  }, [wrongAnswers]);
  const stuckCount = wrongAnswers.filter(w => w.stuck).length;

  function set(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      // Auto-set pointValue when tier changes (if user hasn't manually overridden)
      if (field === 'tier') next.pointValue = TIER_POINTS[value] ?? f.pointValue;
      return next;
    });
  }

  function handleTest() {
    setTestResult(testFuzzy(testAnswer, form.promptAnswerKeyword));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())               return setError('Sponsor name is required.');
    if (!form.promptQuestion.trim())     return setError('Prompt question is required.');
    if (!form.promptAnswerKeyword.trim()) return setError('Answer keyword is required.');
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        name:               form.name.trim(),
        tagline:            form.tagline.trim(),
        description:        form.description.trim() || null,
        website:            form.website.trim() || null,
        logoUrl:            form.logoUrl.trim() || null,
        promptQuestion:     form.promptQuestion.trim(),
        promptAnswerKeyword: form.promptAnswerKeyword.trim(),
        pointValue:         Number(form.pointValue),
        displayOrder:       Number(form.displayOrder),
      };
      if (isNew) {
        await adminCreateSponsor(payload);
      } else {
        await adminUpdateSponsor(id, payload);
      }
      navigate('/admin/sponsors');
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
      </AdminLayout>
    );
  }

  const backTo = fromAttention ? '/admin/dashboard' : '/admin/sponsors';

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(backTo)}>← {fromAttention ? 'Dashboard' : 'Back'}</button>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{isNew ? 'New Sponsor' : `Edit ${form.name || 'Sponsor'}`}</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* Why you're here — shown whenever this sponsor has something to look at */}
      {!isNew && (contentIssues.length > 0 || stuckCount > 0) && (
        <div className="alert alert--warn" role="status" style={{ maxWidth: 640, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contentIssues.map(i => (
              <div key={i.field + i.text}><strong>{i.text}.</strong> Edit the highlighted field below and save.</div>
            ))}
            {stuckCount > 0 && (
              <div>
                <strong>{stuckCount} attendee{stuckCount === 1 ? '' : 's'} used all 3 answer attempts here.</strong>{' '}
                Check what they typed (below the answer keyword) — if the rep is saying something the keyword doesn't accept, loosen the keyword or brief the rep.
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        {/* Basic info */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>Sponsor Details</h2>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sponsor Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tier *</label>
              <select className="form-input" value={form.tier} onChange={e => set('tier', e.target.value)}>
                <option value="partnership">Partnership (100 pts)</option>
                <option value="leadership">Leadership (150 pts)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tagline</label>
            <input
              className="form-input"
              placeholder="Short tagline shown on the sponsor card"
              value={form.tagline}
              onChange={e => set('tagline', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Company Description</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Full company description shown in the bottom sheet when attendees tap the sponsor card."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              style={{ resize: 'vertical', minHeight: 96 }}
            />
            <div className="form-hint">Displayed when an attendee taps the sponsor card. Supports plain text only.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Company Website</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://example.com"
              value={form.website}
              onChange={e => set('website', e.target.value)}
            />
            <div className="form-hint">Optional link shown in the sponsor detail sheet.</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Logo URL</label>
              <input
                className="form-input"
                type="url"
                placeholder="/logos/sponsor.png  or  https://…"
                value={form.logoUrl}
                onChange={e => set('logoUrl', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Point Value</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={500}
                value={form.pointValue}
                onChange={e => set('pointValue', e.target.value)}
              />
              <div className="form-hint">Auto-set by tier; override if needed.</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={e => set('displayOrder', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => set('isActive', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                />
                <span className="form-label" style={{ margin: 0 }}>Active (visible to attendees)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Passport prompt */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>Passport Prompt</h2>

          <div className="form-group">
            <label className="form-label" htmlFor="sp-question">Question shown to attendees *</label>
            <textarea
              id="sp-question"
              className="form-input"
              rows={3}
              placeholder="e.g. What does CityTech Solutions specialize in?"
              value={form.promptQuestion}
              onChange={e => set('promptQuestion', e.target.value)}
              required
              aria-invalid={fieldHasIssue('promptQuestion') || undefined}
              style={fieldHasIssue('promptQuestion') ? { borderColor: '#f97316', boxShadow: '0 0 0 3px rgba(249,115,22,0.18)' } : undefined}
            />
            {fieldHasIssue('promptQuestion') && (
              <div className="form-hint" style={{ color: '#9a3412', fontWeight: 600 }}>
                {contentIssues.filter(i => i.field === 'promptQuestion').map(i => i.text).join(' · ')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sp-keyword">Answer keyword (for fuzzy match) *</label>
            <input
              id="sp-keyword"
              className="form-input"
              placeholder="e.g. municipal technology"
              value={form.promptAnswerKeyword}
              onChange={e => set('promptAnswerKeyword', e.target.value)}
              required
              aria-invalid={fieldHasIssue('promptAnswerKeyword') || undefined}
              style={fieldHasIssue('promptAnswerKeyword') ? { borderColor: '#f97316', boxShadow: '0 0 0 3px rgba(249,115,22,0.18)' } : undefined}
            />
            <div className="form-hint">
              An answer is accepted if it <strong>contains</strong> this keyword (any casing/punctuation), is a close misspelling of it,
              or includes every word of it. Attendees can keep trying — after 3 misses they see a letter hint and are pointed to your table.
            </div>
          </div>

          {/* What attendees actually typed here */}
          {!isNew && guessTally.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <MessageSquareWarning size={16} color="#9a3412" />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  Wrong answers attendees typed here
                  <span style={{ fontWeight: 500, color: 'var(--color-text-2)' }}> · {wrongAnswers.length} {wrongAnswers.length === 1 ? 'person' : 'people'}{stuckCount ? `, ${stuckCount} stuck` : ''}</span>
                </div>
              </div>
              <p className="form-hint" style={{ marginBottom: 10 }}>
                Tap one to test it against the keyword above. Green means changing the keyword would now accept it.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {guessTally.map(([guess, n]) => {
                  const r = form.promptAnswerKeyword.trim() ? testFuzzy(guess, form.promptAnswerKeyword) : null;
                  return (
                    <button
                      key={guess}
                      type="button"
                      onClick={() => { setTestAnswer(guess); setTestResult(testFuzzy(guess, form.promptAnswerKeyword)); }}
                      title="Test this answer"
                      data-pass={r?.pass ? 'true' : 'false'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                        border: `1.5px solid ${r?.pass ? '#a7f3d0' : '#fecaca'}`,
                        background: r?.pass ? 'var(--color-success-light)' : '#fef2f2',
                        color: r?.pass ? '#065f46' : '#991b1b',
                      }}
                    >
                      {r?.pass && <CheckCircle2 size={13} />}
                      <span style={{ fontFamily: 'monospace' }}>“{guess}”</span>
                      {n > 1 && <span style={{ opacity: 0.7 }}>×{n}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live test */}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 'var(--space-2)' }}>
              Test the fuzzy match
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                className="form-input"
                placeholder="Type a test answer…"
                value={testAnswer}
                onChange={e => { setTestAnswer(e.target.value); setTestResult(null); }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleTest}
                disabled={!testAnswer.trim() || !form.promptAnswerKeyword.trim()}
              >
                Test
              </button>
            </div>
            {testResult && (
              <div className={`fuzzy-result fuzzy-result--${testResult.pass ? 'pass' : 'fail'}`}>
                {testResult.pass
                  ? `✅ Would accept — ${testResult.method}`
                  : `❌ Would reject — distance ${testResult.dist} > max ${testResult.maxDist}`}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create Sponsor' : 'Save Changes'}
          </button>
          <button className="btn btn-ghost btn-lg" type="button" onClick={() => navigate('/admin/sponsors')}>
            Cancel
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
