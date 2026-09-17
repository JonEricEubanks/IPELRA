/**
 * adminReset.js — POST /api/mgmt/resetConference
 *
 * Archives all attendee and checkin records from the current year by
 * setting their conferenceYear to a negative (archived) value, then
 * returns a summary. Does NOT delete any data.
 *
 * ⚠️  DESTRUCTIVE OPERATION — requires a confirmation token in the body
 *     to prevent accidental execution.
 *
 * Body: { confirmToken: "RESET-<currentYear>" }
 *
 * Auth: Admin JWT
 */

import { app } from '@azure/functions';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import { getAllAttendees, getAllCheckins, upsertAttendee } from '../lib/cosmos.js';
import { checkins as checkinsContainer } from '../lib/cosmos.js';
import { jsonResponse as json } from '../lib/http.js';

app.http('adminReset', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/resetConference',
  handler: async (request) => {
    let admin;
    try { admin = requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    let body;
    try { body = await request.json(); } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    const year = process.env.CONFERENCE_YEAR ?? '2026';
    const expectedToken = `RESET-${year}`;

    if (body.confirmToken !== expectedToken) {
      return json(400, {
        error: `Confirmation token required. Send { "confirmToken": "${expectedToken}" } to proceed.`,
      });
    }

    console.warn(`[adminReset] Conference reset initiated by ${admin.email} for year ${year}`);

    // Archive attendees by flipping conferenceYear to negative
    const allAttendees = await getAllAttendees(year);
    let archivedAttendees = 0;
    for (const a of allAttendees) {
      await upsertAttendee({ ...a, conferenceYear: -Number(year) });
      archivedAttendees++;
    }

    // Archive checkins
    const allCheckins = await getAllCheckins(year);
    let archivedCheckins = 0;
    for (const c of allCheckins) {
      try {
        await checkinsContainer().items.upsert({ ...c, conferenceYear: -Number(year) });
        archivedCheckins++;
      } catch (err) {
        console.error('[adminReset] Failed to archive checkin:', c.id, err.message);
      }
    }

    return json(200, {
      message:          `Conference ${year} data archived successfully.`,
      archivedAttendees,
      archivedCheckins,
      archivedBy:       admin.email,
      archivedAt:       new Date().toISOString(),
    });
  },
});
