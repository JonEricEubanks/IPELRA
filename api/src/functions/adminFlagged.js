/**
 * adminFlagged.js — GET /api/admin/flagged
 *
 * Returns checkins where the attendee had failed attempts,
 * grouped by sponsor, so admins can review and fix bad keywords.
 *
 * Auth: SWA Google OAuth
 */

import { app } from '@azure/functions';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import { getFlaggedAnswers } from '../lib/cosmos.js';

app.http('adminFlagged', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/flagged',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const year = process.env.CONFERENCE_YEAR ?? '2026';
    const flagged = await getFlaggedAnswers(year);

    // Group by sponsorId for easier admin review
    const grouped = {};
    for (const c of flagged) {
      if (!grouped[c.sponsorId]) {
        grouped[c.sponsorId] = {
          sponsorId:   c.sponsorId,
          sponsorName: c.sponsorName,
          entries:     [],
        };
      }
      grouped[c.sponsorId].entries.push({
        attendeeEmail:   c.attendeeEmail,
        answerSubmitted: c.answerSubmitted,
        rejectedAnswers: c.rejectedAnswers,
        attemptCount:    c.attemptCount,
        failed:          c.failed,
        timestamp:       c.timestamp,
      });
    }

    return new Response(
      JSON.stringify({
        flaggedBySize: Object.values(grouped).sort((a, b) => b.entries.length - a.entries.length),
        totalFlagged:  flagged.length,
        asOf:          new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
