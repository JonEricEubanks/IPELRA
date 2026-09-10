/**
 * scanUrl.js — turns raw QR text into a passport scan target, or null.
 *
 * Only our own /scan/<sponsorId>?c=<code> links are accepted. Anything else
 * (a LinkedIn QR, a menu, a phishing link) is rejected so the in-app scanner
 * can never navigate somewhere arbitrary.
 */

const ID_RE   = /^[A-Za-z0-9._~-]+$/;
const CODE_RE = /^[A-Za-z0-9._~-]+$/;

/**
 * @param {string} text  raw decoded QR payload
 * @param {string} [origin=window.location.origin]  only this origin (or a bare path) is trusted
 * @returns {{ sponsorId: string, c: string, path: string } | null}
 */
export function parseScanUrl(text, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;

  let url;
  try {
    // Accept absolute URLs on our origin, or a bare relative path
    url = raw.startsWith('/') ? new URL(raw, origin || 'http://localhost') : new URL(raw);
  } catch {
    return null;
  }

  if (origin && !raw.startsWith('/') && url.origin !== origin) return null;

  const m = url.pathname.match(/^\/scan\/([^/]+)$/);
  if (!m) return null;

  const sponsorId = decodeURIComponent(m[1]);
  const c = url.searchParams.get('c') ?? '';
  if (!ID_RE.test(sponsorId) || !CODE_RE.test(c)) return null;

  return { sponsorId, c, path: `/scan/${encodeURIComponent(sponsorId)}?c=${encodeURIComponent(c)}` };
}
