/**
 * adminAuth.js — Admin magic-link authentication
 *
 * POST /api/mgmt/auth/sendLink  — send login link to admin email
 * GET  /api/mgmt/auth/verify    — verify token, return admin session JWT
 */

import { app } from '@azure/functions';
import { signAdminMagicToken, signAdminToken, verifyAdminMagicToken, getAdminEmails } from '../lib/auth.js';
import { sendAdminMagicLinkEmail } from '../lib/email.js';
import { isAllowed } from '../lib/rateLimit.js';
import { jsonResponse as json } from '../lib/http.js';

const APP_URL = () => process.env.APP_URL
  || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : 'http://localhost:4280');

// POST /api/mgmt/auth/sendLink
app.http('adminAuthSendLink', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/auth/sendLink',
  handler: async (req) => {
    let body;
    try { body = await req.json(); } catch { body = {}; }

    const email = (body.email ?? '').trim().toLowerCase();

    // ── Rate limit (per email, applied before the allowlist check so the
    // response is identical whether or not the email is a real admin) ──
    if (!isAllowed(`adminAuthSendLink:${email || 'unknown'}`)) {
      return json(429, { error: 'Too many requests. Please wait a few minutes and try again.' });
    }

    // Always return the same message — don't reveal whether email is authorized
    if (!email || !getAdminEmails().includes(email)) {
      return json(200, { message: 'If that email is authorized, a login link has been sent.' });
    }

    try {
      const token = signAdminMagicToken(email);
      const loginUrl = `${APP_URL()}/admin/verify?token=${encodeURIComponent(token)}`;
      await sendAdminMagicLinkEmail(email, loginUrl);
    } catch (err) {
      console.error('[adminAuthSendLink] Failed to send email:', err.message);
      return json(500, { error: 'Failed to send login email. Please try again.' });
    }

    return json(200, { message: 'If that email is authorized, a login link has been sent.' });
  },
});

// GET /api/mgmt/auth/verify?token=
app.http('adminAuthVerify', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/auth/verify',
  handler: async (req) => {
    const token = req.query.get('token');
    if (!token) return json(400, { error: 'token is required' });

    let email;
    try {
      email = verifyAdminMagicToken(token);
    } catch (err) {
      return err.status === 403
        ? json(403, { error: 'Not authorized' })
        : json(401, { error: 'Link expired or invalid. Please request a new one.' });
    }

    const sessionToken = signAdminToken(email);
    return json(200, { token: sessionToken, email });
  },
});
