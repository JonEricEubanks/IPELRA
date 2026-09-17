/**
 * sendMagicLink.js — POST /api/auth/sendMagicLink
 *
 * Accepts: { email, firstName?, lastName?, next? }
 *   next — optional /scan/... path; embedded in the magic link so a scan-first
 *          attendee lands back on their QR unlock after logging in
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
import { safeNextPath } from '../lib/redirect.js';
import { getAttendeeByEmail, upsertAttendee } from '../lib/cosmos.js';
import { sendMagicLinkEmail } from '../lib/email.js';
import { isAllowed } from '../lib/rateLimit.js';
import { jsonResponse as json } from '../lib/http.js';

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
      return json(429, { error: 'The conference passport is not yet open. Please check back on October 5, 2026.' });
    }

    // ── Parse + validate body ─────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const firstName = (body.firstName ?? '').trim() || null;
    const lastName  = (body.lastName  ?? '').trim() || null;
    const next      = safeNextPath(body.next); // null unless it's a safe /scan/... path

    if (!isValidEmail(email)) {
      return json(400, { error: 'A valid email address is required' });
    }

    // Name fields must be safe strings if provided (max 100 chars, no control chars)
    const safeNameRegex = /^[^\x00-\x1f]{1,100}$/;
    if (firstName && !safeNameRegex.test(firstName)) {
      return json(400, { error: 'Invalid first name' });
    }
    if (lastName && !safeNameRegex.test(lastName)) {
      return json(400, { error: 'Invalid last name' });
    }

    // ── Rate limit (per email) ────────────────────────────────────────────
    if (!isAllowed(`sendMagicLink:${email}`)) {
      return json(429, { error: 'Too many requests. Please wait a few minutes and try again.' });
    }

    // ── Generate token ────────────────────────────────────────────────────
    const { rawToken, tokenHash, expiry } = generateMagicToken();

    // ── Upsert attendee record ────────────────────────────────────────────
    const existing = await getAttendeeByEmail(email);
    const now = new Date().toISOString();

    // Some corporate mail servers delay/batch delivery, so an attendee may
    // request several links before an earlier one arrives. Keep any
    // still-unexpired outstanding tokens (instead of overwriting them) so
    // whichever email lands first still works; verifyToken invalidates the
    // rest as soon as one is used. Cap the list so repeated requests can't
    // grow it unbounded.
    const MAX_PENDING_MAGIC_LINKS = 5;
    const pendingTokens = (existing?.magicLinkTokens ?? [])
      .filter(t => t?.hash && t?.expiry && new Date(t.expiry) > new Date())
      .slice(-(MAX_PENDING_MAGIC_LINKS - 1));
    pendingTokens.push({ hash: tokenHash, expiry });

    const attendee = {
      id:                   existing?.id ?? uuidv4(),
      email,
      firstName:            firstName ?? existing?.firstName ?? null,
      lastName:             lastName  ?? existing?.lastName  ?? null,
      magicLinkTokens:      pendingTokens,
      totalPoints:          existing?.totalPoints          ?? 0,
      completedStamps:      existing?.completedStamps      ?? [],
      isComplete:           existing?.isComplete           ?? false,
      completedAt:          existing?.completedAt          ?? null,
      createdAt:            existing?.createdAt            ?? now,
      conferenceYear:       Number(process.env.CONFERENCE_YEAR ?? '2026'),
    };

    await upsertAttendee(attendee);

    // ── Send magic link email ─────────────────────────────────────────────
    // Awaited on purpose. If every configured provider fails, the attendee
    // gets a real error instead of a false "check your inbox". (Graph accepts
    // in ~300ms; ACS polling is the slow path and is only the fallback.)
    try {
      await sendMagicLinkEmail(email, rawToken, firstName, next);
    } catch (err) {
      console.error('[sendMagicLink] email send failed for', email, '-', err.message);
      return json(502, {
        error: 'We couldn\u2019t send your login email just now. Please try again in a moment \u2014 or ask at the registration desk.',
      });
    }

    // ── Respond ───────────────────────────────────────────────────────────
    // Same message whether or not the email existed before — no enumeration
    return json(200, { message: 'Your login link is on its way. Check your inbox (and spam folder).' });
  },
});
