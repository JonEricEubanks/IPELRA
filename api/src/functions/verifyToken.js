/**
 * verifyToken.js — GET /api/auth/verify?token=<rawToken>
 *
 * Called by the frontend when the attendee clicks their magic link.
 *
 * Flow:
 * 1. Hash the incoming token
 * 2. Query Cosmos for an attendee with a matching hash + valid expiry
 * 3. Invalidate the token (set hash and expiry to null — single use)
 * 4. Issue a signed session JWT
 * 5. Return the JWT + attendee profile
 *
 * Returns 200: { token, attendee: { id, email, firstName, lastName, totalPoints, isComplete } }
 * Returns 400: missing token parameter
 * Returns 401: token not found, already used, or expired
 */

import { app } from '@azure/functions';
import { hashToken, signAttendeeToken } from '../lib/auth.js';
import { attendees as attendeesContainer, upsertAttendee } from '../lib/cosmos.js';

async function findAttendeeByTokenHash(hash) {
  const { resources } = await attendeesContainer().items
    .query({
      query: 'SELECT * FROM c WHERE c.magicLinkTokenHash = @hash',
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
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Hash the incoming token to look it up in Cosmos
    const hash = hashToken(rawToken);
    const attendee = await findAttendeeByTokenHash(hash);

    if (!attendee) {
      return new Response(
        JSON.stringify({ error: 'This link is invalid or has already been used.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (!attendee.tokenExpiry || new Date(attendee.tokenExpiry) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This link has expired. Please request a new one.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate token — single use only
    const updated = {
      ...attendee,
      magicLinkTokenHash: null,
      tokenExpiry: null,
    };
    await upsertAttendee(updated);

    // Issue session JWT
    const sessionToken = signAttendeeToken(attendee.id, attendee.email);

    return new Response(
      JSON.stringify({
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
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
