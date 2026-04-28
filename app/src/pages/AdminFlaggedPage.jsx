/**
 * AdminFlaggedPage.jsx — /admin/flagged
 * Shows attendees with repeated wrong answers, grouped by sponsor.
 */

import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetFlagged } from '../api';
import { PartyPopper, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminFlaggedPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetFlagged()
      .then(d => setData(d))
      .catch(() => toast.error('Failed to load flagged entries.'))
      .finally(() => setLoading(false));
  }, []);

  const groups = data?.bySponsor ?? [];
  const total = groups.reduce((acc, g) => acc + g.entries.length, 0);

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flagged Attempts</h1>
        {!loading && <span style={{ color: 'var(--color-text-2)', fontSize: 14 }}>{total} total</span>}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-card)' }} />)}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-2)', padding: 'var(--space-8)' }}>
          <PartyPopper size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />No flagged attempts — all clear!
        </div>
      )}

      {groups.map(group => (
        <div key={group.sponsorId} className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 'var(--space-3)' }}>
            <Building2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{group.sponsorName}
            <span style={{
              marginLeft: 10, fontSize: 13, background: '#fee2e2', color: '#b91c1c',
              borderRadius: 999, padding: '2px 10px',
            }}>
              {group.entries.length} flag{group.entries.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Attendee</th>
                  <th style={{ textAlign: 'right' }}>Wrong Attempts</th>
                  <th>Last Tried</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((e, i) => (
                  <tr key={i}>
                    <td>{e.email}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>{e.failCount}</td>
                    <td style={{ color: 'var(--color-text-2)', fontSize: 13 }}>
                      {new Date(e.lastAttempt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </AdminLayout>
  );
}
