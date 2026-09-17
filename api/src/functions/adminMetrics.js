/**
 * adminMetrics.js — GET /api/mgmt/metrics
 *
 * Single endpoint powering the staff dashboard. Everything here is derived
 * from documents that already exist in Cosmos (attendees, checkins, sponsors)
 * — no extra writes, no schema changes.
 *
 * Auth: requires admin JWT (Authorization: Bearer <token>)
 *
 * Returns 200: {
 *   totals:            { registeredAttendees, activeAttendees, completedPassports,
 *                        totalCheckins, checkinsToday, failedAttempts, manualCredits,
 *                        activeSponsors, totalSponsors, almostThere }
 *   completionRate:    0–100
 *   passport:          { live, closed, lockUtc, threshold, conferenceYear }
 *   hourly:            [{ hour: ISO-8601 (UTC, top of hour), count }] — contiguous, gaps zero-filled
 *   sponsors:          [{ sponsorId, sponsorName, tier, isActive, pointValue, checkinCount, stuckAttendees }]
 *                      — ALL sponsors (incl. zero check-ins), sorted by checkinCount desc
 *   funnel:            [{ stops, count }] — how many attendees have exactly N stops, ascending
 *   recentCheckins:    last 15 successful check-ins, newest first
 *   recentCompletions: last 20 completed passports, newest first
 *   needsAttention:    sponsors where ≥1 attendee has burned all 3 attempts
 *   asOf:              ISO timestamp
 * }
 */

import { app } from '@azure/functions';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import { getAllAttendees, getAllCheckins, getAllSponsors } from '../lib/cosmos.js';
import { findPlaceholderIssues } from '../lib/sponsorContent.js';
import { jsonResponse as json } from '../lib/http.js';

const MAX_PROMPT_ATTEMPTS = 3;
const RECENT_CHECKINS_LIMIT = 15;
const RECENT_COMPLETIONS_LIMIT = 20;
const CONFERENCE_TZ = 'America/Chicago';

const chicagoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: CONFERENCE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

function displayName(attendee, fallbackEmail) {
  const name = [attendee?.firstName, attendee?.lastName].filter(Boolean).join(' ').trim();
  return name || fallbackEmail || '';
}

function truncateToHourUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/** Buckets successful check-ins per UTC hour; zero-fills gaps between first and last. */
function buildHourly(checkins) {
  const counts = new Map();
  let min = null, max = null;
  for (const c of checkins) {
    const h = truncateToHourUtc(c.timestamp);
    if (!h) continue;
    const key = h.getTime();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (min === null || key < min) min = key;
    if (max === null || key > max) max = key;
  }
  if (min === null) return [];
  const out = [];
  for (let t = min; t <= max; t += 60 * 60 * 1000) {
    out.push({ hour: new Date(t).toISOString(), count: counts.get(t) ?? 0 });
  }
  return out;
}

/** attendees who could finish with exactly one more stop */
function countAlmostThere(attendees, activeSponsors, threshold) {
  if (!threshold) return 0;
  let n = 0;
  for (const a of attendees) {
    if (a.isComplete) continue;
    const points = Number(a.totalPoints) || 0;
    const stamped = new Set(a.completedStamps ?? []);
    const bestRemaining = activeSponsors
      .filter(s => !stamped.has(s.id))
      .reduce((m, s) => Math.max(m, Number(s.pointValue) || 0), 0);
    if (bestRemaining > 0 && points < threshold && points + bestRemaining >= threshold) n++;
  }
  return n;
}

app.http('adminMetrics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/metrics',
  handler: async (request) => {
    try {
      requireAdminAuth(request);
    } catch (err) {
      return forbiddenResponse(err.message);
    }

    const year      = process.env.CONFERENCE_YEAR ?? '2026';
    const threshold = Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '0') || 0;
    const lockUtc   = process.env.PASSPORT_LOCK_UTC ?? '2026-10-11T00:00:00Z';
    const now       = new Date();

    const [attendeeList, checkinList, sponsorList] = await Promise.all([
      getAllAttendees(year),
      getAllCheckins(year),
      getAllSponsors(),
    ]);

    const successCheckins   = checkinList.filter(c => !c.failed);
    const failedDocs        = checkinList.filter(c => c.failed);
    const completedAttendees = attendeeList.filter(a => a.isComplete);
    const activeSponsors    = sponsorList.filter(s => s.isActive);
    const attendeeById      = new Map(attendeeList.map(a => [a.id, a]));

    // ── Today (conference-local) ────────────────────────────────────────────
    const todayKey = chicagoDay.format(now);
    const checkinsToday = successCheckins.filter(c => {
      const d = new Date(c.timestamp);
      return !Number.isNaN(d.getTime()) && chicagoDay.format(d) === todayKey;
    }).length;

    // ── Per-sponsor rollup (every sponsor, even with zero check-ins) ────────
    const checkinsBySponsor = new Map();
    for (const c of successCheckins) {
      checkinsBySponsor.set(c.sponsorId, (checkinsBySponsor.get(c.sponsorId) ?? 0) + 1);
    }
    // "stuck" = a failed-attempt doc that has used every attempt for this sponsor
    const stuckBySponsor = new Map();
    for (const f of failedDocs) {
      if ((Number(f.attemptCount) || 0) >= MAX_PROMPT_ATTEMPTS) {
        stuckBySponsor.set(f.sponsorId, (stuckBySponsor.get(f.sponsorId) ?? 0) + 1);
      }
    }
    const sponsors = sponsorList
      .map(s => ({
        sponsorId:      s.id,
        sponsorName:    s.name,
        tier:           s.tier,
        isActive:       s.isActive === true,
        pointValue:     Number(s.pointValue) || 0,
        checkinCount:   checkinsBySponsor.get(s.id) ?? 0,
        stuckAttendees: stuckBySponsor.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.checkinCount - a.checkinCount || a.sponsorName.localeCompare(b.sponsorName));

    const needsAttention = sponsors
      .filter(s => s.stuckAttendees > 0)
      .sort((a, b) => b.stuckAttendees - a.stuckAttendees)
      .map(({ sponsorId, sponsorName, stuckAttendees }) => ({ sponsorId, sponsorName, stuckAttendees }));

    // Content problems staff can fix from the Sponsors tab (e.g. "[Company Name]" left in a question)
    const contentIssues = sponsorList
      .filter(s => s.isActive)
      .flatMap(s => findPlaceholderIssues(s).map(issue => ({ sponsorId: s.id, sponsorName: s.name, issue })));

    // ── Completion funnel: how many attendees have exactly N stops ─────────
    const funnelCounts = new Map();
    for (const a of attendeeList) {
      const stops = (a.completedStamps ?? []).length;
      funnelCounts.set(stops, (funnelCounts.get(stops) ?? 0) + 1);
    }
    const maxStops = Math.max(activeSponsors.length, ...funnelCounts.keys(), 0);
    const funnel = [];
    for (let stops = 0; stops <= maxStops; stops++) {
      funnel.push({ stops, count: funnelCounts.get(stops) ?? 0 });
    }

    // ── Feeds ──────────────────────────────────────────────────────────────
    const recentCheckins = successCheckins
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, RECENT_CHECKINS_LIMIT)
      .map(c => ({
        attendeeName:  displayName(attendeeById.get(c.attendeeId), c.attendeeEmail),
        attendeeEmail: c.attendeeEmail,
        sponsorName:   c.sponsorName,
        pointsAwarded: Number(c.pointsAwarded) || 0,
        manualCredit:  c.manualCredit === true,
        timestamp:     c.timestamp,
      }));

    const recentCompletions = completedAttendees
      .filter(a => a.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, RECENT_COMPLETIONS_LIMIT)
      .map(a => ({
        email:       a.email,
        firstName:   a.firstName,
        lastName:    a.lastName,
        name:        displayName(a, a.email),
        completedAt: a.completedAt,
        totalPoints: Number(a.totalPoints) || 0,
      }));

    const activeAttendees = attendeeList.filter(a => (a.completedStamps ?? []).length > 0).length;

    return json(200, {
      totals: {
        registeredAttendees: attendeeList.length,
        activeAttendees,
        completedPassports:  completedAttendees.length,
        totalCheckins:       successCheckins.length,
        checkinsToday,
        failedAttempts:      failedDocs.length,
        manualCredits:       successCheckins.filter(c => c.manualCredit === true).length,
        activeSponsors:      activeSponsors.length,
        totalSponsors:       sponsorList.length,
        almostThere:         countAlmostThere(attendeeList, activeSponsors, threshold),
      },
      completionRate: attendeeList.length > 0
        ? Math.round((completedAttendees.length / attendeeList.length) * 100)
        : 0,
      passport: {
        live:           process.env.PASSPORT_LIVE === 'true',
        closed:         now >= new Date(lockUtc),
        lockUtc,
        threshold,
        conferenceYear: Number(year),
      },
      hourly:  buildHourly(successCheckins),
      sponsors,
      funnel,
      recentCheckins,
      recentCompletions,
      needsAttention,
      contentIssues,
      asOf: now.toISOString(),
    });
  },
});
