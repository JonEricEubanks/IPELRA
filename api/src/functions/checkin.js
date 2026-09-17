/**
 * checkin.js — POST /api/checkin
 *
 * Core game mechanic: attendee unlocks a sponsor stop by answering the
 * sponsor's prompt question. A printed/in-app QR scan only deep-links the
 * attendee to that sponsor's question (see ScanPage) — it never awards
 * points by itself; the attendee still has to answer correctly here.
 *
 * Body: { sponsorId, answer }
 *
 * Flow:
 * 1. Validate JWT + extract attendeeId
 * 2. Load sponsor (verify active, get keyword + pointValue)
 * 3. Check passport is live and not locked
 * 4. Check attendee hasn't already completed this sponsor
 * 5. Fuzzy-match the answer (3 attempts, hint on 3rd):
 *    - Miss: return 422 with attempt feedback + hint after 3rd attempt
 *    - Hit: create checkin doc, update attendee points + stamps, maybe send completion email
 * 6. Cosmos unique key (/sponsorId within /attendeeId partition) prevents
 *    duplicate checkins at the DB level as a final safety net
 *
 * Returns 200: { correct: true, pointsAwarded, totalPoints, isComplete, completedAt? }
 * Returns 422: { correct: false, attemptsUsed?, hint?, message }
 * Returns 400/401/403/404/409/423: various error states
 */

import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAttendeeAuth, unauthorizedResponse } from '../lib/auth.js';
import { isCorrectAnswer, generateHint } from '../lib/fuzzyMatch.js';
import {
  getSponsorById,
  getAttendeeById,
  upsertCheckin,
  getCheckinsByAttendee,
} from '../lib/cosmos.js';
import { creditAttendee } from '../lib/credit.js';
import { sendCompletionEmail } from '../lib/email.js';
import { jsonResponse as json } from '../lib/http.js';

const MAX_ATTEMPTS       = 3;
const MAX_ANSWER_LENGTH  = 500;

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
      return json(423, { error: 'The conference passport is not yet open.' });
    }

    const lockUtc = process.env.PASSPORT_LOCK_UTC ?? '2026-10-11T00:00:00Z';
    if (new Date() >= new Date(lockUtc)) {
      return json(423, { error: 'The conference passport has closed. Thank you for participating!' });
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    const sponsorId = (body.sponsorId ?? '').trim();
    const answer    = (body.answer    ?? '').trim();

    if (!sponsorId || !answer) {
      return json(400, { error: 'sponsorId and answer are required' });
    }

    // Clamp length to prevent abuse
    if (answer.length > MAX_ANSWER_LENGTH) {
      return json(400, { error: 'Input is too long' });
    }

    // ── Load sponsor ──────────────────────────────────────────────────────
    const sponsor = await getSponsorById(sponsorId);
    if (!sponsor || !sponsor.isActive) {
      return json(404, { error: 'Sponsor not found or not active' });
    }

    // ── Load attendee ─────────────────────────────────────────────────────
    const attendee = await getAttendeeById(principal.sub, principal.email);
    if (!attendee) {
      return json(404, { error: 'Attendee record not found' });
    }

    // ── Already completed this sponsor? ───────────────────────────────────
    if (attendee.completedStamps?.includes(sponsorId)) {
      return json(409, { error: 'You have already completed this sponsor stop' });
    }

    // ── Count previous failed attempts for this sponsor ───────────────────
    const existingCheckins = await getCheckinsByAttendee(principal.sub);
    const priorAttempts = existingCheckins.filter(c => c.sponsorId === sponsorId);
    // Due to the unique key constraint (/sponsorId per attendee partition), only one
    // failed-attempt document can exist per attendee+sponsor. Read the stored count.
    const failedAttemptDoc = priorAttempts.find(c => c.failed === true);
    const attemptsUsed = failedAttemptDoc?.attemptCount ?? 0;
    const now = new Date().toISOString();

    // ── Fuzzy match ──────────────────────────────────────────────────────
    const correct = isCorrectAnswer(sponsor.promptAnswerKeyword, answer);

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
      const triesUntilHint = Math.max(0, MAX_ATTEMPTS - newAttemptsUsed);

      // Attempts are never locked — the whole point is that the attendee goes
      // and talks to the sponsor. Wording steers them to the table rather than
      // implying a hard limit.
      let message;
      if (hint) {
        message = `Still not it. Hint: "${hint}" — your best bet is to stop by the ${sponsor.name} table and ask.`;
      } else if (triesUntilHint === 1) {
        message = `Not quite. One more try before we show a hint — or skip the guessing: the ${sponsor.name} rep will tell you the answer.`;
      } else {
        message = `Not quite. ${triesUntilHint} more tries before we show a hint — or just ask at the ${sponsor.name} table.`;
      }

      return json(422, {
        correct: false,
        attemptsUsed: newAttemptsUsed,
        triesUntilHint,
        hint,
        message,
      });
    }

    // ── Correct answer: record checkin ────────────────────────────────────
    // If a failed-attempt doc exists for this sponsor, reuse its id so we
    // overwrite it in-place — avoids violating the unique key on /sponsorId.
    const rejectedAnswers = failedAttemptDoc?.rejectedAnswers ?? [];
    const checkinId = failedAttemptDoc?.id ?? uuidv4();
    // Some sponsor docs were hand-edited with pointValue as a string
    const pointValue = Number(sponsor.pointValue) || 0;

    try {
      await upsertCheckin({
        id:              checkinId,
        attendeeId:      attendee.id,
        attendeeEmail:   attendee.email,
        sponsorId:       sponsor.id,
        sponsorName:     sponsor.name,
        pointsAwarded:   pointValue,
        answerSubmitted: answer,
        method:          'prompt',
        attemptCount:    attemptsUsed + 1,
        rejectedAnswers,
        timestamp:       now,
        conferenceYear:  Number(process.env.CONFERENCE_YEAR ?? '2026'),
        manualCredit:    false,
        manualCreditNote: null,
        manualCreditBy:  null,
        failed:          false,
      });
    } catch (err) {
      // Unique key on /sponsorId: a concurrent request already unlocked this stop
      if (err.code === 409) {
        return json(409, { error: 'You have already completed this sponsor stop' });
      }
      throw err;
    }

    // ── Update attendee totals (ETag-guarded, retried on conflict) ────────
    const { attendee: updatedAttendee, alreadyCompleted, newlyComplete } =
      await creditAttendee(attendee, sponsorId, pointValue, now);

    if (alreadyCompleted) {
      return json(409, { error: 'You have already completed this sponsor stop' });
    }

    // ── Send completion email (fire-and-forget) ───────────────────────────
    if (newlyComplete) {
      sendCompletionEmail(attendee.email, attendee.firstName, now).catch(err => {
        console.error('[checkin] Completion email failed:', err.message);
      });
    }

    return json(200, {
      correct:       true,
      pointsAwarded: pointValue,
      totalPoints:   updatedAttendee.totalPoints,
      isComplete:    updatedAttendee.isComplete,
      completedAt:   updatedAttendee.completedAt,
    });
  },
});
