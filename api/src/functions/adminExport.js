/**
 * adminExport.js — GET /api/admin/export
 *
 * Returns a CSV of all completed attendees for the prize drawing.
 *
 * Two auth methods (fallback if Google OAuth is unavailable):
 *   1. Primary: SWA Google OAuth (x-ms-client-principal)
 *   2. Emergency: x-export-secret header
 *
 * Returns 200: text/csv attachment
 * Returns 403: unauthorized
 */

import { app } from '@azure/functions';
import { requireAdminAuth, validateExportSecret } from '../lib/auth.js';
import { getAllAttendees } from '../lib/cosmos.js';

function toCsvRow(values) {
  return values
    .map(v => {
      const str = v == null ? '' : String(v);
      // Escape double-quotes, wrap in quotes if the value contains commas/quotes/newlines
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

app.http('adminExport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/export',
  handler: async (request) => {
    // Try primary auth (Google OAuth); fall back to export secret
    let authorized = false;
    try {
      requireAdminAuth(request);
      authorized = true;
    } catch {
      // Primary auth failed — try the emergency secret
    }

    if (!authorized) {
      try {
        validateExportSecret(request);
        authorized = true;
      } catch {
        // Both failed
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Provide admin credentials or a valid x-export-secret header.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const year = process.env.CONFERENCE_YEAR ?? '2026';
    const attendees = await getAllAttendees(year);
    const completed = attendees.filter(a => a.isComplete);

    const headers = ['Email', 'First Name', 'Last Name', 'Total Points', 'Completed At (UTC)', 'Completed At (CT)'];

    const rows = completed
      .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
      .map(a => {
        const completedCtStr = a.completedAt
          ? new Date(a.completedAt).toLocaleString('en-US', {
              timeZone: 'America/Chicago',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })
          : '';
        return toCsvRow([
          a.email,
          a.firstName ?? '',
          a.lastName  ?? '',
          a.totalPoints,
          a.completedAt ?? '',
          completedCtStr,
        ]);
      });

    const csv = [toCsvRow(headers), ...rows].join('\r\n');
    const filename = `ipelra-passport-${year}-completed.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
});
