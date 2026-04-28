/**
 * AdminExportPage.jsx — /admin/export
 * Export attendee data as CSV or Excel (xlsx).
 */

import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminExportCsv, adminListAttendees } from '../api';
import { Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function AdminExportPage() {
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  async function handleCsvExport() {
    setExportingCsv(true);
    try {
      const blob = await adminExportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ipelra-passport-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV export downloaded.');
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleXlsxExport() {
    setExportingXlsx(true);
    try {
      const { attendees } = await adminListAttendees('all');

      const rows = attendees.map(a => ({
        'First Name':   a.firstName,
        'Last Name':    a.lastName,
        'Email':        a.email,
        'Points':       a.points,
        'Stops':        a.stampCount,
        'Completed':    a.completed ? 'Yes' : 'No',
        'Completed At': a.completedAt ? new Date(a.completedAt).toLocaleString() : '',
        'Registered':   a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      // Column widths
      ws['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 8 },
        { wch: 7 }, { wch: 11 }, { wch: 20 }, { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
      XLSX.writeFile(wb, `ipelra-passport-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Excel export downloaded (${rows.length} attendees).`);
    } catch {
      toast.error('Excel export failed. Try again.');
    } finally {
      setExportingXlsx(false);
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Export</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* CSV */}
        <div className="card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <Download size={20} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-2)' }}>CSV Export</h2>
          <p style={{ color: 'var(--color-text-2)', fontSize: 14, marginBottom: 'var(--space-4)' }}>
            Full attendee records direct from the server — name, email, points, completion status, and timestamps.
          </p>
          <button className="btn btn-primary btn-full" onClick={handleCsvExport} disabled={exportingCsv}>
            {exportingCsv ? 'Generating…' : 'Download CSV'}
          </button>
        </div>

        {/* Excel */}
        <div className="card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <FileSpreadsheet size={20} color="#fff" />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-2)' }}>Excel Export</h2>
          <p style={{ color: 'var(--color-text-2)', fontSize: 14, marginBottom: 'var(--space-4)' }}>
            Formatted .xlsx workbook with attendee roster, points, stop count, and completion status — ready for prize drawings.
          </p>
          <button
            className="btn btn-primary btn-full"
            style={{ fontWeight: 700 }}
            onClick={handleXlsxExport}
            disabled={exportingXlsx}
          >
            {exportingXlsx ? 'Building…' : 'Download Excel'}
          </button>
        </div>
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

