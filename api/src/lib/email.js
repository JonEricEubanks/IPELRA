/**
 * email.js — outbound email
 *
 * Used for:
 *   1. Magic link emails (attendee authentication)
 *   2. Completion congratulations emails
 *   3. Admin magic link emails
 *
 * Provider is chosen by EMAIL_PROVIDER:
 *   'graph' — Microsoft Graph, sending as a real Microsoft 365 mailbox
 *             (GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET / GRAPH_SENDER_ADDRESS).
 *             30 msgs/min, 10k recipients/day per mailbox. Preferred for the conference.
 *   'acs'   — Azure Communication Services (ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS).
 *             On an Azure-managed domain this is capped at 10 emails/HOUR — dev/test only.
 *
 * If the primary provider throws and the other is configured, we fail over once.
 * See docs/EMAIL-SENDING.md for setup and for switching the sender mailbox.
 */

import { EmailClient } from '@azure/communication-email';

// ── Provider config ──────────────────────────────────────────────────────────

const FROM_NAME = () => process.env.EMAIL_FROM_NAME || 'IPELRA Conference Passport';

function graphConfig() {
  const { GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER_ADDRESS } = process.env;
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_SENDER_ADDRESS) return null;
  return { tenantId: GRAPH_TENANT_ID, clientId: GRAPH_CLIENT_ID, clientSecret: GRAPH_CLIENT_SECRET, sender: GRAPH_SENDER_ADDRESS };
}

function acsConfig() {
  const { ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS } = process.env;
  if (!ACS_CONNECTION_STRING || !ACS_SENDER_ADDRESS) return null;
  return { connectionString: ACS_CONNECTION_STRING, sender: ACS_SENDER_ADDRESS };
}

/** Resolves the provider order: [primary, fallback?]. Exported for tests. */
export function resolveProviders() {
  const requested = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
  const graph = graphConfig();
  const acs   = acsConfig();
  const order = [];
  if (requested === 'graph')       { if (graph) order.push('graph'); if (acs) order.push('acs'); }
  else if (requested === 'acs')    { if (acs) order.push('acs');     if (graph) order.push('graph'); }
  else                             { if (graph) order.push('graph'); if (acs) order.push('acs'); } // unset: prefer graph if configured
  if (order.length === 0) throw new Error('No email provider configured (set EMAIL_PROVIDER and its credentials)');
  return order;
}

// ── Microsoft Graph sender ───────────────────────────────────────────────────

let _graphToken = null; // { value, expiresAt }

async function getGraphToken(cfg) {
  if (_graphToken && _graphToken.expiresAt - 60_000 > Date.now()) return _graphToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      scope:         'https://graph.microsoft.com/.default',
      grant_type:    'client_credentials',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Graph token request failed (${res.status}): ${data.error_description ?? data.error ?? 'unknown'}`);
  }
  _graphToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return _graphToken.value;
}

async function sendViaGraph(cfg, { to, subject, html, plainText, attachments = [] }) {
  const token = await getGraphToken(cfg);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.sender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
        from: { emailAddress: { address: cfg.sender, name: FROM_NAME() } },
        attachments: attachments.map(a => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name:         a.name,
          contentType:  a.contentType,
          contentId:    a.contentId,
          isInline:     true,
          contentBytes: a.contentBase64,
        })),
      },
      saveToSentItems: false,
    }),
  });
  if (res.status === 202) return `graph:${res.headers.get('request-id') ?? 'ok'}`;
  const text = await res.text().catch(() => '');
  const err = new Error(`Graph sendMail failed (${res.status}): ${text.slice(0, 300)}`);
  err.status = res.status;
  err.retryable = res.status === 429 || res.status >= 500;
  throw err;
}

// ── Azure Communication Services sender ──────────────────────────────────────

let _emailClient = null;

function getEmailClient(cfg) {
  if (!_emailClient) _emailClient = new EmailClient(cfg.connectionString);
  return _emailClient;
}

async function sendViaAcs(cfg, { to, subject, html, plainText, attachments = [] }) {
  const poller = await getEmailClient(cfg).beginSend({
    senderAddress: cfg.sender,
    recipients: { to: [{ address: to }] },
    content: { subject, html, plainText },
    attachments: attachments.map(a => ({
      name:            a.name,
      contentType:     a.contentType,
      contentId:       a.contentId,
      contentInBase64: a.contentBase64,
    })),
  });
  const result = await poller.pollUntilDone();
  if (result.status === 'Failed') {
    throw new Error(`ACS email send failed: ${result.error?.message ?? 'unknown error'}`);
  }
  return `acs:${result.id}`;
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

const SENDERS = {
  graph: (msg) => sendViaGraph(graphConfig(), msg),
  acs:   (msg) => sendViaAcs(acsConfig(), msg),
};

/**
 * Sends through the primary provider; on failure, tries the fallback once.
 * Throws the LAST error if every provider fails — callers surface that to the user.
 */
export async function sendEmail(msg) {
  const providers = resolveProviders();
  let lastErr;
  for (const name of providers) {
    try {
      return await SENDERS[name](msg);
    } catch (err) {
      lastErr = err;
      console.error(`[email] ${name} send failed for ${msg.to}: ${err.message}`);
    }
  }
  throw lastErr;
}

/** Test-only: clear cached clients/tokens. */
export function _resetForTests() {
  _graphToken = null;
  _emailClient = null;
}

const APP_URL = () => process.env.APP_URL
  || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : 'http://localhost:4280');

// ── Inline logo ──────────────────────────────────────────────────────────────
// Outlook (and many corporate mail clients) block remote images by default, so
// the logo is embedded as an inline attachment and referenced by cid:. Falls
// back to the hosted URL if the asset isn't bundled for some reason.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const LOGO_CID = 'ipelra-logo';
let _logoBase64 = null;
function logoBase64() {
  if (_logoBase64 === null) {
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      _logoBase64 = readFileSync(join(here, 'assets', 'logo-text.png')).toString('base64');
    } catch {
      _logoBase64 = '';
    }
  }
  return _logoBase64;
}
/** <img> src for the logo: cid: when embedded, hosted URL otherwise. */
const LOGO_SRC = () => (logoBase64() ? `cid:${LOGO_CID}` : `${APP_URL()}/logo-text.png`);
/** Attachment descriptors for the dispatcher (empty when not embedded). */
function logoAttachments() {
  const b64 = logoBase64();
  return b64 ? [{ name: 'logo-text.png', contentType: 'image/png', contentId: LOGO_CID, contentBase64: b64 }] : [];
}

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
      <img src="${LOGO_SRC()}" alt="IPELRA" style="height: 40px;" />
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
      <img src="${LOGO_SRC()}" alt="IPELRA" style="height: 40px;" />
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

  return sendEmail({
    attachments: logoAttachments(),
    to: toEmail,
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
  });
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

  return sendEmail({
    attachments: logoAttachments(),
    to: toEmail,
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
  });
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
      <img src="${LOGO_SRC()}" alt="IPELRA" style="height: 40px;" />
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
      IPELRA Annual Conference 2026 · Eagle Ridge Resort, Galena IL
    </p>
  </div>
</body>
</html>`;

  return sendEmail({
    attachments: logoAttachments(),
    to: toEmail,
    subject: 'IPELRA Admin Login Link',
    html,
    plainText: `Your admin login link (expires in 15 minutes):\n\n${loginUrl}\n\nIf you did not request this, ignore this email.`,
  });
}
