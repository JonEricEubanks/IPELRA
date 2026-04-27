/**
 * AdminSettingsPage.jsx — /admin/settings
 * Displays current app configuration (read from readiness) and documents
 * how to change settings via az CLI. PUT /api/admin/settings is not yet
 * implemented server-side; changes require az CLI or Azure Portal.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetReadiness } from '../api';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

export default function AdminSettingsPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await adminGetReadiness();
      setData(d);
    } catch {
      setError('Could not load configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pull named checks out of the readiness payload
  function getCheck(id) {
    return (data?.checks ?? []).find(c => c.id === id);
  }

  const thresholdCheck = getCheck('completionThreshold') ?? getCheck('threshold');
  const liveCheck      = getCheck('passportLive') ?? getCheck('live');

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Conference Settings</h1>

      {error && <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

      {/* Current config */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Current Configuration</h2>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            {loading ? '…' : <><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Refresh</>}
          </button>
        </div>

        {loading && !data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {(data.checks ?? []).map(check => {
              const Icon  = check.status === 'ok' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
              const color = check.status === 'ok' ? 'var(--color-success-dark)' : check.status === 'warn' ? '#92400e' : '#b91c1c';
              return (
                <div key={check.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg-2)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{check.label ?? check.id}</div>
                    {check.detail && (
                      <div style={{ fontSize: 13, color, marginTop: 2 }}>{check.detail}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How to change settings */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-3)' }}>
          Changing Settings
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-4)' }}>
          App settings are controlled via Azure Function App environment variables.
          Use the <strong>Azure Portal</strong> (Function App → Settings → Environment variables)
          or the commands below from a terminal with the Azure CLI installed.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <SettingBlock
            title="COMPLETION_THRESHOLD_POINTS"
            description="Minimum points for a passport to be considered complete (prize-eligible)."
            example='az functionapp config appsettings set \
  --name <FUNCTION_APP_NAME> \
  --resource-group <RESOURCE_GROUP> \
  --settings "COMPLETION_THRESHOLD_POINTS=300"'
          />
          <SettingBlock
            title="PASSPORT_LIVE"
            description='Set to "true" to open the conference passport to attendees. "false" shows a "not open yet" message on the login page.'
            example='az functionapp config appsettings set \
  --name <FUNCTION_APP_NAME> \
  --resource-group <RESOURCE_GROUP> \
  --settings "PASSPORT_LIVE=true"'
          />
          <SettingBlock
            title="CONFERENCE_YEAR"
            description="The current conference year (e.g. 2026). Used in reset confirmation tokens and data partitioning."
            example='az functionapp config appsettings set \
  --name <FUNCTION_APP_NAME> \
  --resource-group <RESOURCE_GROUP> \
  --settings "CONFERENCE_YEAR=2026"'
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="card">
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-3)' }}>Quick Links</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <a className="btn btn-ghost btn-sm" href="/admin/readiness">Full Readiness Check</a>
          <a className="btn btn-ghost btn-sm" href="/admin/reset">Conference Reset</a>
          <a className="btn btn-ghost btn-sm" href="/admin/export">Export Attendees</a>
        </div>
      </div>
    </AdminLayout>
  );
}

function SettingBlock({ title, description, example }) {
  return (
    <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 'var(--space-4)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 'var(--space-2)' }}>{description}</div>
      <pre style={{
        background: '#1e293b', color: '#e2e8f0',
        borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
        fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        margin: 0,
      }}>{example}</pre>
    </div>
  );
}
