/**
 * AdminReadinessPage.jsx — /admin/readiness
 * Live pre-conference checklist. Calls adminReadiness endpoint for system status.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetReadiness } from '../api';
import { CheckCircle2, AlertTriangle, XCircle, PartyPopper, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

function CheckItem({ label, status, detail }) {
  const Icon = status === 'ok' ? CheckCircle2 : status === 'warn' ? AlertTriangle : XCircle;
  const color = status === 'ok' ? 'var(--color-success-dark)' : status === 'warn' ? '#92400e' : '#b91c1c';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
      padding: 'var(--space-3) 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <Icon size={20} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {detail && <div style={{ fontSize: 13, color, marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  );
}

export default function AdminReadinessPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshed, setRefreshed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminGetReadiness();
      setData(d);
      setRefreshed(new Date());
    } catch {
      toast.error('Could not reach the readiness endpoint.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const checks = data?.checks ?? [];
  const allOk = checks.length > 0 && checks.every(c => c.status === 'ok');

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Readiness Check</h1>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? '…' : <><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Refresh</>}
        </button>
      </div>

      {refreshed && (
        <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginBottom: 'var(--space-4)' }}>
          Last checked: {refreshed.toLocaleTimeString()}
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      )}

      {data && (
        <>
          {allOk && (
            <div style={{
              background: 'var(--color-success-bg)', color: 'var(--color-success-dark)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-4)',
              fontWeight: 700, fontSize: 16, textAlign: 'center', marginBottom: 'var(--space-5)',
            }}>
              <PartyPopper size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />All systems go — ready for the conference!
            </div>
          )}

          <div className="card">
            {checks.map((check, i) => (
              <CheckItem key={i} label={check.label} status={check.status} detail={check.detail} />
            ))}
          </div>

          {data.sponsorCount !== undefined && (
            <div className="card" style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>{data.sponsorCount}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Active Sponsors</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-container)' }}>{data.threshold}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Points Threshold</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-success)' }}>{data.emailConfigured ? 'Yes' : 'No'}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Email Config</div>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
