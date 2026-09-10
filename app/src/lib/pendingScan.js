/**
 * pendingScan.js — remembers a QR scan made while logged out so it can be
 * completed right after the magic-link login.
 *
 * Uses localStorage (not sessionStorage) because the magic link opens in a new
 * tab, and sessionStorage is per-tab. A short TTL keeps a stale scan from
 * hijacking a login hours later.
 */

const KEY = 'passport_pending_scan';
const TTL_MS = 30 * 60 * 1000;

function storage() {
  try { return localStorage; } catch { return sessionStorage; }
}

export function savePendingScan({ sponsorId, c, sponsorName = null, points = null }) {
  try {
    storage().setItem(KEY, JSON.stringify({ sponsorId, c, sponsorName, points, savedAt: Date.now() }));
  } catch { /* storage unavailable — resume just won't happen */ }
}

/** Returns the pending scan if present and fresh, otherwise null (and clears stale ones). */
export function readPendingScan() {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.sponsorId || !data?.c || Date.now() - (data.savedAt ?? 0) > TTL_MS) {
      clearPendingScan();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPendingScan() {
  try { storage().removeItem(KEY); } catch { /* ignore */ }
}

/** The in-app path that completes a pending scan. */
export function pendingScanPath({ sponsorId, c }) {
  return `/scan/${encodeURIComponent(sponsorId)}?c=${encodeURIComponent(c)}`;
}
