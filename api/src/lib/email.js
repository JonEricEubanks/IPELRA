/**
 * email.js — ACS Email helpers
 *
 * Wraps the Azure Communication Services Email client.
 * Used for:
 *   1. Magic link emails (attendee authentication)
 *   2. Completion congratulations emails
 */

import { EmailClient } from '@azure/communication-email';

// Lazy singleton — created on first use, reused by warm instances
let _emailClient = null;

function getEmailClient() {
  if (!_emailClient) {
    const connStr = process.env.ACS_CONNECTION_STRING;
    if (!connStr) throw new Error('ACS_CONNECTION_STRING is not set');
    _emailClient = new EmailClient(connStr);
  }
  return _emailClient;
}

const SENDER = () => {
  const s = process.env.ACS_SENDER_ADDRESS;
  if (!s) throw new Error('ACS_SENDER_ADDRESS is not set');
  return s;
};

const APP_URL = () => process.env.APP_URL
  || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : 'http://localhost:4280');

// ── Templates ─────────────────────────────────────────────────────────────────

function magicLinkHtml(verifyUrl, firstName) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your IPELRA Passport Login Link</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://ipelra.org/wp-content/uploads/2021/09/ipelra-logo.png" alt="IPELRA" style="height: 48px;" />
    </div>
    <h2 style="color: #1a2e4a; margin: 0 0 8px; font-size: 22px;">Your Conference Passport Link</h2>
    <p style="color: #555; font-size: 15px; line-height: 1.5; margin: 0 0 24px;">${greeting}<br/><br/>
      Click the button below to access your IPELRA Conference Passport. This link expires in <strong>15 minutes</strong> and can only be used once.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${verifyUrl}" style="display: inline-block; background: #0077cc; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        Open My Passport
      </a>
    </div>
    <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${verifyUrl}" style="color: #0077cc; word-break: break-all;">${verifyUrl}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
      IPELRA Annual Conference 2026 · Eagle Ridge Resort, Galena IL
    </p>
  </div>
</body>
</html>`;
}

function completionHtml(firstName, completedAt) {
  const greeting = firstName ? `Congratulations, ${firstName}!` : 'Congratulations!';
  const timestamp = new Date(completedAt).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You Completed the IPELRA Passport!</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://ipelra.org/wp-content/uploads/2021/09/ipelra-logo.png" alt="IPELRA" style="height: 48px;" />
    </div>
    <h2 style="color: #1a2e4a; margin: 0 0 8px; font-size: 22px;">🎉 ${greeting}</h2>
    <p style="color: #555; font-size: 15px; line-height: 1.5; margin: 0 0 16px;">
      You completed the 2026 IPELRA Conference Passport on <strong>${timestamp} CT</strong>.
    </p>
    <p style="color: #555; font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
      You are now eligible for the prize drawing! Look for the prize entry station at the conference or check with an IPELRA staff member.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
      IPELRA Annual Conference 2026 · Eagle Ridge Resort, Galena IL<br/>
      Keep this email as your completion confirmation.
    </p>
  </div>
</body>
</html>`;
}

// ── Send Functions ────────────────────────────────────────────────────────────

/**
 * Sends a magic link email.
 *
 * @param {string} toEmail
 * @param {string} rawToken  - The un-hashed token to embed in the URL
 * @param {string|null} firstName
 * @param {string|null} next - Optional pre-validated /scan/... path to resume after login
 */
export async function sendMagicLinkEmail(toEmail, rawToken, firstName = null, next = null) {
  const verifyUrl = `${APP_URL()}/verify?token=${encodeURIComponent(rawToken)}`
    + (next ? `&next=${encodeURIComponent(next)}` : '');
  const displayName = firstName ? firstName.trim() : null;

  const message = {
    senderAddress: SENDER(),
    recipients: { to: [{ address: toEmail }] },
    content: {
      subject: 'Your IPELRA Conference Passport Login Link',
      html: magicLinkHtml(verifyUrl, displayName),
      plainText: [
        displayName ? `Hi ${displayName},` : 'Hi there,',
        '',
        'Use the link below to access your IPELRA Conference Passport.',
        'This link expires in 15 minutes and can only be used once.',
        '',
        verifyUrl,
        '',
        'IPELRA Annual Conference 2026 · Eagle Ridge Resort, Galena IL',
      ].join('\n'),
    },
  };

  const poller = await getEmailClient().beginSend(message);
  const result = await poller.pollUntilDone();

  if (result.status === 'Failed') {
    throw new Error(`ACS email send failed: ${result.error?.message ?? 'unknown error'}`);
  }

  return result.id;
}

/**
 * Sends a completion congratulations email.
 *
 * @param {string} toEmail
 * @param {string|null} firstName
 * @param {string} completedAt  - ISO 8601 timestamp of completion
 */
export async function sendCompletionEmail(toEmail, firstName = null, completedAt) {
  const displayName = firstName ? firstName.trim() : null;

  const message = {
    senderAddress: SENDER(),
    recipients: { to: [{ address: toEmail }] },
    content: {
      subject: '🎉 You Completed the 2026 IPELRA Conference Passport!',
      html: completionHtml(displayName, completedAt),
      plainText: [
        displayName ? `Congratulations, ${displayName}!` : 'Congratulations!',
        '',
        `You completed the 2026 IPELRA Conference Passport on ${new Date(completedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT.`,
        '',
        'You are now eligible for the prize drawing!',
        '',
        'IPELRA Annual Conference 2026 · Eagle Ridge Resort, Galena IL',
      ].join('\n'),
    },
  };

  const poller = await getEmailClient().beginSend(message);
  const result = await poller.pollUntilDone();

  if (result.status === 'Failed') {
    throw new Error(`ACS email send failed: ${result.error?.message ?? 'unknown error'}`);
  }

  return result.id;
}

/**
 * Sends an admin magic link email.
 *
 * @param {string} toEmail
 * @param {string} loginUrl  - Full URL including token
 */
export async function sendAdminMagicLinkEmail(toEmail, loginUrl) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IPELRA Admin Login</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://ipelra.org/wp-content/uploads/2021/09/ipelra-logo.png" alt="IPELRA" style="height: 48px;" />
    </div>
    <h2 style="color: #1a2e4a; margin: 0 0 8px; font-size: 22px;">Admin Login Link</h2>
    <p style="color: #555; font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
      Click the button below to sign in to the IPELRA Admin Portal. This link expires in <strong>15 minutes</strong>.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${loginUrl}" style="display: inline-block; background: #0077cc; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        Sign In to Admin Portal
      </a>
    </div>
    <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0;">
      If you did not request this link, you can ignore this email.<br/>
      Link: <a href="${loginUrl}" style="color: #0077cc; word-break: break-all;">${loginUrl}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
      IPELRA Annual Conference 2026 � Eagle Ridge Resort, Galena IL
    </p>
  </div>
</body>
</html>`;

  const message = {
    senderAddress: SENDER(),
    recipients: { to: [{ address: toEmail }] },
    content: {
      subject: 'IPELRA Admin Login Link',
      html,
      plainText: `Your admin login link (expires in 15 minutes):\n\n${loginUrl}\n\nIf you did not request this, ignore this email.`,
    },
  };

  const poller = await getEmailClient().beginSend(message);
  const result = await poller.pollUntilDone();

  if (result.status === 'Failed') {
    throw new Error(`ACS email send failed: ${result.error?.message ?? 'unknown error'}`);
  }

  return result.id;
}
