/**
 * getLeaderboard.js — GET /api/leaderboard
 *
 * Returns the top-50 attendees by points plus the calling user's rank
 * (appended even if outside top 50).
 *
 * Auth: requires valid attendee JWT
 * Returns 200: { rankings, myRank, totalParticipants }
 */

import { app } from '@azure/functions';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { getAllAttendeesForLeaderboard } from '../lib/cosmos.js';
import { jsonResponse as json } from '../lib/http.js';

app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: async (request) => {
    let principal;
    try {
      principal = requireAttendeeAuth(request);
    } catch (err) {
      return unauthorizedResponse(err.message);
    }

    const year = Number(process.env.CONFERENCE_YEAR ?? '2026');
    const sorted = await getAllAttendeesForLeaderboard(year, 200);

    const totalParticipants = sorted.length;
    const myFullIndex = sorted.findIndex(a => a.id === principal.sub);
    const myRank = myFullIndex >= 0 ? myFullIndex + 1 : null;

    // Build top-50 list
    const top50 = sorted.slice(0, 50).map((a, i) => ({
      rank:          i + 1,
      firstName:     a.firstName,
      lastInitial:   a.lastName ? a.lastName[0].toUpperCase() + '.' : '',
      points:        a.totalPoints ?? 0,
      isComplete:    a.isComplete ?? false,
      isCurrentUser: a.id === principal.sub,
    }));

    // If current user falls outside top 50, append their entry with a separator hint
    if (!top50.some(r => r.isCurrentUser) && myFullIndex >= 0) {
      const me = sorted[myFullIndex];
      top50.push({
        rank:          myFullIndex + 1,
        firstName:     me.firstName,
        lastInitial:   me.lastName ? me.lastName[0].toUpperCase() + '.' : '',
        points:        me.totalPoints ?? 0,
        isComplete:    me.isComplete ?? false,
        isCurrentUser: true,
        isSeparate:    true,
      });
    }

    return json(200, { rankings: top50, myRank, totalParticipants });
  },
});
