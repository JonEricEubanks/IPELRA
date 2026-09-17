/**
 * getSponsors.js — GET /api/sponsors
 *
 * Returns all active sponsors sorted by displayOrder.
 * Used by the attendee passport home screen to render sponsor cards.
 *
 * Does NOT return promptAnswerKeyword — that field is never sent to the client.
 *
 * Auth: requires valid attendee JWT
 * Returns 200: { sponsors: [...], conferenceYear, passportLive, threshold }
 */

import { app } from '@azure/functions';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { getActiveSponsors } from '../lib/cosmos.js';
import { jsonResponse as json } from '../lib/http.js';

// Fields that must NEVER be sent to the client
const REDACTED_FIELDS = ['promptAnswerKeyword', 'qrCode'];

function sanitizeSponsor(sponsor) {
  const safe = { ...sponsor };
  for (const field of REDACTED_FIELDS) {
    delete safe[field];
  }
  // Normalize field names to what the UI expects
  if (safe.pointValue !== undefined && safe.points === undefined) {
    safe.points = safe.pointValue;
  }
  if (safe.promptQuestion !== undefined && safe.question === undefined) {
    safe.question = safe.promptQuestion;
  }
  if (safe.promptHint !== undefined && safe.hint === undefined) {
    safe.hint = safe.promptHint;
  }
  return safe;
}

app.http('getSponsors', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sponsors',
  handler: async (request) => {
    try {
      requireAttendeeAuth(request);
    } catch (err) {
      return unauthorizedResponse(err.message);
    }

    const sponsorDocs = await getActiveSponsors();

    return json(200, {
      sponsors: sponsorDocs.map(sanitizeSponsor),
      conferenceYear: Number(process.env.CONFERENCE_YEAR ?? '2026'),
      passportLive: process.env.PASSPORT_LIVE === 'true',
      threshold: Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '1000'),
      passportLockUtc: process.env.PASSPORT_LOCK_UTC ?? '2026-10-11T00:00:00Z',
    });
  },
});
