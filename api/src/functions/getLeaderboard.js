/**
 * getLeaderboard.js — GET /api/leaderboard?page=<n|me>&pageSize=<n>
 *
 * Returns one page of ranked tie groups (see lib/leaderboard.js) plus the
 * caller's own rank and the page it's on. `page=me` jumps to that page.
 *
 * Auth: requires valid attendee JWT
 * Returns 200: { groups, page, pageSize, totalPages, totalParticipants,
 *                myRank, myPoints, myTiedWith, myPage }
 */

import { app } from '@azure/functions';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { getAllAttendeesForLeaderboard } from '../lib/cosmos.js';
import { buildLeaderboard } from '../lib/leaderboard.js';
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

    const params   = new URL(request.url).searchParams;
    const pageRaw  = params.get('page');
    const page     = pageRaw === 'me' ? 'me' : Number(pageRaw) || 1;
    const pageSize = params.get('pageSize') ?? undefined;

    const year = Number(process.env.CONFERENCE_YEAR ?? '2026');
    const attendees = await getAllAttendeesForLeaderboard(year);

    return json(200, buildLeaderboard(attendees, principal.sub, page, pageSize));
  },
});
