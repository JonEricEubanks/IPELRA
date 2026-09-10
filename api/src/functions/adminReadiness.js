/**
 * adminReadiness.js — GET /api/mgmt/readiness
 *
 * Live readiness checklist for admins — pulls real data to confirm
 * the system is configured and ready for the conference.
 *
 * Returns a list of checks with status: 'ok' | 'warn' | 'error'
 *
 * Auth: Admin JWT
 */

import { app } from '@azure/functions';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import { getAllSponsors, getAllAttendees } from '../lib/cosmos.js';

app.http('adminReadiness', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/readiness',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const checks = [];

    // 1. Passport Live flag
    const isLive = process.env.PASSPORT_LIVE === 'true';
    checks.push({
      id:      'passport_live',
      label:   'Passport is live',
      status:  isLive ? 'ok' : 'warn',
      detail:  isLive ? 'PASSPORT_LIVE=true' : 'PASSPORT_LIVE=false — flip to "true" on the morning of Oct 5',
      action:  isLive ? null : 'az functionapp config appsettings set --settings PASSPORT_LIVE=true',
    });

    // 2. Completion threshold
    const threshold = Number(process.env.COMPLETION_THRESHOLD_POINTS ?? '0');
    checks.push({
      id:      'threshold',
      label:   'Completion threshold',
      status:  threshold > 0 ? 'ok' : 'error',
      detail:  threshold > 0 ? `${threshold} points` : 'COMPLETION_THRESHOLD_POINTS is 0 or not set',
    });

    // 3. JWT secret
    const jwtSecret = process.env.JWT_SECRET ?? '';
    checks.push({
      id:      'jwt_secret',
      label:   'JWT secret configured',
      status:  jwtSecret.length >= 32 ? 'ok' : 'error',
      detail:  jwtSecret.length >= 32
        ? `Set (${jwtSecret.length} chars)`
        : `Too short or not set (${jwtSecret.length} chars — minimum 32)`,
    });

    // 4. ACS configuration
    const acsSender = process.env.ACS_SENDER_ADDRESS ?? '';
    checks.push({
      id:      'acs_sender',
      label:   'ACS sender address',
      status:  acsSender.includes('@') ? 'ok' : 'error',
      detail:  acsSender || 'ACS_SENDER_ADDRESS not set',
    });

    // 5. Admin emails
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
    checks.push({
      id:      'admin_emails',
      label:   'Admin emails configured',
      status:  adminEmails.length > 0 ? 'ok' : 'error',
      detail:  adminEmails.length > 0 ? `${adminEmails.length} admin(s): ${adminEmails.join(', ')}` : 'ADMIN_EMAILS not set',
    });

    // 6. Active sponsors
    let sponsors = [];
    try {
      sponsors = await getAllSponsors();
    } catch (err) {
      checks.push({ id: 'sponsors_db', label: 'Cosmos DB connection', status: 'error', detail: err.message });
    }
    const activeSponsors = sponsors.filter(s => s.isActive);
    checks.push({
      id:      'active_sponsors',
      label:   'Active sponsors',
      status:  activeSponsors.length >= 5 ? 'ok' : activeSponsors.length > 0 ? 'warn' : 'error',
      detail:  `${activeSponsors.length} active / ${sponsors.length} total`,
    });

    const sponsorsMissingKeyword = sponsors.filter(s => s.isActive && !s.promptAnswerKeyword?.trim());
    if (sponsorsMissingKeyword.length > 0) {
      checks.push({
        id:      'sponsor_keywords',
        label:   'All active sponsors have answer keywords',
        status:  'error',
        detail:  `${sponsorsMissingKeyword.length} active sponsor(s) missing promptAnswerKeyword: ${sponsorsMissingKeyword.map(s => s.name).join(', ')}`,
      });
    } else {
      checks.push({
        id:      'sponsor_keywords',
        label:   'All active sponsors have answer keywords',
        status:  activeSponsors.length > 0 ? 'ok' : 'warn',
        detail:  activeSponsors.length > 0 ? `All ${activeSponsors.length} active sponsors have keywords` : 'No active sponsors',
      });
    }

    // 7. Test attendee exists
    let attendees = [];
    try {
      attendees = await getAllAttendees(process.env.CONFERENCE_YEAR ?? '2026');
    } catch { /* DB error already logged above */ }
    const hasTestAttendee = attendees.some(a => a.email.includes('test') || a.email.includes('mgp'));
    checks.push({
      id:      'test_attendee',
      label:   'Test attendee exists',
      status:  hasTestAttendee ? 'ok' : 'warn',
      detail:  hasTestAttendee
        ? `${attendees.length} attendee(s) registered (test user found)`
        : `${attendees.length} attendee(s) registered — consider testing with a real email`,
    });

    // 8. Passport lock time
    const lockUtc = process.env.PASSPORT_LOCK_UTC ?? '';
    const lockDate = lockUtc ? new Date(lockUtc) : null;
    checks.push({
      id:      'passport_lock',
      label:   'Passport lock time',
      status:  lockDate && lockDate > new Date() ? 'ok' : lockDate ? 'error' : 'error',
      detail:  lockDate
        ? `${lockUtc} (${lockDate > new Date() ? 'in the future ✓' : '⚠️ ALREADY PASSED'})`
        : 'PASSPORT_LOCK_UTC not set',
    });

    const overallStatus = checks.some(c => c.status === 'error') ? 'error'
      : checks.some(c => c.status === 'warn') ? 'warn' : 'ok';

    return new Response(
      JSON.stringify({ checks, overallStatus, asOf: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
