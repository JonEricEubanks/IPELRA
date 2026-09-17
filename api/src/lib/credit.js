/**
 * credit.js — awards a sponsor's points to an attendee with optimistic concurrency.
 *
 * Read → compute → ETag-guarded replace. On a 412 (someone else updated the
 * attendee between our read and write) the attendee is re-read and the update
 * is retried, so two concurrent unlocks can never double-count and a
 * concurrent admin credit is never overwritten.
 */

import { getAttendeeById, replaceAttendee } from './cosmos.js';

const MAX_RETRIES = 3;

/**
 * @param {object} attendee   attendee doc as last read (must include _etag)
 * @param {string} sponsorId
 * @param {number} points
 * @param {string} now        ISO timestamp for completedAt
 * @returns {Promise<{ attendee: object, alreadyCompleted: boolean, newlyComplete: boolean }>}
 */
export async function creditAttendee(attendee, sponsorId, points, now) {
  const threshold = Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '1000');
  let current = attendee;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (current.completedStamps?.includes(sponsorId)) {
      return { attendee: current, alreadyCompleted: true, newlyComplete: false };
    }

    const totalPoints   = Number(current.totalPoints ?? 0) + Number(points);
    const isComplete    = totalPoints >= threshold;
    const newlyComplete = isComplete && !current.isComplete;

    const updated = {
      ...current,
      totalPoints,
      completedStamps: [...(current.completedStamps ?? []), sponsorId],
      isComplete,
      completedAt: newlyComplete ? now : current.completedAt,
    };

    try {
      const saved = await replaceAttendee(updated);
      return { attendee: saved, alreadyCompleted: false, newlyComplete };
    } catch (err) {
      if (err.code !== 412) throw err;
      current = await getAttendeeById(current.id, current.email);
      if (!current) throw err;
    }
  }

  const err = new Error('Attendee record kept changing; please try again');
  err.code = 412;
  throw err;
}
