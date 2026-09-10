/**
 * checkin.js — POST /api/checkin
 *
 * Core game mechanic: attendee unlocks a sponsor stop by EITHER answering the
 * sponsor's prompt question OR scanning the sponsor's printed QR code.
 *
 * Body (exactly one of):
 *   { sponsorId, answer }   — prompt path (fuzzy-matched, 3 attempts, hint on 3rd)
 *   { sponsorId, qrCode }   — QR path (exact match against sponsor.qrCode)
 *
 * Flow:
 * 1. Validate JWT + extract attendeeId
 * 2. Load sponsor (verify active, get keyword/qrCode + pointValue)
 * 3. Check passport is live and not locked
 * 4. Check attendee hasn't already completed this sponsor
 * 5. Validate the unlock:
 *    - QR miss: return 422 (does NOT consume prompt attempts)
 *    - Prompt miss: return 422 with attempt feedback + hint after 3rd attempt
 *    - Hit (either): create checkin doc, update attendee points + stamps, maybe send completion email
 * 6. Cosmos unique key (/sponsorId within /attendeeId partition) prevents
 *    duplicate checkins at the DB level as a final safety net
 *
 * Returns 200: { correct: true, pointsAwarded, totalPoints, isComplete, completedAt?, method }
 * Returns 422: { correct: false, attemptsUsed?, hint?, message }
 * Returns 400/401/403/404/409/423: various error states
 */

import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { isCorrectAnswer, generateHint } from '../lib/fuzzyMatch.js';
import { isValidQrCode } from '../lib/qr.js';
import {
  getSponsorById,
  getAttendeeById,
  upsertAttendee,
  createCheckin,
  upsertCheckin,
  getCheckinsByAttendee,
} from '../lib/cosmos.js';
import { sendCompletionEmail } from '../lib/email.js';

const MAX_ATTEMPTS = 3;

app.http('checkin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'checkin',
  handler: async (request) => {
    // ── Auth ──────────────────────────────────────────────────────────────
    let principal;
    try {
      principal = requireAttendeeAuth(request);
    } catch (err) {
      return unauthorizedResponse(err.message);
    }

    // ── Passport guards ───────────────────────────────────────────────────
    if (process.env.PASSPORT_LIVE !== 'true') {
      return new Response(
        JSON.stringify({ error: 'The conference passport is not yet open.' }),
        { status: 423, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const lockUtc = process.env.PASSPORT_LOCK_UTC ?? '2026-10-11T00:00:00Z';
    if (new Date() >= new Date(lockUtc)) {
      return new Response(
        JSON.stringify({ error: 'The conference passport has closed. Thank you for participating!' }),
        { status: 423, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sponsorId = (body.sponsorId ?? '').trim();
    const answer    = (body.answer    ?? '').trim();
    const qrCode    = (body.qrCode    ?? '').trim();
    const method    = qrCode ? 'qr' : 'prompt';

    if (!sponsorId || (!answer && !qrCode)) {
      return new Response(
        JSON.stringify({ error: 'sponsorId and either answer or qrCode are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (answer && qrCode) {
      return new Response(
        JSON.stringify({ error: 'Provide either answer or qrCode, not both' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Clamp lengths to prevent abuse
    if (answer.length > 500 || qrCode.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Input is too long' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Load sponsor ──────────────────────────────────────────────────────
    const sponsor = await getSponsorById(sponsorId);
    if (!sponsor || !sponsor.isActive) {
      return new Response(
        JSON.stringify({ error: 'Sponsor not found or not active' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Load attendee ─────────────────────────────────────────────────────
    const attendee = await getAttendeeById(principal.sub, principal.email);
    if (!attendee) {
      return new Response(
        JSON.stringify({ error: 'Attendee record not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Already completed this sponsor? ───────────────────────────────────
    if (attendee.completedStamps?.includes(sponsorId)) {
      return new Response(
        JSON.stringify({ error: 'You have already completed this sponsor stop' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Count previous failed attempts for this sponsor ───────────────────
    const existingCheckins = await getCheckinsByAttendee(principal.sub);
    const priorAttempts = existingCheckins.filter(c => c.sponsorId === sponsorId);
    // Due to the unique key constraint (/sponsorId per attendee partition), only one
    // failed-attempt document can exist per attendee+sponsor. Read the stored count.
    const failedAttemptDoc = priorAttempts.find(c => c.failed === true);
    const attemptsUsed = failedAttemptDoc?.attemptCount ?? 0;
    const now = new Date().toISOString();

    // ── QR path: exact match, never consumes prompt attempts ───────────────────
    if (method === 'qr' && !isValidQrCode(sponsor.qrCode, qrCode)) {
      return new Response(
        JSON.stringify({
          correct: false,
          message: 'This QR code isn\'t valid for this sponsor. Try answering the question at the table instead.',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Prompt path: fuzzy match ────────────────────────────────────────────────
    const correct = method === 'qr' || isCorrectAnswer(sponsor.promptAnswerKeyword, answer);

    if (!correct) {
      // Upsert the single failed-attempt doc (unique key prevents multiple docs per sponsor)
      const newAttemptsUsed = attemptsUsed + 1;
      await upsertCheckin({
        id:              failedAttemptDoc?.id ?? uuidv4(),
        attendeeId:      attendee.id,
        attendeeEmail:   attendee.email,
        sponsorId:       sponsor.id,
        sponsorName:     sponsor.name,
        pointsAwarded:   0,
        answerSubmitted: answer,
        method:          'prompt',
        attemptCount:    newAttemptsUsed,
        rejectedAnswers: [...(failedAttemptDoc?.rejectedAnswers ?? []), answer],
        timestamp:       now,
        conferenceYear:  Number(process.env.CONFERENCE_YEAR ?? '2026'),
        manualCredit:    false,
        manualCreditNote: null,
        manualCreditBy:  null,
        failed:          true,
      });

      const hint = newAttemptsUsed >= MAX_ATTEMPTS ? generateHint(sponsor.promptAnswerKeyword) : null;

      return new Response(
        JSON.stringify({
          correct: false,
          attemptsUsed: newAttemptsUsed,
          hint,
          message: hint
            ? `Not quite — but here's a hint: "${hint}"`
            : `Not quite — ${MAX_ATTEMPTS - newAttemptsUsed} attempt(s) remaining`,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Correct answer: record checkin ────────────────────────────────────
    // If a failed-attempt doc exists for this sponsor, reuse its id so we
    // overwrite it in-place — avoids violating the unique key on /sponsorId.
    const rejectedAnswers = failedAttemptDoc?.rejectedAnswers ?? [];
    const checkinId = failedAttemptDoc?.id ?? uuidv4();

    await upsertCheckin({
      id:              checkinId,
      attendeeId:      attendee.id,
      attendeeEmail:   attendee.email,
      sponsorId:       sponsor.id,
      sponsorName:     sponsor.name,
      pointsAwarded:   sponsor.pointValue,
      answerSubmitted: method === 'prompt' ? answer : null,
      method,
      attemptCount:    method === 'prompt' ? attemptsUsed + 1 : attemptsUsed,
      rejectedAnswers,
      timestamp:       now,
      conferenceYear:  Number(process.env.CONFERENCE_YEAR ?? '2026'),
      manualCredit:    false,
      manualCreditNote: null,
      manualCreditBy:  null,
      failed:          false,
    });

    // ── Update attendee totals ─────────────────────────────────────────────
    // Number() guards against string values hand-entered in Cosmos (would otherwise concatenate)
    const newTotalPoints  = Number(attendee.totalPoints ?? 0) + Number(sponsor.pointValue);
    const threshold       = Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '1000');
    const newIsComplete   = newTotalPoints >= threshold;
    const newCompletedAt  = newIsComplete && !attendee.isComplete ? now : attendee.completedAt;
    const newStamps       = [...(attendee.completedStamps ?? []), sponsorId];

    const updatedAttendee = {
      ...attendee,
      totalPoints:     newTotalPoints,
      completedStamps: newStamps,
      isComplete:      newIsComplete,
      completedAt:     newCompletedAt,
    };

    await upsertAttendee(updatedAttendee);

    // ── Send completion email (fire-and-forget) ───────────────────────────
    if (newIsComplete && !attendee.isComplete) {
      sendCompletionEmail(attendee.email, attendee.firstName, now).catch(err => {
        console.error('[checkin] Completion email failed:', err.message);
      });
    }

    return new Response(
      JSON.stringify({
        correct:       true,
        method,
        pointsAwarded: sponsor.pointValue,
        totalPoints:   newTotalPoints,
        isComplete:    newIsComplete,
        completedAt:   newCompletedAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
