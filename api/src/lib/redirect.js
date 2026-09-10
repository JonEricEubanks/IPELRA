/**
 * redirect.js — post-login redirect safety
 *
 * The magic link may carry a `next` path so scan-first attendees land back on
 * their QR unlock after logging in. Only same-origin /scan/… paths are allowed
 * so the link can never be abused as an open redirect.
 */

const MAX_LEN = 300;

/**
 * Returns `next` if it is a safe, in-app scan path; otherwise null.
 */
export function safeNextPath(next) {
  if (typeof next !== 'string') return null;
  const s = next.trim();
  if (!s || s.length > MAX_LEN) return null;
  // Must be a relative path to our scan route — no scheme, no protocol-relative "//"
  if (!/^\/scan\/[A-Za-z0-9._~-]+(\?c=[A-Za-z0-9._~-]+)?$/.test(s)) return null;
  return s;
}
