/**
 * AdminSponsorsPage.jsx — /admin/sponsors
 * List all sponsors with isActive toggle. Links to edit/new.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminGetSponsors, adminPatchSponsor } from '../api';

export default function AdminSponsorsPage() {
  const navigate = useNavigate();
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGetSponsors()
      .then(d => setSponsors(d.sponsors ?? []))
      .catch(() => setError('Failed to load sponsors.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(sponsor) {
    setTogglingId(sponsor.id);
    try {
      await adminPatchSponsor(sponsor.id, { isActive: !sponsor.isActive });
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, isActive: !s.isActive } : s));
    } catch {
      setError('Failed to update sponsor.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Sponsors</h1>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/sponsors/new')}>
          + New Sponsor
        </button>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      )}

      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ textAlign: 'center' }}>Points</th>
                <th style={{ textAlign: 'center' }}>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sponsors.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ textAlign: 'center' }}>{s.points}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      style={{
                        background: s.isActive ? 'var(--color-success)' : '#d1d5db',
                        color: '#fff', border: 'none', borderRadius: 999,
                        padding: '4px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        opacity: togglingId === s.id ? 0.6 : 1,
                      }}
                      onClick={() => toggleActive(s)}
                      disabled={togglingId === s.id}
                    >
                      {s.isActive ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/sponsors/${s.id}`)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
