/**
 * auth.js — JWT + magic link token helpers
 *
 * Attendee tokens: custom JWT signed with JWT_SECRET, exp Oct 10 2026.
 * Admin tokens: same JWT_SECRET, magic-link flow (email → 15 min token → 8 hr session).
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { jsonResponse } from './http.js';

const JWT_SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

// Pin the algorithm so a token can't be verified under a different one
const JWT_ALGORITHM   = 'HS256';
const VERIFY_OPTIONS  = { algorithms: [JWT_ALGORITHM] };

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
// If the conference has already ended, still issue a usable short-lived token
const POST_CONFERENCE_TOKEN_TTL_SEC = 24 * 60 * 60;

/**
 * Admin allowlist from ADMIN_EMAILS (comma-separated), lower-cased and trimmed.
 */
export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

// Fixed conference expiry: midnight UTC Oct 11 (= 7pm CT Oct 10)
const CONFERENCE_EXPIRY = Math.floor(new Date('2026-10-11T00:00:00Z').getTime() / 1000);

// ── Magic Link Tokens ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random magic link token (UUID v4 format).
 * Returns { rawToken, tokenHash, expiry }.
 *
 * rawToken — sent in the email link
 * tokenHash — SHA-256 of rawToken, stored in Cosmos (never store raw)
 * expiry — ISO 8601, 15 minutes from now
 */
export function generateMagicToken() {
  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);
  const expiry = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
  return { rawToken, tokenHash, expiry };
}

/**
 * Returns the SHA-256 hex digest of a token string.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Attendee JWT ──────────────────────────────────────────────────────────────

/**
 * Signs and returns an attendee session JWT.
 * Payload: { sub: attendeeId, email }
 * Expires: 2026-10-10T23:59:59Z (fixed conference expiry)
 */
export function signAttendeeToken(attendeeId, email) {
  const remaining = CONFERENCE_EXPIRY - Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub: attendeeId, email: email.trim().toLowerCase() },
    JWT_SECRET(),
    { algorithm: JWT_ALGORITHM, expiresIn: remaining > 0 ? remaining : POST_CONFERENCE_TOKEN_TTL_SEC }
  );
}

/**
 * Verifies and decodes an attendee JWT.
 * Returns the decoded payload or throws if invalid/expired.
 */
export function verifyAttendeeToken(token) {
  return jwt.verify(token, JWT_SECRET(), VERIFY_OPTIONS);
}

/**
 * Extracts the attendee JWT from a request's Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Validates the attendee token from the Authorization header.
 * Returns the decoded payload or throws with a 401 message.
 */
export function requireAttendeeAuth(request) {
  const token = extractBearerToken(request);
  if (!token) {
    const err = new Error('Authorization header missing or malformed');
    err.status = 401;
    throw err;
  }
  try {
    return verifyAttendeeToken(token);
  } catch {
    const err = new Error('Token invalid or expired');
    err.status = 401;
    throw err;
  }
}

// ── Admin Token ───────────────────────────────────────────────────────────────

/**
 * Signs a short-lived (15 min) admin magic-link JWT.
 * Embedded in the login email link.
 */
export function signAdminMagicToken(email) {
  return jwt.sign(
    { sub: email.trim().toLowerCase(), purpose: 'admin-login' },
    JWT_SECRET(),
    { algorithm: JWT_ALGORITHM, expiresIn: '15m' }
  );
}

/**
 * Verifies an admin magic-link JWT and returns the admin email, or throws
 * (invalid/expired → err.status 401, not an allow-listed admin → 403).
 */
export function verifyAdminMagicToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET(), VERIFY_OPTIONS);
  } catch {
    const err = new Error('Link expired or invalid');
    err.status = 401;
    throw err;
  }
  const email = (payload.sub ?? '').trim().toLowerCase();
  if (payload.purpose !== 'admin-login' || !email || !getAdminEmails().includes(email)) {
    const err = new Error('Not authorized');
    err.status = 403;
    throw err;
  }
  return email;
}

/**
 * Signs an admin session JWT (8 hours).
 * Returned after the admin clicks the magic link.
 */
export function signAdminToken(email) {
  return jwt.sign(
    { sub: email.trim().toLowerCase(), role: 'admin' },
    JWT_SECRET(),
    { algorithm: JWT_ALGORITHM, expiresIn: '8h' }
  );
}

// ── Admin Auth (JWT bearer) ───────────────────────────────────────────────────

/**
 * Validates an admin bearer token from the Authorization header.
 * Returns { email } or throws 403.
 */
export function requireAdminAuth(request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Not authenticated');
    err.status = 403;
    throw err;
  }

  const token = authHeader.slice(7).trim();
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET(), VERIFY_OPTIONS);
  } catch {
    const err = new Error('Invalid or expired admin token');
    err.status = 403;
    throw err;
  }

  const email = (payload.sub ?? '').trim().toLowerCase();
  if (payload.role !== 'admin' || !email || !getAdminEmails().includes(email)) {
    const err = new Error('Forbidden: not an admin');
    err.status = 403;
    throw err;
  }

  return { email };
}

// ── Export Secret (emergency bypass) ─────────────────────────────────────────

/**
 * Validates the x-export-secret header for the emergency export endpoint.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateExportSecret(request) {
  const secret = process.env.EXPORT_SECRET;
  if (!secret) {
    const err = new Error('EXPORT_SECRET not configured');
    err.status = 500;
    throw err;
  }

  const provided = request.headers.get('x-export-secret') ?? '';
  const secretBuf   = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  // Buffers must be same length for timingSafeEqual; pad/truncate to avoid length-leak
  const maxLen = Math.max(secretBuf.length, providedBuf.length);
  const a = Buffer.alloc(maxLen);
  const b = Buffer.alloc(maxLen);
  secretBuf.copy(a);
  providedBuf.copy(b);

  if (!crypto.timingSafeEqual(a, b) || secret.length !== provided.length) {
    const err = new Error('Invalid export secret');
    err.status = 401;
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a standard 401 JSON response.
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return jsonResponse(401, { error: message });
}

/**
 * Returns a standard 403 JSON response.
 */
export function forbiddenResponse(message = 'Forbidden') {
  return jsonResponse(403, { error: message });
}
