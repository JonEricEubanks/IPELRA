/**
 * AdminExportPage.jsx — /admin/export
 * Export attendee CSV. Emergency reset section (requires secret).
 */

import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminExportCsv } from '../api';
import { Download } from 'lucide-react';

export default function AdminExportPage() {
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  async function handleExport() {
    setExporting(true);
    setExportMsg('');
    try {
      const blob = await adminExportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ipelra-passport-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('OK: Export downloaded.');
    } catch {
      setExportMsg('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Export</h1>

      {/* Export */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-2)' }}>Export Attendees</h2>
        <p style={{ color: 'var(--color-text-2)', fontSize: 14, marginBottom: 'var(--space-4)' }}>
          Downloads a CSV with all attendee records: name, email, points, completion status, and check-in timestamps.
        </p>
        <button className="btn btn-primary btn-lg" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Generating…' : <><Download size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Download CSV</>}
        </button>
        {exportMsg && (
          <div style={{
            marginTop: 'var(--space-3)', fontSize: 14,
            color: exportMsg.startsWith('OK:') ? 'var(--color-success-dark)' : 'var(--color-error)',
          }}>
            {exportMsg}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 'var(--space-2)' }}>Conference Reset</h2>
        <p style={{ color: 'var(--color-text-2)', fontSize: 14, marginBottom: 'var(--space-4)' }}>
          To archive all attendee data and start a new conference, use the dedicated Reset page.
          Export attendees first to preserve records.
        </p>
        <a className="btn btn-ghost btn-sm" href="/admin/reset">Go to Reset page →</a>
      </div>
    </AdminLayout>
  );
}
