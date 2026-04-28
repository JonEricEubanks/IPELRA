/**
 * AdminAttendeePage.jsx — /admin/attendees
 * Roster tab (all attendees w/ filter) + Search tab (email lookup + manual credit).
 */

import { useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetAttendee, adminListAttendees, adminManualCredit } from '../api';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const FILTER_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'active',    label: 'Active' },
  { key: 'pending',   label: 'Not Started' },
];

function TabBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', borderBottom: '2px solid var(--color-border)', paddingBottom: 0 }}>
      {[{ key: 'roster', label: 'All Attendees' }, { key: 'search', label: 'Search / Credit' }].map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', fontWeight: active === t.key ? 800 : 500,
            fontSize: 14,
            color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-2)',
            borderBottom: active === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -2,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Roster tab ────────────────────────────────────────────────────────────────
function RosterTab() {
  const [filter, setFilter] = useState('all');
  const [attendees, setAttendees] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (f = filter) => {
    setLoading(true);
    try {
      const data = await adminListAttendees(f);
      setAttendees(data.attendees ?? []);
      setTotal(data.total ?? 0);
      setLoaded(true);
    } catch {
      toast.error('Failed to load attendees.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  function changeFilter(f) {
    setFilter(f);
    load(f);
  }

  return (
    <div>
      {/* Filter + Load */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => changeFilter(t.key)}
              style={{
                padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
                borderColor: filter === t.key ? 'var(--color-primary)' : 'var(--color-border)',
                background: filter === t.key ? 'var(--color-primary)' : '#fff',
                color: filter === t.key ? '#fff' : 'var(--color-text)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => load(filter)} disabled={loading}>
          {loading ? '…' : <><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Load</>}
        </button>
      </div>

      {!loaded && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-2)' }}>
          Click <strong>Load</strong> to fetch the attendee roster.
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      )}

      {loaded && !loading && (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 'var(--space-3)' }}>
            {total} attendee{total !== 1 ? 's' : ''}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                  <th style={{ textAlign: 'center' }}>Stops</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.firstName} {a.lastName}</td>
                    <td style={{ color: 'var(--color-text-2)', fontSize: 13 }}>{a.email}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{a.points}</td>
                    <td style={{ textAlign: 'center' }}>{a.stampCount}</td>
                    <td style={{ textAlign: 'center' }}>
                      {a.completed ? (
                        <span style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-dark)', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          ✓ Done
                        </span>
                      ) : a.points > 0 ? (
                        <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {attendees.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-2)', padding: 'var(--space-5)' }}>
                      No attendees in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Search / Credit tab ───────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [attendee, setAttendee] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [creditSponsorId, setCreditSponsorId] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [crediting, setCrediting] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNotFound(false);
    setAttendee(null);
    try {
      const data = await adminGetAttendee(query.trim());
      setAttendee(data);
    } catch (err) {
      if (err?.status === 404) setNotFound(true);
      else toast.error('Lookup failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleCredit(e) {
    e.preventDefault();
    if (!creditSponsorId.trim()) return;
    setCrediting(true);
    try {
      const res = await adminManualCredit(attendee.id, attendee.email, creditSponsorId.trim(), creditNote.trim());
      toast.success(`Credited. New total: ${res.totalPoints ?? res.points} pts`);
      setCreditSponsorId('');
      setCreditNote('');
      const refreshed = await adminGetAttendee(query.trim());
      setAttendee(refreshed);
    } catch (err) {
      toast.error(err?.message ?? 'Credit failed.');
    } finally {
      setCrediting(false);
    }
  }

  return (
    <div>
      {/* Search form */}
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

      {notFound && <div style={{ color: 'var(--color-text-2)', padding: 'var(--space-4)' }}>No attendee found for "{query}".</div>}

      {attendee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Profile */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{attendee.firstName} {attendee.lastName}</div>
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
                          {c.isManual ? <span style={{ marginLeft: 6, color: '#254a84', fontWeight: 700 }}>manual</span> : null}
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminAttendeePage() {
  const [tab, setTab] = useState('roster');

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Attendees</h1>
      <TabBar active={tab} onChange={setTab} />
      {tab === 'roster' ? <RosterTab /> : <SearchTab />}
    </AdminLayout>
  );
}
