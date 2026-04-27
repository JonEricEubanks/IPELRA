/**
 * AdminDashboardPage.jsx — /admin
 * Metrics grid, top sponsors, recent completions. 30s auto-refresh.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetMetrics } from '../api';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color ?? 'var(--color-primary)'}` }}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2 }}>{sub}</div>}
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
            <StatCard label="Completion %" value={metrics.totalAttendees ? `${Math.round((metrics.completedCount / metrics.totalAttendees) * 100)}%` : '—'} color="var(--color-gold)" />
            <StatCard label="Total Check-ins" value={metrics.totalCheckins} color="#f43f5e" />
            <StatCard label="Sponsors Active" value={metrics.activeSponsors} color="#06b6d4" />
          </div>

          {/* Top sponsors */}
          {metrics.topSponsors?.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 'var(--space-6) 0 var(--space-3)' }}>Top Sponsor Stops</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Sponsor</th>
                      <th style={{ textAlign: 'right' }}>Check-ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topSponsors.map(s => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
