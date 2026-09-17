/**
 * AdminAttendeePage.jsx — /admin/attendees
 *
 * Roster loads immediately. Type to filter by name or email, chip-filter by
 * status, click any row for a side drawer with their check-in history and a
 * manual-credit form (sponsor picked from a dropdown — no IDs to paste).
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetAttendee, adminListAttendees, adminManualCredit, adminGetSponsors } from '../api';
import { Search, X, RefreshCw, CheckCircle2, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const FILTERS = [
  { key: 'all',       label: 'Everyone' },
  { key: 'completed', label: 'Completed' },
  { key: 'active',    label: 'In progress' },
  { key: 'pending',   label: 'Not started' },
];

function statusOf(a) {
  if (a.completed) return 'done';
  if ((a.stampCount ?? 0) > 0 || (a.points ?? 0) > 0) return 'active';
  return 'pending';
}

function StatusPill({ attendee }) {
  const s = statusOf(attendee);
  if (s === 'done')   return <span className="pill pill--done"><CheckCircle2 size={12} /> Completed</span>;
  if (s === 'active') return <span className="pill pill--active">In progress</span>;
  return <span className="pill pill--pending">Not started</span>;
}

function fullName(a) {
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || '—';
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function AttendeeDrawer({ email, sponsors, onClose, onChanged }) {
  const [attendee, setAttendee] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [sponsorId, setSponsorId] = useState('');
  const [note, setNote]           = useState('');
  const [crediting, setCrediting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAttendee(await adminGetAttendee(email));
    } catch {
      toast.error('Could not load this attendee.');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [email, onClose]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stamped = new Set(attendee?.completedStamps ?? []);
  const creditable = sponsors.filter(s => s.isActive && !stamped.has(s.id));
  const history = (attendee?.checkins ?? [])
    .filter(c => !c.failed)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  async function handleCredit(e) {
    e.preventDefault();
    if (!sponsorId) return;
    setCrediting(true);
    try {
      const res = await adminManualCredit(attendee.id, attendee.email, sponsorId, note.trim());
      const s = sponsors.find(x => x.id === sponsorId);
      toast.success(`Credited ${s?.name ?? 'sponsor'} — now ${res.totalPoints ?? res.points} pts${res.isComplete ? ' · passport complete!' : ''}`);
      setSponsorId('');
      setNote('');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err?.message ?? 'Credit failed.');
    } finally {
      setCrediting(false);
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Attendee details">
        <div className="drawer__head">
          <div style={{ minWidth: 0 }}>
            {loading || !attendee ? (
              <div className="skeleton" style={{ height: 44, width: 220, borderRadius: 10 }} />
            ) : (
              <>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.3px' }}>{fullName(attendee)}</div>
                <div style={{ color: 'var(--color-on-surface-muted)', fontSize: 13, marginTop: 2, wordBreak: 'break-all' }}>{attendee.email}</div>
              </>
            )}
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {attendee && (
          <div className="drawer__body">
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="dash-card" style={{ padding: 14, borderRadius: 14 }}>
                <div className="hero-stat__label">Points</div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, marginTop: 4 }}>{attendee.points ?? 0}</div>
              </div>
              <div className="dash-card" style={{ padding: 14, borderRadius: 14 }}>
                <div className="hero-stat__label">Stops</div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, marginTop: 4 }}>{stamped.size}</div>
              </div>
              <div className="dash-card" style={{ padding: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'flex-start' }}>
                <div className="hero-stat__label" style={{ marginBottom: 6 }}>Status</div>
                <StatusPill attendee={{ completed: attendee.completed, stampCount: stamped.size, points: attendee.points }} />
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--color-on-surface-var)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Registered {attendee.createdAt ? new Date(attendee.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div>
              {attendee.completed && attendee.completedAt && (
                <div style={{ color: '#065f46', fontWeight: 600 }}>Completed {new Date(attendee.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
              )}
            </div>

            {/* History */}
            <section>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Check-in history</h3>
              {history.length === 0 ? (
                <div className="empty-mini" style={{ padding: '16px 8px' }}>No stops collected yet.</div>
              ) : (
                <div className="feed">
                  {history.map((c, i) => (
                    <div key={c.id ?? i} className="feed__row" style={{ animation: 'none' }}>
                      <div className="feed__body">
                        <div className="feed__title">{c.sponsorName ?? c.sponsorId}</div>
                        <div className="feed__meta">
                          {new Date(c.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          {c.manualCredit && <> · <span className="pill pill--manual" style={{ padding: '1px 7px', fontSize: 10 }}>manual{c.manualCreditBy ? ` · ${c.manualCreditBy}` : ''}</span></>}
                        </div>
                        {c.manualCreditNote && <div className="feed__meta" style={{ fontStyle: 'italic' }}>“{c.manualCreditNote}”</div>}
                      </div>
                      <div className="feed__pts">+{c.pointsAwarded ?? c.points ?? 0}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Manual credit */}
            <section className="dash-card" style={{ padding: 16, borderRadius: 16, background: 'var(--color-surface-low)' }}>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlusCircle size={16} /> Give credit for a stop
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface-var)', marginBottom: 12 }}>
                Use this when someone clearly visited a table but the app didn't record it.
              </p>
              {creditable.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-on-surface-muted)' }}>This attendee already has every active sponsor stop.</div>
              ) : (
                <form onSubmit={handleCredit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select className="form-input" value={sponsorId} onChange={e => setSponsorId(e.target.value)} required aria-label="Sponsor">
                    <option value="">Choose a sponsor…</option>
                    {creditable.map(s => (
                      <option key={s.id} value={s.id}>{s.name} · {Number(s.pointValue) || 0} pts</option>
                    ))}
                  </select>
                  <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Why? (optional, e.g. “rep confirmed at table”)" />
                  <button className="btn btn-primary" type="submit" disabled={!sponsorId || crediting}>
                    {crediting ? 'Applying…' : 'Apply credit'}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </aside>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAttendeePage() {
  const [attendees, setAttendees] = useState([]);
  const [sponsors, setSponsors]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [query, setQuery]         = useState('');
  const [selected, setSelected]   = useState(null); // email

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ attendees: list }, { sponsors: sp }] = await Promise.all([
        adminListAttendees('all'),
        adminGetSponsors(),
      ]);
      setAttendees(list ?? []);
      setSponsors(sp ?? []);
    } catch {
      toast.error('Could not load attendees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all:       attendees.length,
    completed: attendees.filter(a => statusOf(a) === 'done').length,
    active:    attendees.filter(a => statusOf(a) === 'active').length,
    pending:   attendees.filter(a => statusOf(a) === 'pending').length,
  }), [attendees]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees
      .filter(a => filter === 'all'
        || (filter === 'completed' && statusOf(a) === 'done')
        || (filter === 'active'    && statusOf(a) === 'active')
        || (filter === 'pending'   && statusOf(a) === 'pending'))
      .filter(a => !q || fullName(a).toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q));
  }, [attendees, filter, query]);

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <AdminLayout
      title="Attendees"
      subtitle={loading ? 'Loading roster…' : `${attendees.length} registered · ${counts.completed} completed`}
      actions={
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Refresh
        </button>
      }
    >
      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-on-surface-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search by name or email"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search attendees"
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} className={`filter-chip${filter === f.key ? ' is-active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label} <span style={{ opacity: 0.7, fontWeight: 500 }}>· {counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                  <th style={{ textAlign: 'center' }}>Stops</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(a => (
                  <tr
                    key={a.id}
                    className="clickable-row"
                    tabIndex={0}
                    onClick={() => setSelected(a.email)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(a.email); } }}
                  >
                    <td style={{ fontWeight: 600 }}>{fullName(a)}</td>
                    <td style={{ color: 'var(--color-on-surface-var)', fontSize: 13 }}>{a.email}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>{a.points ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>{a.stampCount ?? 0}</td>
                    <td><StatusPill attendee={a} /></td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-mini">
                      {attendees.length === 0 ? 'No one has registered yet.' : 'No attendees match that search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <AttendeeDrawer
          email={selected}
          sponsors={sponsors}
          onClose={closeDrawer}
          onChanged={load}
        />
      )}
    </AdminLayout>
  );
}
