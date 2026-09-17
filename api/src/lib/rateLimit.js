/**
 * rateLimit.js — lightweight in-memory fixed-window rate limiter
 *
 * Per-instance only: counters reset on cold start and don't coordinate across
 * scaled-out Function App instances. Acceptable for this event's scale
 * (~160 attendees); revisit with a Cosmos-backed limiter for a larger event.
 */

const DEFAULT_WINDOW_MS   = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ATTEMPTS = 5;
// Sweep expired buckets once the map grows past this many keys
const PRUNE_THRESHOLD = 500;

const buckets = new Map(); // key -> { count, windowStart, expiresAt }

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

/**
 * Returns true if the caller identified by `key` is still within the allowed
 * rate, incrementing its counter. Returns false once the limit is exceeded
 * for the current window.
 */
export function isAllowed(key, { windowMs = DEFAULT_WINDOW_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    if (buckets.size >= PRUNE_THRESHOLD) prune(now);
    buckets.set(key, { count: 1, windowStart: now, expiresAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxAttempts) return false;

  bucket.count += 1;
  return true;
}

/**
 * Clears all rate-limit state. Test-only — never call this from app code.
 */
export function _resetForTests() {
  buckets.clear();
}
