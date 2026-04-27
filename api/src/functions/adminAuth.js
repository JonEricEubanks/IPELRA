/**
 * adminAuth.js — Admin magic-link authentication
 *
 * POST /api/admin/auth/sendLink  — send login link to admin email
 * GET  /api/admin/auth/verify    — verify token, return admin session JWT
 */

import { app } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { signAdminMagicToken, signAdminToken } from '../lib/auth.js';
import { sendAdminMagicLinkEmail } from '../lib/email.js';

const JWT_SECRET = () => process.env.JWT_SECRET;
const ADMIN_EMAILS = () => (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const APP_URL = () => process.env.APP_URL
  || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : 'http://localhost:4280');

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/admin/auth/sendLink
app.http('adminAuthSendLink', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/auth/sendLink',
  handler: async (req) => {
    let body;
    try { body = await req.json(); } catch { body = {}; }

    const email = (body.email ?? '').trim().toLowerCase();

    // Always return the same message — don't reveal whether email is authorized
    if (!email || !ADMIN_EMAILS().includes(email)) {
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

// GET /api/admin/auth/verify?token=
app.http('adminAuthVerify', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/auth/verify',
  handler: async (req) => {
    const token = req.query.get('token');
    if (!token) return json(400, { error: 'token is required' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET());
    } catch {
      return json(401, { error: 'Link expired or invalid. Please request a new one.' });
    }

    const email = (payload.sub ?? '').trim().toLowerCase();
    if (payload.purpose !== 'admin-login' || !email || !ADMIN_EMAILS().includes(email)) {
      return json(403, { error: 'Not authorized' });
    }

    const sessionToken = signAdminToken(email);
    return json(200, { token: sessionToken, email });
  },
});
