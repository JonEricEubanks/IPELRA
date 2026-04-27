/**
 * AdminAttendeePage.jsx — /admin/attendees
 * Email/name search, attendee detail view, manual credit form.
 */

import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetAttendee, adminManualCredit } from '../api';
import { CheckCircle2 } from 'lucide-react';

export default function AdminAttendeePage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [attendee, setAttendee] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [creditSponsorId, setCreditSponsorId] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [crediting, setCrediting] = useState(false);
  const [creditMsg, setCreditMsg] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNotFound(false);
    setAttendee(null);
    setSearchError('');
    setCreditMsg('');
    try {
      const data = await adminGetAttendee(query.trim());
      setAttendee(data);
    } catch (err) {
      if (err?.status === 404) setNotFound(true);
      else setSearchError('Lookup failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleCredit(e) {
    e.preventDefault();
    if (!creditSponsorId.trim()) return;
    setCrediting(true);
    setCreditMsg('');
    try {
      const res = await adminManualCredit(attendee.id, attendee.email, creditSponsorId.trim(), creditNote.trim());
      setCreditMsg(`OK: Credited. New total: ${res.points} pts`);
      setCreditSponsorId('');
      setCreditNote('');
      // refresh attendee
      const refreshed = await adminGetAttendee(query.trim());
      setAttendee(refreshed);
    } catch (err) {
      setCreditMsg(err?.message ?? 'Credit failed.');
    } finally {
      setCrediting(false);
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Attendees</h1>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder="Search by email or name"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={searching}>
          {searching ? '…' : 'Search'}
        </button>
      </form>

      {searchError && <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>{searchError}</div>}
      {notFound && <div style={{ color: 'var(--color-text-2)', padding: 'var(--space-4)' }}>No attendee found for "{query}".</div>}

      {attendee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Profile */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {attendee.firstName} {attendee.lastName}
                </div>
                <div style={{ color: 'var(--color-text-2)', fontSize: 14 }}>{attendee.email}</div>
              </div>
              <div style={{
                background: attendee.completed ? 'var(--color-success-bg)' : 'var(--color-primary-light)',
                color: attendee.completed ? 'var(--color-success-dark)' : 'var(--color-primary)',
                borderRadius: 999, padding: '6px 16px', fontWeight: 800, fontSize: 15,
              }}>
                {attendee.points} pts {attendee.completed ? <CheckCircle2 size={14} color="var(--color-success-dark)" style={{ verticalAlign: 'middle' }} /> : null}
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: 14 }}>
              <div><strong>Registered:</strong> {new Date(attendee.createdAt).toLocaleDateString()}</div>
              <div><strong>Check-ins:</strong> {attendee.checkins?.length ?? 0}</div>
              {attendee.completed && (
                <div style={{ gridColumn: '1/-1' }}>
                  <strong>Completed:</strong> {new Date(attendee.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Check-in history */}
          {attendee.checkins?.length > 0 && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>Check-in History</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Sponsor</th>
                      <th style={{ textAlign: 'right' }}>Pts</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendee.checkins.map((c, i) => (
                      <tr key={i}>
                        <td>{c.sponsorName ?? c.sponsorId}</td>
                        <td style={{ textAlign: 'right' }}>{c.points}</td>
                        <td style={{ color: 'var(--color-text-2)', fontSize: 13 }}>
                          {new Date(c.timestamp).toLocaleString()}
                          {c.isManual ? <span style={{ marginLeft: 6, color: 'var(--color-gold)', fontWeight: 700 }}>manual</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manual credit */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>Manual Credit</h3>
            <form onSubmit={handleCredit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Sponsor ID *</label>
                <input className="form-input" value={creditSponsorId} onChange={e => setCreditSponsorId(e.target.value)} placeholder="Paste sponsor ID" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Note (optional)</label>
                <input className="form-input" value={creditNote} onChange={e => setCreditNote(e.target.value)} placeholder="e.g. badge scanner issue" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={crediting}>
                {crediting ? 'Applying…' : 'Apply Credit'}
              </button>
              {creditMsg && <div style={{ fontSize: 14, color: creditMsg.startsWith('OK:') ? 'var(--color-success-dark)' : 'var(--color-error)' }}>{creditMsg}</div>}
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
