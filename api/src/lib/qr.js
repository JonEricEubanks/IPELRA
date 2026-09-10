/**
 * qr.js — QR unlock code helpers
 *
 * Sponsors carry a per-sponsor `qrCode` secret (set by scripts/generateQrCodes.js).
 * The printed QR encodes /scan/<sponsorId>?c=<qrCode>; the API validates it here.
 */

import crypto from 'crypto';

/**
 * Timing-safe comparison of a submitted code against the sponsor's stored code.
 * Returns false if the sponsor has no code configured.
 */
export function isValidQrCode(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  if (!expected || !provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
