/**
 * AdminSettingsPage.jsx — /admin/settings
 * Read-only view of key conference settings + az CLI reference.
 * There is no backend endpoint to save these live — see the CLI section below.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetReadiness } from '../api';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminGetReadiness();
      setData(d);
    } catch {
      toast.error('Could not load configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derive display values from the readiness payload (settings block, or checks as a fallback)
  const threshold = data?.settings?.completionThresholdPoints
    ?? (data?.checks ?? []).find(c => c.id === 'completionThreshold' || c.id === 'threshold')?.value
    ?? null;
  const passportLive = data?.settings?.passportLive
    ?? (data?.checks ?? []).find(c => c.id === 'passportLive' || c.id === 'live')?.value
    ?? null;
  const conferenceYear = data?.settings?.conferenceYear ?? null;

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Conference Settings</h1>

      {/* ── Live Settings (read-only) ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-4)' }}>Live Settings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Passport Live */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-2)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Passport Live</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 2 }}>Allow attendees to log in and collect stamps.</div>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: passportLive ? 'var(--color-success-light, #dcfce7)' : '#e2e8f0',
              color: passportLive ? 'var(--color-success-dark, #166534)' : '#475569',
            }}>
              {passportLive == null ? 'Unknown' : passportLive ? 'On' : 'Off'}
            </span>
          </div>

          {/* Completion threshold */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Completion Threshold (points)</label>
            <div className="form-input" style={{ background: 'var(--color-bg-2)' }}>{threshold ?? '—'}</div>
            <p style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
              Attendees who reach this point total are eligible for prizes.
            </p>
          </div>

          {/* Conference year */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Conference Year</label>
            <div className="form-input" style={{ background: 'var(--color-bg-2)' }}>{conferenceYear ?? '—'}</div>
            <p style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
              Used in reset confirmation tokens and data partitioning.
            </p>
          </div>

          <p style={{ fontSize: 13, color: 'var(--color-text-2)', margin: 0 }}>
            These values are read-only here. Change them via the az CLI or Azure Portal — see below.
          </p>
        </div>
      </div>

      {/* ── Current Config (readiness) ───────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Current Configuration</h2>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            {loading ? '…' : <><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Refresh</>}
          </button>
        </div>

        {loading && !data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-md)' }} />)}
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
                  padding: 'var(--space-3)', background: 'var(--color-bg-2)', borderRadius: 'var(--radius-md)',
                }}>
                  <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{check.label ?? check.id}</div>
                    {check.detail && <div style={{ fontSize: 13, color, marginTop: 2 }}>{check.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── az CLI reference ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-3)' }}>Changing Settings via az CLI</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-4)' }}>
          There is no in-app save for these settings. Update the environment variables directly through the
          <strong> Azure Portal</strong> (Function App → Settings → Environment variables) or with the commands below.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <SettingBlock
            title="COMPLETION_THRESHOLD_POINTS"
            example={'az functionapp config appsettings set \\\n  --name <FUNCTION_APP_NAME> \\\n  --resource-group <RESOURCE_GROUP> \\\n  --settings "COMPLETION_THRESHOLD_POINTS=300"'}
          />
          <SettingBlock
            title="PASSPORT_LIVE"
            example={'az functionapp config appsettings set \\\n  --name <FUNCTION_APP_NAME> \\\n  --resource-group <RESOURCE_GROUP> \\\n  --settings "PASSPORT_LIVE=true"'}
          />
          <SettingBlock
            title="CONFERENCE_YEAR"
            example={'az functionapp config appsettings set \\\n  --name <FUNCTION_APP_NAME> \\\n  --resource-group <RESOURCE_GROUP> \\\n  --settings "CONFERENCE_YEAR=2026"'}
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

function SettingBlock({ title, example }) {
  return (
    <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 'var(--space-4)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace', marginBottom: 4 }}>{title}</div>
      <pre style={{
        background: '#1e293b', color: '#e2e8f0', borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)', fontSize: 12, overflowX: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
      }}>{example}</pre>
    </div>
  );
}
