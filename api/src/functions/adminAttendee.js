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
  createCheckin,
} from '../lib/cosmos.js';
import { creditAttendee } from '../lib/credit.js';
import { jsonResponse as json } from '../lib/http.js';

// GET /api/mgmt/attendees?email=attendee@example.com
app.http('adminGetAttendee', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/attendees',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const email = new URL(request.url).searchParams.get('email') ?? '';
    if (!email.trim()) {
      return json(400, { error: 'email query parameter is required' });
    }

    const attendee = await getAttendeeByEmail(email.trim().toLowerCase());
    if (!attendee) {
      return json(404, { error: 'Attendee not found' });
    }

    const checkins = await getCheckinsByAttendee(attendee.id);

    return json(200, { attendee, checkins });
  },
});

// POST /api/mgmt/attendees/credit
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
      return json(400, { error: 'Invalid JSON' });
    }

    const { attendeeId, attendeeEmail, sponsorId, note } = body;
    if (!attendeeId || !attendeeEmail || !sponsorId) {
      return json(400, { error: 'attendeeId, attendeeEmail, and sponsorId are required' });
    }

    // Load sponsor and attendee
    const [sponsor, attendee] = await Promise.all([
      getSponsorById(sponsorId),
      getAttendeeById(attendeeId, attendeeEmail),
    ]);

    if (!sponsor) {
      return json(404, { error: 'Sponsor not found' });
    }
    if (!attendee) {
      return json(404, { error: 'Attendee not found' });
    }

    // Prevent duplicate credit
    if (attendee.completedStamps?.includes(sponsorId)) {
      return json(409, { error: 'Attendee has already completed this sponsor stop' });
    }

    const now = new Date().toISOString();
    const pointValue = Number(sponsor.pointValue) || 0;

    // Record manual credit checkin
    try {
      await createCheckin({
        id:               uuidv4(),
        attendeeId:       attendee.id,
        attendeeEmail:    attendee.email,
        sponsorId:        sponsor.id,
        sponsorName:      sponsor.name,
        pointsAwarded:    pointValue,
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
    } catch (err) {
      if (err.code === 409) {
        return json(409, { error: 'Attendee has already completed this sponsor stop' });
      }
      throw err;
    }

    const { attendee: updated, alreadyCompleted } = await creditAttendee(attendee, sponsorId, pointValue, now);
    if (alreadyCompleted) {
      return json(409, { error: 'Attendee has already completed this sponsor stop' });
    }

    return json(200, {
      message:       'Manual credit applied',
      pointsAwarded: pointValue,
      totalPoints:   updated.totalPoints,
      isComplete:    updated.isComplete,
    });
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

    return json(200, {
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
    });
  },
});
