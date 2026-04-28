/**
 * AdminDashboardPage.jsx — /admin
 * Metrics grid, charts, top sponsors, recent completions. 30s auto-refresh.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetMetrics } from '../api';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color ?? 'var(--color-primary)'}` }}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const CHART_COLORS = ['#1d3461', '#254a84', '#2d5fa0', '#3574bc', '#8b5cf6', '#06b6d4', '#f43f5e'];

function SponsorsBarChart({ data }) {
  if (!data?.length) return null;
  return (
    <div className="card" style={{ padding: '20px 8px 8px 8px', marginBottom: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, paddingLeft: 12, marginBottom: 12 }}>Check-ins by Sponsor</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: '#334155' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(29,52,97,0.06)' }}
            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13 }}
            formatter={(v) => [v, 'Check-ins']}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompletionRadial({ pct }) {
  const data = [{ name: 'Completed', value: pct, fill: '#1d3461' }];
  return (
    <div className="card" style={{ padding: '20px 8px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, alignSelf: 'flex-start', paddingLeft: 12 }}>Completion Rate</h2>
      <div style={{ position: 'relative', width: '100%', maxWidth: 200, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="65%" outerRadius="90%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#e2e8f0' }}
              dataKey="value"
              angleAxisId={0}
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#1d3461', lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>completed</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await adminGetMetrics();
      setMetrics(data);
      setLastRefresh(new Date());
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Dashboard</h1>
        {lastRefresh && (
          <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            Refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-card)' }} />)}
        </div>
      )}

      {metrics && (
        <>
          <div className="stat-grid">
            <StatCard label="Registered" value={metrics.totalAttendees} color="var(--color-primary)" />
            <StatCard label="Active (any check-in)" value={metrics.activeAttendees} color="#8b5cf6" />
            <StatCard label="Completed" value={metrics.completedCount} color="var(--color-success)" />
            <StatCard label="Completion %" value={metrics.totalAttendees ? `${Math.round((metrics.completedCount / metrics.totalAttendees) * 100)}%` : '—'} color="#6ea8d8" />
            <StatCard label="Total Check-ins" value={metrics.totalCheckins} color="#f43f5e" />
            <StatCard label="Sponsors Active" value={metrics.activeSponsors} color="#06b6d4" />
          </div>

          {/* Charts row */}
          {(metrics.topSponsors?.length > 0 || metrics.totalAttendees > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: metrics.topSponsors?.length > 0 ? '1fr auto' : '1fr', gap: 'var(--space-4)', marginTop: 'var(--space-5)', alignItems: 'start' }}>
              {metrics.topSponsors?.length > 0 && (
                <SponsorsBarChart data={metrics.topSponsors} />
              )}
              {metrics.totalAttendees > 0 && (
                <div style={{ minWidth: 180 }}>
                  <CompletionRadial pct={Math.round((metrics.completedCount / metrics.totalAttendees) * 100)} />
                </div>
              )}
            </div>
          )}

          {/* Recent completions */}
          {metrics.recentCompletions?.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 'var(--space-6) 0 var(--space-3)' }}>Recent Completions</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Attendee</th>
                      <th>Completed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentCompletions.map((a, i) => (
                      <tr key={i}>
                        <td>{a.email}</td>
                        <td style={{ color: 'var(--color-text-2)' }}>
                          {new Date(a.completedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
}
