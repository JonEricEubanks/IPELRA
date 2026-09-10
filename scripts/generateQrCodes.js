/**
 * generateQrCodes.js — Assigns a per-sponsor QR secret and builds printable QR sheets.
 *
 * Usage (from the scripts/ directory):
 *   npm install
 *   APP_URL=https://<your-swa-host> node generateQrCodes.js
 *
 * What it does:
 *   1. Reads every sponsor from Cosmos.
 *   2. For any sponsor WITHOUT a `qrCode`, generates a random 16-char secret and
 *      saves it. Existing codes are never changed — re-running is safe and will not
 *      invalidate already-printed sheets.
 *   3. Writes ../assets/qr-sheets.html — one print-ready page per sponsor with a QR
 *      encoding  <APP_URL>/scan/<sponsorId>?c=<qrCode>
 *
 * Inactive sponsors still get a code (so they can be tested) and a sheet, but the
 * sheet is clearly stamped INACTIVE so it isn't accidentally placed on a table.
 *
 * Connection string resolution order:
 *   1. COSMOS_CONNECTION_STRING environment variable
 *   2. ../api/local.settings.json  (Values.COSMOS_CONNECTION_STRING)
 */

import { CosmosClient } from '@azure/cosmos';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── App URL (required, must be the real production host) ──────────────────────

const rawAppUrl = process.env.APP_URL;
if (!rawAppUrl) {
  console.error(
    '\n❌  APP_URL is not set.\n' +
    '    The QR codes must point at the live app, e.g.:\n' +
    '      APP_URL=https://your-app.azurestaticapps.net node generateQrCodes.js\n'
  );
  process.exit(1);
}
const APP_URL = rawAppUrl.replace(/\/+$/, '');
if (APP_URL.includes('localhost')) {
  console.warn('\n⚠️   APP_URL points at localhost — these QR codes will NOT work on real phones.\n');
}

// ── Resolve connection string ─────────────────────────────────────────────────

let connStr = process.env.COSMOS_CONNECTION_STRING;
if (!connStr) {
  const settingsPath = resolve(__dirname, '../api/local.settings.json');
  if (existsSync(settingsPath)) {
    try {
      connStr = JSON.parse(readFileSync(settingsPath, 'utf8'))?.Values?.COSMOS_CONNECTION_STRING;
    } catch { /* fall through */ }
  }
}
if (!connStr || connStr.includes('<your-account>')) {
  console.error('\n❌  COSMOS_CONNECTION_STRING not configured (env var or api/local.settings.json).\n');
  process.exit(1);
}

const container = new CosmosClient(connStr).database('ipelra-passport').container('sponsors');

// ── 1. Load sponsors ──────────────────────────────────────────────────────────

const { resources: sponsors } = await container.items.query('SELECT * FROM c').fetchAll();
console.log(`\n📋  Loaded ${sponsors.length} sponsor(s) from Cosmos.\n`);

// ── 2. Assign missing qrCodes ─────────────────────────────────────────────────

let assigned = 0;
for (const sponsor of sponsors) {
  if (sponsor.qrCode) {
    console.log(`  ⏭️   ${sponsor.name.padEnd(60)} already has a code`);
    continue;
  }
  // 12 random bytes -> 16 URL-safe chars
  sponsor.qrCode = crypto.randomBytes(12).toString('base64url');
  await container.items.upsert(sponsor);
  assigned++;
  console.log(`  ✅  ${sponsor.name.padEnd(60)} code assigned`);
}
console.log(`\n🔑  ${assigned} new code(s) assigned, ${sponsors.length - assigned} unchanged.\n`);

// ── 3. Build printable sheets ─────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Embed every logo as a data URI so the sheet prints identically offline / at a print
// shop and never depends on the deployed app or a sponsor's hotlinked image.
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' };

async function embedLogo(url) {
  if (!url) return null;
  try {
    if (url.startsWith('/')) {
      // Hosted in the app's public/ folder — read straight from disk
      const file = resolve(__dirname, '../app/public', '.' + url);
      const ext  = (url.match(/\.[a-z0-9]+$/i) ?? [''])[0].toLowerCase();
      return `data:${MIME[ext] ?? 'image/png'};base64,${readFileSync(file).toString('base64')}`;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') ?? 'image/png').split(';')[0];
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch (err) {
    console.warn(`  ⚠️   Could not embed logo ${url} (${err.message}) — falling back to URL`);
    return url.startsWith('/') ? `${APP_URL}${url}` : url;
  }
}

const sorted = [...sponsors].sort((a, b) => {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
  if (a.tier !== b.tier) return a.tier === 'leadership' ? -1 : 1;
  return a.name.localeCompare(b.name);
});

const pages = [];
const brandLogo = await embedLogo('/logo-text.png');

// Page 1: registration-desk sign. Attendees log in once here so every sponsor
// QR afterwards is an instant unlock with no login at the table.
{
  const loginUrl = `${APP_URL}/login`;
  const qrSvg = await QRCode.toString(loginUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  pages.push(`
    <section class="sheet registration">
      <header>
        <img class="brand" src="${escapeHtml(brandLogo)}" alt="IPELRA" />
        <div class="event">2026 Annual Conference Passport</div>
      </header>

      <div class="sponsor">
        <h1>Activate Your Passport</h1>
        <div class="tier">Start here &middot; takes 30 seconds</div>
      </div>

      <div class="qr">${qrSvg}</div>

      <div class="instructions">
        <div class="headline">Scan to get started</div>
        <p>Open your phone&rsquo;s camera, point it at the code, and enter your email.<br/>
           We&rsquo;ll send you a one-tap login link.</p>
        <p class="alt">Do this once now &mdash; then every sponsor stop is a single scan, no login needed.<br/>
           Visit sponsor tables, collect points, and enter the prize drawing.</p>
      </div>

      <footer>${escapeHtml(APP_URL.replace(/^https?:\/\//, ''))}</footer>
    </section>`);
}

for (const s of sorted) {
  const scanUrl = `${APP_URL}/scan/${encodeURIComponent(s.id)}?c=${encodeURIComponent(s.qrCode)}`;
  const qrSvg   = await QRCode.toString(scanUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  const logo    = await embedLogo(s.logoUrl);
  const logoCls = s.logoBg === 'dark' ? 'logo dark' : 'logo';
  const tier    = s.tier === 'leadership' ? 'Leadership Sponsor' : 'Partnership Sponsor';
  const pts     = Number(s.pointValue) || (s.tier === 'leadership' ? 150 : 100);

  pages.push(`
    <section class="sheet${s.isActive ? '' : ' inactive'}">
      ${s.isActive ? '' : '<div class="banner">INACTIVE — FOR TESTING ONLY, DO NOT PLACE ON TABLE</div>'}
      <header>
        <img class="brand" src="${escapeHtml(brandLogo)}" alt="IPELRA" />
        <div class="event">2026 Annual Conference Passport</div>
      </header>

      <div class="sponsor">
        ${logo ? `<div class="${logoCls}"><img src="${escapeHtml(logo)}" alt="${escapeHtml(s.name)}" /></div>` : ''}
        <h1>${escapeHtml(s.name)}</h1>
        <div class="tier">${tier} &middot; ${pts} points</div>
      </div>

      <div class="qr">${qrSvg}</div>

      <div class="instructions">
        <div class="headline">Scan to unlock this stop</div>
        <p>Open your phone&rsquo;s camera and point it at the code.<br/>
           No app download needed.</p>
        <p class="alt">First time? You&rsquo;ll log in once with your email &mdash; after that every stop is a single scan.</p>
        <p class="alt">Or open the passport and answer this sponsor&rsquo;s question.</p>
      </div>

      <footer>${escapeHtml(APP_URL.replace(/^https?:\/\//, ''))}</footer>
    </section>`);
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>IPELRA Passport — Sponsor QR Sheets</title>
<style>
  @page { size: letter portrait; margin: 0.5in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif; color: #191c1d; background: #e7e8e9; }
  .sheet {
    position: relative; width: 7.5in; min-height: 10in; margin: 0.25in auto; padding: 0.6in 0.6in 0.5in;
    background: #fff; display: flex; flex-direction: column; align-items: center; text-align: center;
    page-break-after: always; break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .banner { position: absolute; top: 0; left: 0; right: 0; background: #b91c1c; color: #fff; font-weight: 800; letter-spacing: .08em; padding: 8px; font-size: 13px; }
  .inactive { outline: 6px dashed #b91c1c; outline-offset: -6px; }
  .registration { outline: 6px solid #1a7f5a; outline-offset: -6px; }
  .registration .qr { border-color: #1a7f5a; }
  .registration .tier { color: #1a7f5a; }
  header { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 28px; }
  .brand { height: 44px; object-fit: contain; }
  .event { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #74777f; }
  .sponsor { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 26px; }
  .logo { width: 220px; height: 110px; display: flex; align-items: center; justify-content: center; background: #f3f4f5; border-radius: 18px; padding: 12px; }
  .logo.dark { background: #0d1e3c; }
  .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
  h1 { font-size: 30px; font-weight: 800; letter-spacing: -.5px; color: #1d3461; line-height: 1.15; }
  .tier { font-size: 14px; font-weight: 700; color: #254a84; text-transform: uppercase; letter-spacing: .1em; }
  .qr { width: 4.4in; height: 4.4in; padding: 14px; background: #fff; border: 3px solid #1d3461; border-radius: 22px; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .instructions { margin-top: 26px; max-width: 5.4in; }
  .headline { font-size: 24px; font-weight: 800; color: #1d3461; margin-bottom: 8px; }
  .instructions p { font-size: 15px; line-height: 1.5; color: #43474e; }
  .instructions .alt { margin-top: 10px; font-size: 13px; color: #74777f; }
  footer { margin-top: auto; padding-top: 18px; font-size: 11px; color: #74777f; letter-spacing: .04em; }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;

const outPath = resolve(__dirname, '../assets/qr-sheets.html');
writeFileSync(outPath, html, 'utf8');

console.log(`🖸️   Wrote ${sorted.length + 1} sheet(s) → ${outPath}`);
console.log(`     Registration sign: 1   Sponsors — active: ${sorted.filter(s => s.isActive).length}   inactive (test-only): ${sorted.filter(s => !s.isActive).length}`);
console.log(`\n✅  Done. Open the HTML in a browser and print (File → Print → Save as PDF).\n`);
