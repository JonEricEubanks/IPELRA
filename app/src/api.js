/**
 * api.js — Thin API client
 * All fetch calls go through here so baseURL and auth headers are in one place.
 */

// In local dev, Vite proxies /api → http://localhost:7071
// In production, VITE_API_BASE_URL points to the deployed Function App
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function getToken(path) {
  if (path && path.startsWith('/api/mgmt/')) {
    return localStorage.getItem('admin_token') ?? sessionStorage.getItem('admin_token');
  }
  return localStorage.getItem('passport_token') ?? sessionStorage.getItem('passport_token');
}

async function request(path, options = {}, _retries = 1) {
  const token = getToken(path);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    // Network / cold-start failure — retry once after 2 s
    if (_retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return request(path, options, _retries - 1);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  if (res.status === 401 || res.status === 403) {
    // Admin routes: redirect to admin login; attendee routes: redirect to /login
    if (window.location.pathname.startsWith('/admin')) {
      window.location.href = '/admin/login';
    } else {
      localStorage.removeItem('passport_token');
      sessionStorage.removeItem('passport_token');
      window.location.href = '/login';
    }
    return;
  }

  return res;
}

// ── Admin Auth ───────────────────────────────────────────────────────────────
export async function adminSendMagicLink(email) {
  const res = await fetch(`${BASE}/api/mgmt/auth/sendLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server error (${res.status})`);
  }
  return res.json();
}

export async function adminVerifyToken(token) {
  const res = await fetch(`${BASE}/api/mgmt/auth/verify?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Link expired or invalid.');
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function sendMagicLink(email, firstName, lastName, next = null) {
  return request('/api/auth/sendMagicLink', {
    method: 'POST',
    body: JSON.stringify({ email, firstName, lastName, ...(next ? { next } : {}) }),
  });
}

export async function verifyToken(token) {
  return request(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

// ── Passport ──────────────────────────────────────────────────────────────────
export async function getSponsors() {
  const res = await request('/api/sponsors');
  if (!res) return { sponsors: [], threshold: 0, passportLive: false };
  return res.json();
}

export async function getProgress() {
  const res = await request('/api/progress');
  if (!res) return null;
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
 * Unlock a sponsor stop. `unlock` is either { answer } (prompt) or { qrCode } (QR scan).
 */
export async function submitCheckin(sponsorId, unlock) {
  const res = await request('/api/checkin', {
    method: 'POST',
    body: JSON.stringify({ sponsorId, ...unlock }),
  });
  if (!res) return null;
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
  if (!res) return { rankings: [], myRank: null, totalParticipants: 0 };
  return res.json();
}

export async function updateAttendeeName(firstName, lastName) {
  const res = await request('/api/attendee/name', {
    method: 'PATCH',
    body: JSON.stringify({ firstName, lastName }),
  });
  if (!res) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save name.');
  }
  return res.json();
}

// ── Admin ─────────────────────────────────────────────────────────────────────
// All admin helpers parse JSON and normalise field names to match page expectations.

export async function adminGetMetrics() {
  const res = await request('/api/mgmt/metrics');
  const data = await res.json();
  return {
    totalAttendees:   data.totals.registeredAttendees,
    activeAttendees:  data.totals.registeredAttendees, // API doesn't separate active vs registered
    completedCount:   data.totals.completedPassports,
    completionRate:   data.completionRate,
    totalCheckins:    data.totals.totalCheckins,
    failedAttempts:   data.totals.failedAttempts,
    activeSponsors:   data.totals.activeSponsors,
    topSponsors: (data.topSponsors ?? []).map(s => ({
      id:    s.sponsorId,
      name:  s.sponsorName,
      count: s.checkinCount,
    })),
    recentCompletions: data.recentCompletions ?? [],
    asOf: data.asOf,
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
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || 'Failed to delete sponsor');
    err.status = res.status;
    throw err;
  }
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

// Alias — some pages import under this name
export const adminLookupAttendee = adminGetAttendee;

export async function adminListAttendees(filter = 'all') {
  const res = await request(`/api/mgmt/attendees/list?filter=${encodeURIComponent(filter)}`);
  return res.json(); // { attendees: [...], total }
}

export async function adminManualCredit(attendeeId, attendeeEmail, sponsorId, note) {
  const res = await request('/api/mgmt/attendees/credit', {
    method: 'POST',
    body: JSON.stringify({ attendeeId, attendeeEmail, sponsorId, note }),
  });
  const data = await res.json();
  return { points: data.attendee?.totalPoints ?? 0, ...data };
}

export async function adminGetFlagged() {
  const res = await request('/api/mgmt/flagged');
  const data = await res.json();
  return {
    bySponsor: (data.flaggedBySize ?? []).map(g => ({
      sponsorId:   g.sponsorId,
      sponsorName: g.sponsorName,
      entries: (g.entries ?? []).map(e => ({
        email:           e.attendeeEmail,
        answerSubmitted: e.answerSubmitted,
        rejectedAnswers: e.rejectedAnswers ?? [],
        failCount:       e.rejectedAnswers?.length ?? 0,
        lastAttempt:     e.timestamp,
        failed:          e.failed,
      })),
    })),
    total: data.totalFlagged ?? 0,
  };
}

export async function adminGetReadiness() {
  const res = await request('/api/mgmt/readiness');
  return res.json(); // { checks: [...] }
}

export async function adminResetConference(confirmToken) {
  const res = await request('/api/mgmt/resetConference', {
    method: 'POST',
    body: JSON.stringify({ confirmToken }),
  });
  return res.json();
}

export async function adminExportCsv() {
  const token = localStorage.getItem('admin_token') ?? sessionStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}/api/mgmt/export`, { headers });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}
