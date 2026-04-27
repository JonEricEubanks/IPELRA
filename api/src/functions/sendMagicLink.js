/**
 * sendMagicLink.js — POST /api/auth/sendMagicLink
 *
 * Accepts: { email, firstName?, lastName? }
 * - Creates or updates the attendee document
 * - Generates a one-time magic link token (hashed in Cosmos)
 * - Sends the link via ACS Email
 *
 * Returns 200 on success (always generic message — never confirm/deny email existence)
 * Returns 400 on invalid input
 * Returns 429 when PASSPORT_LIVE is false (app not yet open)
 */

import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { generateMagicToken } from '../lib/auth.js';
import { getAttendeeByEmail, upsertAttendee } from '../lib/cosmos.js';
import { sendMagicLinkEmail } from '../lib/email.js';

// Simple email format check — not exhaustive; just prevents obvious garbage
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

app.http('sendMagicLink', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/sendMagicLink',
  handler: async (request) => {
    // ── Guard: app must be live ────────────────────────────────────────────
    if (process.env.PASSPORT_LIVE !== 'true') {
      return new Response(
        JSON.stringify({ error: 'The conference passport is not yet open. Please check back on October 5, 2026.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Parse + validate body ─────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const firstName = (body.firstName ?? '').trim() || null;
    const lastName  = (body.lastName  ?? '').trim() || null;

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Name fields must be safe strings if provided (max 100 chars, no control chars)
    const safeNameRegex = /^[^\x00-\x1f]{1,100}$/;
    if (firstName && !safeNameRegex.test(firstName)) {
      return new Response(
        JSON.stringify({ error: 'Invalid first name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (lastName && !safeNameRegex.test(lastName)) {
      return new Response(
        JSON.stringify({ error: 'Invalid last name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Generate token ────────────────────────────────────────────────────
    const { rawToken, tokenHash, expiry } = generateMagicToken();

    // ── Upsert attendee record ────────────────────────────────────────────
    const existing = await getAttendeeByEmail(email);
    const now = new Date().toISOString();

    const attendee = {
      id:                   existing?.id ?? uuidv4(),
      email,
      firstName:            firstName ?? existing?.firstName ?? null,
      lastName:             lastName  ?? existing?.lastName  ?? null,
      magicLinkTokenHash:   tokenHash,
      tokenExpiry:          expiry,
      totalPoints:          existing?.totalPoints          ?? 0,
      completedStamps:      existing?.completedStamps      ?? [],
      isComplete:           existing?.isComplete           ?? false,
      completedAt:          existing?.completedAt          ?? null,
      createdAt:            existing?.createdAt            ?? now,
      conferenceYear:       Number(process.env.CONFERENCE_YEAR ?? '2026'),
    };

    await upsertAttendee(attendee);

    // ── Send magic link email ─────────────────────────────────────────────
    // Fire and forget — we don't block the response on ACS polling
    // If ACS fails the attendee can request another link; failure is logged by App Insights
    sendMagicLinkEmail(email, rawToken, firstName).catch(err => {
      console.error('[sendMagicLink] ACS email send failed:', err.message);
    });

    // ── Respond ───────────────────────────────────────────────────────────
    // Always return the same message regardless of whether the email existed
    // to prevent email enumeration
    return new Response(
      JSON.stringify({ message: 'If that email is valid, a login link is on its way. Check your inbox (and spam folder).' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
