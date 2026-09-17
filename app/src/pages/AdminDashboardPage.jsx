/**
 * AdminDashboardPage.jsx — /admin/dashboard
 *
 * The staff "numbers" screen. Designed to sit on a laptop at the registration
 * desk or in a staffer's hand. Auto-refreshes every 30s.
 *
 *   Hero row     — Registered · Completed (with % ring) · Check-ins today · Almost there
 *   Activity     — check-ins per hour across the conference
 *   Sponsors     — every sponsor ranked by check-ins; dead tables highlighted
 *   Progress     — how many attendees have 0 / 1 / 2 / … stops
 *   Live feed    — most recent check-ins
 *   Attention    — sponsors where attendees have burned all their attempts
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminGetMetrics } from '../api';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, LabelList,
} from 'recharts';
import { Users, Trophy, Zap, Flag, AlertTriangle, RefreshCw } from 'lucide-react';

const REFRESH_MS = 30_000;
// The conference runs ~3 days; older buckets just squash the chart
const ACTIVITY_WINDOW_HOURS = 72;

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtHour(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric' });
}
function fmtDayHour(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric' });
}
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts[0].includes('@')) return parts[0][0].toUpperCase();
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('');
}
function relTime(iso, now) {
  const s = Math.max(0, Math.round((now - new Date(iso)) / 1000));
  if (s < 60)   return 'just now';
  const m = Math.round(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)   return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Widgets ───────────────────────────────────────────────────────────────────

function LivePill({ passport }) {
  if (passport.closed) return <span className="live-pill live-pill--closed"><span className="live-pill__dot" />Passport closed</span>;
  if (passport.live)   return <span className="live-pill live-pill--live"><span className="live-pill__dot" />Passport live</span>;
  return <span className="live-pill live-pill--off"><span className="live-pill__dot" />Not open yet</span>;
}

function HeroStat({ label, value, sub, Icon, primary }) {
  return (
    <div className={`hero-stat${primary ? ' hero-stat--primary' : ''}`}>
      {Icon && <Icon size={64} className="hero-stat__icon" />}
      <div className="hero-stat__label">{label}</div>
      <div>
        <div className="hero-stat__value">{value}</div>
        {sub && <div className="hero-stat__sub">{sub}</div>}
      </div>
    </div>
  );
}

function CompletionRing({ pct, size = 64 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="hero-stat__ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={8} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#6ee7b7" strokeWidth={8} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize={size * 0.24} fontWeight={800} fontFamily="Manrope, sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

function ActivityChart({ hourly }) {
  // Only show the most recent window so a week of sporadic test check-ins
  // doesn't flatten the real conference traffic into a sliver.
  const recent = useMemo(() => {
    const cutoff = Date.now() - ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000;
    const inWindow = hourly.filter(h => new Date(h.hour).getTime() >= cutoff);
    return inWindow.length ? inWindow : hourly.slice(-ACTIVITY_WINDOW_HOURS);
  }, [hourly]);

  const multiDay = useMemo(() => {
    if (recent.length < 2) return false;
    const a = new Date(recent[0].hour), b = new Date(recent[recent.length - 1].hour);
    return a.toDateString() !== b.toDateString();
  }, [recent]);

  if (!recent.length) return <div className="empty-mini">Check-in activity will appear here once the passport opens.</div>;

  const data = recent.map(h => ({ ...h, label: multiDay ? fmtDayHour(h.hour) : fmtHour(h.hour) }));
  const totalInWindow = recent.reduce((n, h) => n + h.count, 0);
  return (
    <>
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#254a84" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#254a84" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#edeeef" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#74777f' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#74777f' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }}
          labelFormatter={(_, p) => p?.[0]?.payload ? fmtDayHour(p[0].payload.hour) : ''}
          formatter={(v) => [v, 'Check-ins']}
        />
        <Area type="monotone" dataKey="count" stroke="#1d3461" strokeWidth={2.5} fill="url(#dashArea)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
    <div className="dash-card__hint" style={{ textAlign: 'center', marginTop: 4 }}>
      {totalInWindow} check-ins in the last {ACTIVITY_WINDOW_HOURS / 24} days
    </div>
    </>
  );
}

function SponsorRanking({ sponsors }) {
  const active = sponsors.filter(s => s.isActive);
  if (!active.length) return <div className="empty-mini">No active sponsors yet.</div>;
  const max = Math.max(...active.map(s => s.checkinCount), 1);
  return (
    <div className="rank-list">
      {active.map((s, i) => {
        const dead = s.checkinCount === 0;
        return (
          <div key={s.sponsorId} className={`rank-row${dead ? ' rank-row--dead' : ''}`}>
            <div className="rank-row__num">{i + 1}</div>
            <div className="rank-row__name">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sponsorName}</span>
              {dead && <span className="dead-badge">No visits</span>}
              {s.stuckAttendees > 0 && <span className="stuck-badge">{s.stuckAttendees} stuck</span>}
            </div>
            <div className="rank-row__count">{s.checkinCount}</div>
            <div className="rank-row__bar-wrap">
              <div className={`rank-row__bar${dead ? ' rank-row__bar--dead' : ''}`} style={{ width: `${dead ? 100 : (s.checkinCount / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StopsFunnel({ funnel, activeSponsors, threshold }) {
  const total = funnel.reduce((n, f) => n + f.count, 0);
  if (!total) return <div className="empty-mini">No attendees registered yet.</div>;
  const data = funnel.map(f => ({ ...f, label: `${f.stops}` }));
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#43474e', fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'rgba(29,52,97,0.05)' }}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }}
            labelFormatter={(l) => `${l} stop${l === '1' ? '' : 's'}`}
            formatter={(v) => [v, 'Attendees']}
          />
          <Bar dataKey="count" radius={[8, 8, 8, 8]} maxBarSize={44}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.stops === 0 ? '#c3c6cf' : d.stops >= activeSponsors ? '#1a7f5a' : '#254a84'} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700, fill: '#191c1d' }} formatter={(v) => (v > 0 ? v : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="dash-card__hint" style={{ textAlign: 'center', marginTop: 4 }}>
        Number of stops collected · {activeSponsors} active {activeSponsors === 1 ? 'sponsor' : 'sponsors'}{threshold ? ` · ${threshold} pts to complete` : ''}
      </div>
    </>
  );
}

function LiveFeed({ items, now }) {
  if (!items.length) return <div className="empty-mini">The first check-in will show up here.</div>;
  return (
    <div className="feed">
      {items.map((c, i) => (
        <div key={`${c.attendeeEmail}-${c.timestamp}-${i}`} className="feed__row">
          <div className="feed__avatar">{initials(c.attendeeName)}</div>
          <div className="feed__body">
            <div className="feed__title">{c.attendeeName} <em>→ {c.sponsorName}</em></div>
            <div className="feed__meta">
              {relTime(c.timestamp, now)} · {fmtTime(c.timestamp)}
              {c.manualCredit && <> · <span className="pill pill--manual" style={{ padding: '1px 7px', fontSize: 10 }}>manual</span></>}
            </div>
          </div>
          <div className="feed__pts">+{c.pointsAwarded}</div>
        </div>
      ))}
    </div>
  );
}

function CompletionsFeed({ items, now }) {
  if (!items.length) return <div className="empty-mini">Nobody has finished yet — they will!</div>;
  return (
    <div className="feed">
      {items.map((a, i) => (
        <div key={`${a.email}-${i}`} className="feed__row">
          <div className="feed__avatar feed__avatar--done"><Trophy size={15} /></div>
          <div className="feed__body">
            <div className="feed__title">{a.name}</div>
            <div className="feed__meta">{relTime(a.completedAt, now)} · {a.email}</div>
          </div>
          <div className="feed__pts">{a.totalPoints} pts</div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [metrics, setMetrics]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [lastRefresh, setLast]  = useState(null);
  const [now, setNow]           = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const data = await adminGetMetrics();
      setMetrics(data);
      setError('');
      setLast(new Date());
      setNow(Date.now());
    } catch {
      setError('Could not refresh — showing the last numbers we had.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const pct = metrics?.completionRate ?? 0;

  return (
    <AdminLayout
      wide
      title="Dashboard"
      subtitle={lastRefresh ? `Live · updates every 30s · last ${lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Loading conference numbers…'}
      actions={
        <>
          {metrics && <LivePill passport={metrics.passport} />}
          <button className="btn btn-ghost btn-sm" onClick={load} aria-label="Refresh now">
            <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Refresh
          </button>
        </>
      }
    >
      {error && <div className="alert alert--warn" role="alert">{error}</div>}

      {loading && !metrics && (
        <div className="hero-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 118, borderRadius: 20 }} />)}
        </div>
      )}

      {metrics && (
        <>
          {/* ── Hero row ─────────────────────────────────────────── */}
          <div className="hero-grid">
            <HeroStat
              label="Registered"
              value={metrics.totalAttendees}
              sub={`${metrics.activeAttendees} have started`}
              Icon={Users}
            />
            <div className="hero-stat hero-stat--primary">
              <Trophy size={64} className="hero-stat__icon" />
              <div className="hero-stat__label">Completed</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="hero-stat__value">{metrics.completedCount}</div>
                  <div className="hero-stat__sub">{pct}% · in the prize drawing</div>
                </div>
                <CompletionRing pct={pct} />
              </div>
            </div>
            <HeroStat
              label="Check-ins today"
              value={metrics.checkinsToday}
              sub={`${metrics.totalCheckins} total`}
              Icon={Zap}
            />
            <HeroStat
              label="Almost there"
              value={metrics.almostThere}
              sub="one stop from finishing"
              Icon={Flag}
            />
          </div>

          {/* ── Needs attention (only when there's something) ──── */}
          {(metrics.needsAttention.length > 0 || metrics.contentIssues.length > 0) && (
            <div className="dash-card attention-card" style={{ marginBottom: 16 }}>
              <div className="dash-card__head" style={{ marginBottom: 6 }}>
                <div className="dash-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9a3412' }}>
                  <AlertTriangle size={16} /> Needs attention
                </div>
              </div>
              {metrics.contentIssues.map((c, i) => (
                <div key={`c-${c.sponsorId}-${i}`} className="attention-row">
                  <span><strong>{c.sponsorName}</strong> — {c.issue}</span>
                  <Link to={`/admin/sponsors/${c.sponsorId}?from=attention`} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>Fix</Link>
                </div>
              ))}
              {metrics.needsAttention.map(s => (
                <div key={s.sponsorId} className="attention-row">
                  <span>
                    <strong>{s.sponsorName}</strong> — {s.stuckAttendees} attendee{s.stuckAttendees === 1 ? '' : 's'} used all 3 answer attempts.
                    <span style={{ color: 'var(--color-on-surface-muted)' }}> The rep may be giving a different answer than the keyword.</span>
                  </span>
                  <Link to={`/admin/sponsors/${s.sponsorId}?from=attention`} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>Review</Link>
                </div>
              ))}
            </div>
          )}

          {/* ── Main grid ────────────────────────────────────────── */}
          <div className="dash-grid">
            <div className="dash-card dash-span-8">
              <div className="dash-card__head">
                <div className="dash-card__title">Check-in activity</div>
                <div className="dash-card__hint">per hour</div>
              </div>
              <ActivityChart hourly={metrics.hourly} />
            </div>

            <div className="dash-card dash-span-4">
              <div className="dash-card__head">
                <div className="dash-card__title">How far along is the room?</div>
              </div>
              <StopsFunnel funnel={metrics.funnel} activeSponsors={metrics.activeSponsors} threshold={metrics.passport.threshold} />
            </div>

            <div className="dash-card dash-span-6">
              <div className="dash-card__head">
                <div className="dash-card__title">Sponsor tables</div>
                <div className="dash-card__hint">check-ins · all active sponsors</div>
              </div>
              <SponsorRanking sponsors={metrics.sponsors} />
            </div>

            <div className="dash-card dash-span-6">
              <div className="dash-card__head">
                <div className="dash-card__title">Live feed</div>
                <div className="dash-card__hint">latest check-ins</div>
              </div>
              <LiveFeed items={metrics.recentCheckins} now={now} />
            </div>

            <div className="dash-card dash-span-12">
              <div className="dash-card__head">
                <div className="dash-card__title">Recent completions</div>
                <div className="dash-card__hint">{metrics.completedCount} total · entered in the drawing</div>
              </div>
              <CompletionsFeed items={metrics.recentCompletions.slice(0, 10)} now={now} />
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
