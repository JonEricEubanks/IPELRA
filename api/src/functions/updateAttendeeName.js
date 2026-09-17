/**
 * updateAttendeeName.js — PATCH /api/attendee/name
 *
 * Allows a logged-in attendee to set or update their first and last name.
 * Called when an attendee skipped name entry at login and needs to add it later.
 *
 * Auth: requires valid attendee JWT
 * Body: { firstName, lastName }
 * Returns 200: { firstName, lastName }
 */

import { app } from '@azure/functions';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { getAttendeeById, upsertAttendee } from '../lib/cosmos.js';
import { jsonResponse as json } from '../lib/http.js';

app.http('updateAttendeeName', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'attendee/name',
  handler: async (request) => {
    // ── Auth ──────────────────────────────────────────────────────────────
    let principal;
    try {
      principal = requireAttendeeAuth(request);
    } catch (err) {
      return unauthorizedResponse(err.message);
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid request body.' });
    }

    const firstName = (body.firstName ?? '').trim();
    const lastName  = (body.lastName  ?? '').trim();

    if (!firstName || !lastName) {
      return json(400, { error: 'First name and last name are required.' });
    }

    // Limit length to prevent abuse
    if (firstName.length > 60 || lastName.length > 60) {
      return json(400, { error: 'Name is too long.' });
    }

    // ── Load + update attendee ────────────────────────────────────────────
    const attendee = await getAttendeeById(principal.sub);
    if (!attendee) {
      return json(404, { error: 'Attendee not found.' });
    }

    const updated = { ...attendee, firstName, lastName };
    await upsertAttendee(updated);

    return json(200, { firstName, lastName });
  },
});
