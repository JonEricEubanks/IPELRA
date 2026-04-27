/**
 * AdminResetPage.jsx — /admin/reset
 * Archive all attendee and check-in data for the current conference year.
 * Requires typing the exact confirm token (e.g. "RESET-2026") to proceed.
 */

import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminResetConference } from '../api';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const YEAR = new Date().getFullYear();
const EXPECTED_TOKEN = `RESET-${YEAR}`;

export default function AdminResetPage() {
  const [token, setToken]     = useState('');
  const [resetting, setResetting] = useState(false);
  const [result, setResult]   = useState(null); // { archivedAttendees, archivedCheckins }
  const [error, setError]     = useState('');

  const canSubmit = token === EXPECTED_TOKEN && !resetting;

  async function handleReset(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setResetting(true);
    setError('');
    setResult(null);
    try {
      const data = await adminResetConference(token);
      setResult(data);
      setToken('');
    } catch (err) {
      setError(err?.message ?? 'Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-2)' }}>Conference Reset</h1>
      <p style={{ color: 'var(--color-text-2)', fontSize: 14, marginBottom: 'var(--space-6)' }}>
        Archives all attendee and check-in data for the current conference year.
        Records are not deleted — they are stamped as archived so they cannot be looked up through the normal app flow.
      </p>

      {/* Warning banner */}
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca',
        borderLeft: '4px solid #ef4444',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 'var(--space-2)' }}>
          <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />This action archives all attendee progress
        </div>
        <ul style={{ fontSize: 14, color: '#7f1d1d', paddingLeft: 'var(--space-5)', margin: 0, lineHeight: 1.8 }}>
          <li>All attendee records will be moved to the archive state</li>
          <li>All check-in history will be archived</li>
          <li>Archived data is not shown in normal admin views</li>
          <li><strong>Export attendees before resetting</strong> if you need a record for prize drawings</li>
        </ul>
      </div>

      {/* Success result */}
      {result && (
        <div style={{
          background: 'var(--color-success-bg)', border: '1px solid var(--color-success-dark)',
          borderRadius: 'var(--radius-card)', padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--color-success-dark)', marginBottom: 'var(--space-2)' }}>
            <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Conference reset complete
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-success-dark)' }}>
            Archived <strong>{result.archivedAttendees ?? 0}</strong> attendees
            and <strong>{result.archivedCheckins ?? 0}</strong> check-in records.
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>
      )}

      {/* Reset form */}
      <div className="danger-zone card" style={{ borderTop: '4px solid #ef4444' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-2)', color: '#b91c1c' }}>
          Confirm Reset
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-4)' }}>
          Type <code style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
            {EXPECTED_TOKEN}
          </code> below to confirm.
        </p>

        <form onSubmit={handleReset}>
          <div className="form-group">
            <label className="form-label">Confirmation token</label>
            <input
              className="form-input"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={EXPECTED_TOKEN}
              autoComplete="off"
              spellCheck={false}
              style={{ maxWidth: 280, fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
            {token.length > 0 && token !== EXPECTED_TOKEN && (
              <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>
                Token must be exactly: {EXPECTED_TOKEN}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button
              className="btn btn-lg"
              type="submit"
              disabled={!canSubmit}
              style={{
                background: canSubmit ? '#ef4444' : '#fca5a5',
                color: '#fff',
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {resetting ? 'Archiving…' : `Archive ${YEAR} Conference Data`}
            </button>
            <a className="btn btn-ghost btn-sm" href="/admin/export">Export first →</a>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
