/**
 * api.js — Thin API client
 * All fetch calls go through here so baseURL and auth headers are in one place.
 */

// In local dev, Vite proxies /api → http://localhost:7071
// In production, VITE_API_BASE_URL points to the deployed Function App
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const ADMIN_PREFIX = '/api/mgmt/';

/** Thrown when the API rejects our session; the page is already navigating to login. */
export class SessionExpiredError extends Error {
  constructor(status) {
    super('Your session has expired. Please sign in again.');
    this.name = 'SessionExpiredError';
    this.status = status;
  }
}

function isAdminPath(path) {
  return Boolean(path && path.startsWith(ADMIN_PREFIX));
}

function getToken(path) {
  const key = isAdminPath(path) ? 'admin_token' : 'passport_token';
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function clearToken(path) {
  const key = isAdminPath(path) ? 'admin_token' : 'passport_token';
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

async function request(path, options = {}, _retries = 1) {
  // Public auth endpoints return 401 to mean "bad link", not "session expired"
  const { skipSessionRedirect = false, ...fetchOptions } = options;
  const token = getToken(path);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers ?? {}),
  };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...fetchOptions, headers });
  } catch {
    // Network / cold-start failure — retry once after 2 s
    if (_retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return request(path, options, _retries - 1);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  if (!skipSessionRedirect && (res.status === 401 || res.status === 403)) {
    clearToken(path);
    window.location.href = isAdminPath(path) ? '/admin/login' : '/login';
    throw new SessionExpiredError(res.status);
  }

  return res;
}

/** Throws with the server's error message (or fallbackMessage) if res is not ok. */
async function throwIfNotOk(res, fallbackMessage) {
  if (res.ok) return res;
  const data = await res.json().catch(() => ({}));
  const err = new Error(data.error || fallbackMessage);
  err.status = res.status;
  throw err;
}

export async function adminSendMagicLink(email) {
  const res = await request('/api/mgmt/auth/sendLink', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipSessionRedirect: true,
  });
  await throwIfNotOk(res, `Server error (${res.status})`);
  return res.json();
}

export async function adminVerifyToken(token) {
  const res = await request(`/api/mgmt/auth/verify?token=${encodeURIComponent(token)}`, {
    skipSessionRedirect: true,
  });
  await throwIfNotOk(res, 'Link expired or invalid.');
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function sendMagicLink(email, firstName, lastName, next = null) {
  return request('/api/auth/sendMagicLink', {
    method: 'POST',
    body: JSON.stringify({ email, firstName, lastName, ...(next ? { next } : {}) }),
    skipSessionRedirect: true,
  });
}

export async function verifyToken(token) {
  return request(`/api/auth/verify?token=${encodeURIComponent(token)}`, { skipSessionRedirect: true });
}

// ── Passport ──────────────────────────────────────────────────────────────────
export async function getSponsors() {
  const res = await request('/api/sponsors');
  return res.json();
}

export async function getProgress() {
  const res = await request('/api/progress');
  const data = await res.json();
  return {
    points:              data.attendee?.totalPoints ?? 0,
    threshold:           data.threshold ?? 0,
    completed:           data.attendee?.isComplete ?? false,
    // Use completedStamps directly — same field the server checks for 409 — so
    // the UI and server are always in sync (avoids mismatch when checkin docs
    // are absent, e.g. manual credits).
    checkedInSponsorIds: data.attendee?.completedStamps ?? (data.completedCheckins ?? []).map(c => c.sponsorId),
    passportLockUtc:     data.passportLockUtc,
    firstName:           data.attendee?.firstName ?? null,
    completedAt:         data.attendee?.completedAt ?? null,
  };
}

/**
 * Unlock a sponsor stop by answering its prompt question — `unlock` is { answer }.
 * Scanning a sponsor's QR code only deep-links to that sponsor's question
 * (see ScanPage); it never bypasses answering.
 */
export async function submitCheckin(sponsorId, unlock) {
  const res = await request('/api/checkin', {
    method: 'POST',
    body: JSON.stringify({ sponsorId, ...unlock }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Check-in failed');
    err.status = res.status;
    err.hint   = data.hint ?? null;
    throw err;
  }
  return data;
}

export async function getLeaderboard() {
  const res = await request('/api/leaderboard');
  return res.json();
}

export async function updateAttendeeName(firstName, lastName) {
  const res = await request('/api/attendee/name', {
    method: 'PATCH',
    body: JSON.stringify({ firstName, lastName }),
  });
  await throwIfNotOk(res, 'Failed to save name.');
  return res.json();
}

// ── Admin ─────────────────────────────────────────────────────────────────────
// All admin helpers parse JSON and normalise field names to match page expectations.

export async function adminGetMetrics() {
  const res = await request('/api/mgmt/metrics');
  const data = await res.json();
  const t = data.totals ?? {};
  return {
    totalAttendees:    t.registeredAttendees ?? 0,
    activeAttendees:   t.activeAttendees ?? 0,
    completedCount:    t.completedPassports ?? 0,
    completionRate:    data.completionRate ?? 0,
    totalCheckins:     t.totalCheckins ?? 0,
    checkinsToday:     t.checkinsToday ?? 0,
    failedAttempts:    t.failedAttempts ?? 0,
    manualCredits:     t.manualCredits ?? 0,
    activeSponsors:    t.activeSponsors ?? 0,
    totalSponsors:     t.totalSponsors ?? 0,
    almostThere:       t.almostThere ?? 0,
    passport:          data.passport ?? { live: false, closed: false, threshold: 0 },
    hourly:            data.hourly ?? [],
    sponsors:          data.sponsors ?? [],
    funnel:            data.funnel ?? [],
    recentCheckins:    data.recentCheckins ?? [],
    recentCompletions: data.recentCompletions ?? [],
    needsAttention:    data.needsAttention ?? [],
    contentIssues:     data.contentIssues ?? [],
    asOf:              data.asOf,
  };
}

export async function adminGetSponsors() {
  const res = await request('/api/mgmt/sponsors');
  return res.json(); // { sponsors: [...] }
}

export async function adminCreateSponsor(data) {
  const res = await request('/api/mgmt/sponsors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminUpdateSponsor(id, data) {
  const res = await request(`/api/mgmt/sponsors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminPatchSponsor(id, patch) {
  const res = await request(`/api/mgmt/sponsors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function adminDeleteSponsor(id) {
  const res = await request(`/api/mgmt/sponsors/${id}`, { method: 'DELETE' });
  await throwIfNotOk(res, 'Failed to delete sponsor');
}

export async function adminGetAttendee(email) {
  const res = await request(`/api/mgmt/attendees?email=${encodeURIComponent(email)}`);
  if (res.status === 404) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const data = await res.json();
  // Flatten attendee + checkins into a single object for pages
  return {
    ...data.attendee,
    points:    data.attendee.totalPoints,
    completed: data.attendee.isComplete,
    checkins:  data.checkins ?? [],
  };
}

export async function adminListAttendees(filter = 'all') {
  const res = await request(`/api/mgmt/attendees/list?filter=${encodeURIComponent(filter)}`);
  return res.json(); // { attendees: [...], total }
}

export async function adminManualCredit(attendeeId, attendeeEmail, sponsorId, note) {
  const res = await request('/api/mgmt/attendees/credit', {
    method: 'POST',
    body: JSON.stringify({ attendeeId, attendeeEmail, sponsorId, note }),
  });
  await throwIfNotOk(res, 'Credit failed');
  const data = await res.json(); // { message, pointsAwarded, totalPoints, isComplete }
  return { points: data.totalPoints ?? 0, ...data };
}

export async function adminGetReadiness() {
  const res = await request('/api/mgmt/readiness');
  return res.json(); // { checks: [...], overallStatus, asOf }
}

/**
 * Wrong answers attendees typed at one sponsor's table — used on the sponsor
 * edit page so staff can see *what* people are guessing before changing the keyword.
 * Returns [{ email, rejectedAnswers: [], attemptCount, stuck, lastTried }]
 */
export async function adminGetSponsorWrongAnswers(sponsorId) {
  const res = await request('/api/mgmt/flagged');
  const data = await res.json();
  const group = (data.flaggedBySize ?? []).find(g => g.sponsorId === sponsorId);
  return (group?.entries ?? []).map(e => ({
    email:           e.attendeeEmail,
    rejectedAnswers: e.rejectedAnswers ?? [],
    attemptCount:    e.attemptCount ?? (e.rejectedAnswers?.length ?? 0),
    stuck:           e.failed === true && (e.attemptCount ?? 0) >= 3,
    lastTried:       e.timestamp,
  }));
}

export async function adminResetConference(confirmToken) {
  const res = await request('/api/mgmt/resetConference', {
    method: 'POST',
    body: JSON.stringify({ confirmToken }),
  });
  await throwIfNotOk(res, 'Reset failed');
  return res.json();
}
