/**
 * AdminSettingsPage.jsx — /admin/settings
 * Editable form for key conference settings + az CLI reference.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminGetReadiness, adminUpdateSettings } from '../api';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable form state
  const [threshold, setThreshold]   = useState('');
  const [passportLive, setPassportLive] = useState(false);
  const [conferenceYear, setConferenceYear] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminGetReadiness();
      setData(d);
      // Pre-populate form from readiness payload values
      if (d?.settings) {
        if (d.settings.completionThresholdPoints != null) setThreshold(String(d.settings.completionThresholdPoints));
        if (d.settings.passportLive != null) setPassportLive(Boolean(d.settings.passportLive));
        if (d.settings.conferenceYear != null) setConferenceYear(String(d.settings.conferenceYear));
      } else {
        // Fallback: parse from check details
        const t = (d?.checks ?? []).find(c => c.id === 'completionThreshold' || c.id === 'threshold');
        if (t?.value != null) setThreshold(String(t.value));
        const l = (d?.checks ?? []).find(c => c.id === 'passportLive' || c.id === 'live');
        if (l?.value != null) setPassportLive(Boolean(l.value));
      }
    } catch {
      toast.error('Could not load configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    if (!threshold || !conferenceYear) {
      toast.error('Threshold and Conference Year are required.');
      return;
    }
    setSaving(true);
    try {
      await adminUpdateSettings({
        thresholdPoints: Number(threshold),
        passportLive,
        conferenceYear: Number(conferenceYear),
      });
      toast.success('Settings saved.');
    } catch {
      toast.error('Failed to save settings. Check your permissions.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Conference Settings</h1>

      {/* ── Editable Form ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-4)' }}>Live Settings</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Passport Live toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-2)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Passport Live</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 2 }}>Allow attendees to log in and collect stamps.</div>
            </div>
            <button
              type="button"
              onClick={() => setPassportLive(v => !v)}
              style={{
                width: 48, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: passportLive ? 'var(--color-primary)' : '#cbd5e1',
                position: 'relative', transition: 'background 0.2s',
                flexShrink: 0,
              }}
              aria-checked={passportLive}
              role="switch"
            >
              <span style={{
                position: 'absolute', top: 3, left: passportLive ? 24 : 3,
                width: 20, height: 20, borderRadius: 999, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Completion threshold */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Completion Threshold (points)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              placeholder="e.g. 300"
              required
            />
            <p style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
              Attendees who reach this point total are eligible for prizes.
            </p>
          </div>

          {/* Conference year */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Conference Year</label>
            <input
              className="form-input"
              type="number"
              min={2020}
              max={2099}
              value={conferenceYear}
              onChange={e => setConferenceYear(e.target.value)}
              placeholder={String(new Date().getFullYear())}
              required
            />
            <p style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
              Used in reset confirmation tokens and data partitioning.
            </p>
          </div>

          <div>
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
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
          If the API endpoint is unavailable, update environment variables directly through the
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
