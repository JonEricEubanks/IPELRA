/**
 * AdminExportPage.jsx — /admin/export
 *
 * Three clearly-labelled downloads (all .xlsx so they open in Excel/Sheets):
 *   1. Prize drawing list   — completed attendees only, in the order they finished
 *   2. Full attendee roster — everyone who registered, with points and status
 *   3. Sponsor report       — check-ins per sponsor, ready to share with sponsors
 *
 * Below, collapsed by default so staff aren't distracted:
 *   • System status    — the technical readiness checks (for whoever set the app up)
 *   • Conference reset — archive this year's data (type RESET-<year> to confirm)
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminListAttendees, adminGetMetrics, adminGetReadiness, adminResetConference } from '../api';
import { Trophy, Users, Building2, ChevronDown, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

function downloadSheet(rows, sheetName, filename, widths) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Export cards ──────────────────────────────────────────────────────────────

function ExportCard({ Icon, title, blurb, count, busy, onClick, accent }) {
  return (
    <div className="dash-card" style={{ gap: 12 }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: accent ?? 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{title}</h2>
        <p style={{ color: 'var(--color-on-surface-var)', fontSize: 14, lineHeight: 1.5 }}>{blurb}</p>
      </div>
      <button className="btn btn-primary btn-full" onClick={onClick} disabled={busy}>
        {busy ? 'Preparing…' : `Download${count != null ? ` (${count})` : ''}`}
      </button>
    </div>
  );
}

// ── System status (collapsed) ────────────────────────────────────────────────

function SystemStatus() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await adminGetReadiness()); }
    catch { toast.error('Could not load system status.'); }
    finally { setLoading(false); }
  }, []);

  const checks = data?.checks ?? [];
  const errors = checks.filter(c => c.status === 'error').length;
  const warns  = checks.filter(c => c.status === 'warn').length;

  return (
    <details className="collapsible" onToggle={e => { if (e.currentTarget.open && !data && !loading) load(); }}>
      <summary>
        <span>System status <span style={{ fontWeight: 500, color: 'var(--color-on-surface-muted)', fontSize: 13 }}>· technical checks for whoever set up the app</span></span>
        <ChevronDown size={18} className="chev" />
      </summary>
      <div className="collapsible__body" style={{ paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-on-surface-var)' }}>
            {data
              ? (errors ? `${errors} problem${errors > 1 ? 's' : ''}` : warns ? `${warns} warning${warns > 1 ? 's' : ''}` : 'All checks passing')
              : 'Runs live against the server configuration.'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{loading ? 'Checking…' : 'Re-check'}
          </button>
        </div>
        {loading && !data && <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />}
        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {checks.map(c => {
              const Icon  = c.status === 'ok' ? CheckCircle2 : c.status === 'warn' ? AlertTriangle : XCircle;
              const color = c.status === 'ok' ? '#065f46' : c.status === 'warn' ? '#9a3412' : '#b91c1c';
              return (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--color-surface-low)', borderRadius: 10 }}>
                  <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</div>
                    {c.detail && <div style={{ fontSize: 12, color, marginTop: 2, wordBreak: 'break-word' }}>{c.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}

// ── Conference reset (collapsed, danger) ─────────────────────────────────────

function ConferenceReset({ year }) {
  const expected = `RESET-${year}`;
  const [token, setToken]         = useState('');
  const [resetting, setResetting] = useState(false);
  const [result, setResult]       = useState(null);
  const canSubmit = token === expected && !resetting;

  async function handleReset(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setResetting(true);
    try {
      const data = await adminResetConference(token);
      setResult(data);
      setToken('');
      toast.success('Conference data archived.');
    } catch (err) {
      toast.error(err?.message ?? 'Reset failed.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <details className="collapsible collapsible--danger">
      <summary>
        <span>Reset for next year <span style={{ fontWeight: 500, color: 'var(--color-on-surface-muted)', fontSize: 13 }}>· archives all attendee progress</span></span>
        <ChevronDown size={18} className="chev" />
      </summary>
      <div className="collapsible__body" style={{ paddingTop: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--color-on-surface-var)', lineHeight: 1.6, marginBottom: 14 }}>
          Do this <strong>after</strong> the conference, once you've downloaded the prize drawing list. Nothing is deleted —
          records are stamped as archived so the app starts fresh for next year.
        </p>
        {result && (
          <div className="alert alert--success">
            Archived <strong>{result.archivedAttendees ?? 0}</strong> attendees and <strong>{result.archivedCheckins ?? 0}</strong> check-ins.
          </div>
        )}
        <form onSubmit={handleReset} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={`Type ${expected} to confirm`}
            autoComplete="off"
            spellCheck={false}
            style={{ flex: '1 1 240px', fontFamily: 'monospace' }}
            aria-label="Confirmation token"
          />
          <button
            type="submit"
            className="btn"
            disabled={!canSubmit}
            style={{ background: canSubmit ? '#ef4444' : '#fca5a5', color: '#fff', border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            {resetting ? 'Archiving…' : `Archive ${year} data`}
          </button>
        </form>
      </div>
    </details>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminExportPage() {
  const [busy, setBusy]       = useState(null);   // 'prize' | 'roster' | 'sponsors'
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    adminGetMetrics().then(setMetrics).catch(() => {});
  }, []);

  const year = metrics?.passport?.conferenceYear ?? new Date().getFullYear();

  async function exportPrizeList() {
    setBusy('prize');
    try {
      const { attendees } = await adminListAttendees('completed');
      const rows = attendees
        .slice()
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
        .map((a, i) => ({
          '#':           i + 1,
          'First Name':  a.firstName ?? '',
          'Last Name':   a.lastName ?? '',
          'Email':       a.email,
          'Points':      a.points ?? 0,
          'Completed At': fmtDateTime(a.completedAt),
        }));
      downloadSheet(rows, 'Prize Drawing', `ipelra-${year}-prize-drawing-${today()}.xlsx`, [5, 14, 14, 32, 8, 22]);
      toast.success(`Prize drawing list downloaded — ${rows.length} entries.`);
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function exportRoster() {
    setBusy('roster');
    try {
      const { attendees } = await adminListAttendees('all');
      const rows = attendees.map(a => ({
        'First Name':   a.firstName ?? '',
        'Last Name':    a.lastName ?? '',
        'Email':        a.email,
        'Points':       a.points ?? 0,
        'Stops':        a.stampCount ?? 0,
        'Status':       a.completed ? 'Completed' : (a.stampCount ?? 0) > 0 ? 'In progress' : 'Not started',
        'Completed At': fmtDateTime(a.completedAt),
        'Registered':   a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
      }));
      downloadSheet(rows, 'Attendees', `ipelra-${year}-attendees-${today()}.xlsx`, [14, 14, 32, 8, 7, 13, 22, 12]);
      toast.success(`Attendee roster downloaded — ${rows.length} people.`);
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function exportSponsors() {
    setBusy('sponsors');
    try {
      const m = metrics ?? await adminGetMetrics();
      const rows = m.sponsors.map(s => ({
        'Sponsor':     s.sponsorName,
        'Tier':        s.tier ? s.tier[0].toUpperCase() + s.tier.slice(1) : '',
        'Points':      s.pointValue,
        'Active':      s.isActive ? 'Yes' : 'No',
        'Check-ins':   s.checkinCount,
        '% of attendees': m.totalAttendees ? `${Math.round((s.checkinCount / m.totalAttendees) * 100)}%` : '0%',
      }));
      downloadSheet(rows, 'Sponsors', `ipelra-${year}-sponsor-report-${today()}.xlsx`, [28, 12, 8, 8, 10, 15]);
      toast.success(`Sponsor report downloaded — ${rows.length} sponsors.`);
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout title="Export" subtitle="Everything downloads as an Excel file you can open, sort, or forward.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
        <ExportCard
          Icon={Trophy}
          accent="linear-gradient(135deg, #1a7f5a 0%, #2d8c6a 100%)"
          title="Prize drawing list"
          blurb="Only attendees who completed their passport, numbered in the order they finished. This is the list to draw from."
          count={metrics?.completedCount}
          busy={busy === 'prize'}
          onClick={exportPrizeList}
        />
        <ExportCard
          Icon={Users}
          title="Full attendee roster"
          blurb="Everyone who registered — name, email, points, stops collected, and status. Good for follow-up and headcounts."
          count={metrics?.totalAttendees}
          busy={busy === 'roster'}
          onClick={exportRoster}
        />
        <ExportCard
          Icon={Building2}
          accent="linear-gradient(135deg, #2d1b6e 0%, #3b2f8c 100%)"
          title="Sponsor report"
          blurb="Check-ins per sponsor table and what share of attendees visited each one. Handy to share with sponsors afterward."
          count={metrics?.totalSponsors}
          busy={busy === 'sponsors'}
          onClick={exportSponsors}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SystemStatus />
        <ConferenceReset year={year} />
      </div>
    </AdminLayout>
  );
}
