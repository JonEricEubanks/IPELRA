/**
 * adminAttendee.js — Attendee lookup + manual credit
 *
 * GET  /api/mgmt/attendees?email=   — search attendee by email
 * GET  /api/mgmt/attendees/list     — list all attendees (paginated)
 * POST /api/mgmt/attendees/credit   — manually credit a sponsor stop
 *
 * Auth: admin JWT
 */

import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import {
  getAttendeeByEmail,
  getAttendeeById,
  getCheckinsByAttendee,
  getSponsorById,
  getAllAttendees,
  upsertAttendee,
  createCheckin,
} from '../lib/cosmos.js';

// GET /api/admin/attendees?email=attendee@example.com
app.http('adminGetAttendee', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/attendees',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const email = new URL(request.url).searchParams.get('email') ?? '';
    if (!email.trim()) {
      return new Response(JSON.stringify({ error: 'email query parameter is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const attendee = await getAttendeeByEmail(email.trim().toLowerCase());
    if (!attendee) {
      return new Response(JSON.stringify({ error: 'Attendee not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const checkins = await getCheckinsByAttendee(attendee.id);

    return new Response(JSON.stringify({ attendee, checkins }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  },
});

// POST /api/admin/attendees/credit
// Body: { attendeeId, attendeeEmail, sponsorId, note }
app.http('adminManualCredit', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/attendees/credit',
  handler: async (request) => {
    let adminPrincipal;
    try { adminPrincipal = requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    let body;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { attendeeId, attendeeEmail, sponsorId, note } = body;
    if (!attendeeId || !attendeeEmail || !sponsorId) {
      return new Response(JSON.stringify({ error: 'attendeeId, attendeeEmail, and sponsorId are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load sponsor and attendee
    const [sponsor, attendee] = await Promise.all([
      getSponsorById(sponsorId),
      getAttendeeById(attendeeId, attendeeEmail),
    ]);

    if (!sponsor) {
      return new Response(JSON.stringify({ error: 'Sponsor not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!attendee) {
      return new Response(JSON.stringify({ error: 'Attendee not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent duplicate credit
    if (attendee.completedStamps?.includes(sponsorId)) {
      return new Response(JSON.stringify({ error: 'Attendee has already completed this sponsor stop' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();

    // Record manual credit checkin
    await createCheckin({
      id:               uuidv4(),
      attendeeId:       attendee.id,
      attendeeEmail:    attendee.email,
      sponsorId:        sponsor.id,
      sponsorName:      sponsor.name,
      pointsAwarded:    sponsor.pointValue,
      answerSubmitted:  '[MANUAL CREDIT]',
      attemptCount:     0,
      rejectedAnswers:  [],
      timestamp:        now,
      conferenceYear:   Number(process.env.CONFERENCE_YEAR ?? '2026'),
      manualCredit:     true,
      manualCreditNote: note?.trim() || null,
      manualCreditBy:   adminPrincipal.email,
      failed:           false,
    });

    // Update attendee
    const newTotalPoints  = (attendee.totalPoints ?? 0) + sponsor.pointValue;
    const threshold       = Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '1000');
    const newIsComplete   = newTotalPoints >= threshold;
    const newCompletedAt  = newIsComplete && !attendee.isComplete ? now : attendee.completedAt;

    await upsertAttendee({
      ...attendee,
      totalPoints:     newTotalPoints,
      completedStamps: [...(attendee.completedStamps ?? []), sponsorId],
      isComplete:      newIsComplete,
      completedAt:     newCompletedAt,
    });

    return new Response(
      JSON.stringify({
        message:       'Manual credit applied',
        pointsAwarded: sponsor.pointValue,
        totalPoints:   newTotalPoints,
        isComplete:    newIsComplete,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});

// GET /api/mgmt/attendees/list?year=2026
app.http('adminListAttendees', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/attendees/list',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const params = new URL(request.url).searchParams;
    const year = params.get('year') ?? process.env.CONFERENCE_YEAR ?? new Date().getFullYear();
    const filter = params.get('filter') ?? 'all'; // all | completed | active | pending

    let attendees = await getAllAttendees(Number(year));

    if (filter === 'completed') {
      attendees = attendees.filter(a => a.isComplete);
    } else if (filter === 'active') {
      attendees = attendees.filter(a => !a.isComplete && (a.totalPoints ?? 0) > 0);
    } else if (filter === 'pending') {
      attendees = attendees.filter(a => (a.totalPoints ?? 0) === 0);
    }

    // Sort by totalPoints desc, then name
    attendees.sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));

    return new Response(
      JSON.stringify({
        attendees: attendees.map(a => ({
          id:         a.id,
          email:      a.email,
          firstName:  a.firstName,
          lastName:   a.lastName,
          points:     a.totalPoints ?? 0,
          completed:  a.isComplete ?? false,
          completedAt: a.completedAt ?? null,
          stampCount: (a.completedStamps ?? []).length,
          createdAt:  a.createdAt,
        })),
        total: attendees.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
