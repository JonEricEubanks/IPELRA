/**
 * verifyToken.js — GET /api/auth/verify?token=<rawToken>
 *
 * Called by the frontend when the attendee clicks their magic link.
 *
 * Flow:
 * 1. Hash the incoming token
 * 2. Query Cosmos for an attendee with a matching hash among their pending
 *    magic-link tokens (an attendee may have several outstanding tokens if
 *    they requested more than one link — e.g. a slow/batching mail server)
 * 3. Check that specific token's expiry
 * 4. Invalidate ALL pending tokens for the attendee (one successful login
 *    consumes every outstanding link, not just the one that was clicked)
 * 5. Issue a signed session JWT
 * 6. Return the JWT + attendee profile
 *
 * Returns 200: { token, attendee: { id, email, firstName, lastName, totalPoints, isComplete } }
 * Returns 400: missing token parameter
 * Returns 401: token not found, already used, or expired
 */

import { app } from '@azure/functions';
import { hashToken, signAttendeeToken } from '../lib/auth.js';
import { attendees as attendeesContainer, upsertAttendee } from '../lib/cosmos.js';
import { jsonResponse as json } from '../lib/http.js';

async function findAttendeeByTokenHash(hash) {
  const { resources } = await attendeesContainer().items
    .query({
      query: 'SELECT DISTINCT VALUE c FROM c JOIN t IN c.magicLinkTokens WHERE t.hash = @hash',
      parameters: [{ name: '@hash', value: hash }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

app.http('verifyToken', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/verify',
  handler: async (request) => {
    const rawToken = new URL(request.url).searchParams.get('token') ?? '';

    if (!rawToken) {
      return json(400, { error: 'Missing token parameter' });
    }

    // Hash the incoming token to look it up in Cosmos
    const hash = hashToken(rawToken);
    const attendee = await findAttendeeByTokenHash(hash);

    if (!attendee) {
      return json(401, { error: 'This link is invalid or has already been used.' });
    }

    // Check expiry of the specific token that was clicked
    const matched = (attendee.magicLinkTokens ?? []).find(t => t.hash === hash);
    if (!matched || !matched.expiry || new Date(matched.expiry) < new Date()) {
      return json(401, { error: 'This link has expired. Please request a new one.' });
    }

    // Invalidate ALL pending tokens — a successful login consumes every
    // outstanding magic link so a stale copy can't be reused afterward.
    const updated = {
      ...attendee,
      magicLinkTokens: [],
    };
    await upsertAttendee(updated);

    // Issue session JWT
    const sessionToken = signAttendeeToken(attendee.id, attendee.email);

    return json(200, {
      token: sessionToken,
      attendee: {
        id:          attendee.id,
        email:       attendee.email,
        firstName:   attendee.firstName,
        lastName:    attendee.lastName,
        totalPoints: attendee.totalPoints,
        isComplete:  attendee.isComplete,
        completedAt: attendee.completedAt,
      },
    });
  },
});
