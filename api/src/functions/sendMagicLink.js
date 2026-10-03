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
import { v5 as uuidv5 } from 'uuid';
import { generateMagicToken } from '../lib/auth.js';
import { safeNextPath } from '../lib/redirect.js';
import { getAttendeeByEmail, createAttendee, patchAttendee } from '../lib/cosmos.js';
import { sendMagicLinkEmail } from '../lib/email.js';
import { isAllowed } from '../lib/rateLimit.js';
import { jsonResponse as json } from '../lib/http.js';

// Fixed namespace so a new attendee's id is derived from their email: two
// simultaneous first-time requests collide on create instead of making duplicates.
const ATTENDEE_ID_NAMESPACE = '6f1c2a0e-5d3b-4f7a-9c21-8e4b2d7a1f60';

// Generous because everyone on the venue Wi-Fi shares one public IP; this only
// stops a single source from flooding the mailboxes with links.
const IP_LIMIT = { windowMs: 10 * 60 * 1000, maxAttempts: 300 };

function clientIp(request) {
  const first = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (!first) return null;
  if (first.startsWith('[')) return first.slice(1, first.indexOf(']'));
  // Strip an IPv4 ":port" suffix (IPv6 without brackets has several colons)
  return first.split(':').length === 2 ? first.split(':')[0] : first;
}

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

    // ── Rate limit (per email, then per source IP) ────────────────────────
    if (!isAllowed(`sendMagicLink:${email}`)) {
      return json(429, { error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    const ip = clientIp(request);
    if (ip && !isAllowed(`sendMagicLink-ip:${ip}`, IP_LIMIT)) {
      return json(429, { error: 'Too many requests. Please wait a few minutes and try again.' });
    }

    // ── Generate token ────────────────────────────────────────────────────
    const { rawToken, tokenHash, expiry } = generateMagicToken();

    // ── Upsert attendee record ────────────────────────────────────────────
    let existing = await getAttendeeByEmail(email);
    const now = new Date().toISOString();
    const conferenceYear = Number(process.env.CONFERENCE_YEAR ?? '2026');

    // Some corporate mail servers delay/batch delivery, so an attendee may
    // request several links before an earlier one arrives. Keep any
    // still-unexpired outstanding tokens (instead of overwriting them) so
    // whichever email lands first still works; verifyToken invalidates the
    // rest as soon as one is used. Cap the list so repeated requests can't
    // grow it unbounded.
    const MAX_PENDING_MAGIC_LINKS = 5;
    const pendingFor = (doc) => {
      const kept = (doc?.magicLinkTokens ?? [])
        .filter(t => t?.hash && t?.expiry && new Date(t.expiry) > new Date())
        .slice(-(MAX_PENDING_MAGIC_LINKS - 1));
      return [...kept, { hash: tokenHash, expiry }];
    };

    if (!existing) {
      try {
        await createAttendee({
          id:              uuidv5(email, ATTENDEE_ID_NAMESPACE),
          email,
          firstName,
          lastName,
          magicLinkTokens: pendingFor(null),
          totalPoints:     0,
          completedStamps: [],
          isComplete:      false,
          completedAt:     null,
          createdAt:       now,
          conferenceYear,
        });
      } catch (err) {
        if (err.code !== 409) throw err;
        // A simultaneous request created this attendee first
        existing = await getAttendeeByEmail(email);
        if (!existing) throw err;
      }
    }

    // Only touch login fields — never points/stamps, which a check-in may be writing right now
    if (existing) {
      await patchAttendee(existing.id, email, {
        magicLinkTokens: pendingFor(existing),
        conferenceYear,
        ...(firstName ? { firstName } : {}),
        ...(lastName  ? { lastName }  : {}),
      });
    }

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
