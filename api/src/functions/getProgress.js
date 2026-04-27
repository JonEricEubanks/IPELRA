/**
 * getProgress.js — GET /api/progress
 *
 * Returns the authenticated attendee's current passport progress.
 * Used by the passport home screen on mount and after each checkin.
 *
 * Auth: requires valid attendee JWT
 * Returns 200: { attendee, completedCheckins, threshold, passportLockUtc }
 */

import { app } from '@azure/functions';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { getAttendeeById, getCheckinsByAttendee } from '../lib/cosmos.js';

app.http('getProgress', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'progress',
  handler: async (request) => {
    let principal;
    try {
      principal = requireAttendeeAuth(request);
    } catch (err) {
      return unauthorizedResponse(err.message);
    }

    const attendee = await getAttendeeById(principal.sub, principal.email);
    if (!attendee) {
      return new Response(
        JSON.stringify({ error: 'Attendee not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load successful checkins only (failed=false or field absent)
    const allCheckins = await getCheckinsByAttendee(principal.sub);
    const completedCheckins = allCheckins
      .filter(c => !c.failed)
      .map(c => ({
        sponsorId:     c.sponsorId,
        sponsorName:   c.sponsorName,
        pointsAwarded: c.pointsAwarded,
        timestamp:     c.timestamp,
        manualCredit:  c.manualCredit,
      }));

    return new Response(
      JSON.stringify({
        attendee: {
          id:              attendee.id,
          email:           attendee.email,
          firstName:       attendee.firstName,
          lastName:        attendee.lastName,
          totalPoints:     attendee.totalPoints,
          completedStamps: attendee.completedStamps,
          isComplete:      attendee.isComplete,
          completedAt:     attendee.completedAt,
        },
        completedCheckins,
        threshold:       Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '1000'),
        passportLive:    process.env.PASSPORT_LIVE === 'true',
        passportLockUtc: process.env.PASSPORT_LOCK_UTC ?? '2026-10-11T00:00:00Z',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
