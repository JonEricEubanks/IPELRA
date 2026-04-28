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
      return new Response(
        JSON.stringify({ error: 'Invalid request body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const firstName = (body.firstName ?? '').trim();
    const lastName  = (body.lastName  ?? '').trim();

    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'First name and last name are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limit length to prevent abuse
    if (firstName.length > 60 || lastName.length > 60) {
      return new Response(
        JSON.stringify({ error: 'Name is too long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Load + update attendee ────────────────────────────────────────────
    const attendee = await getAttendeeById(principal.sub);
    if (!attendee) {
      return new Response(
        JSON.stringify({ error: 'Attendee not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = { ...attendee, firstName, lastName };
    await upsertAttendee(updated);

    return new Response(
      JSON.stringify({ firstName, lastName }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
