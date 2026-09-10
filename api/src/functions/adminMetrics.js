/**
 * adminMetrics.js — GET /api/mgmt/metrics
 *
 * Returns live conference metrics for the admin dashboard.
 *
 * Auth: requires admin JWT (Authorization: Bearer <token>)
 * Returns 200: { totals, completionRate, topSponsors, recentCompletions, asOf }
 */

import { app } from '@azure/functions';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import { getAllAttendees, getAllCheckins, getAllSponsors } from '../lib/cosmos.js';

app.http('adminMetrics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/metrics',
  handler: async (request) => {
    try {
      requireAdminAuth(request);
    } catch (err) {
      return forbiddenResponse(err.message);
    }

    const year = process.env.CONFERENCE_YEAR ?? '2026';
    const [attendeeList, checkinList, sponsorList] = await Promise.all([
      getAllAttendees(year),
      getAllCheckins(year),
      getAllSponsors(),
    ]);

    const successCheckins = checkinList.filter(c => !c.failed);
    const completedAttendees = attendeeList.filter(a => a.isComplete);

    // Checkins grouped by sponsor
    const bySponsors = {};
    for (const c of successCheckins) {
      bySponsors[c.sponsorId] = (bySponsors[c.sponsorId] ?? { name: c.sponsorName, count: 0 });
      bySponsors[c.sponsorId].count++;
    }
    const topSponsors = Object.entries(bySponsors)
      .map(([id, { name, count }]) => ({ sponsorId: id, sponsorName: name, checkinCount: count }))
      .sort((a, b) => b.checkinCount - a.checkinCount)
      .slice(0, 10);

    const recentCompletions = completedAttendees
      .filter(a => a.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 20)
      .map(a => ({
        email:       a.email,
        firstName:   a.firstName,
        lastName:    a.lastName,
        completedAt: a.completedAt,
        totalPoints: a.totalPoints,
      }));

    return new Response(
      JSON.stringify({
        totals: {
          registeredAttendees: attendeeList.length,
          completedPassports:  completedAttendees.length,
          totalCheckins:       successCheckins.length,
          failedAttempts:      checkinList.filter(c => c.failed).length,
          activeSponsors:      sponsorList.filter(s => s.isActive).length,
          totalSponsors:       sponsorList.length,
        },
        completionRate: attendeeList.length > 0
          ? Math.round((completedAttendees.length / attendeeList.length) * 100)
          : 0,
        topSponsors,
        recentCompletions,
        asOf: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
