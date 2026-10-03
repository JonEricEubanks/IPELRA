/**
 * emailLoadTest.js — sends real login emails through the LIVE API to test the
 * mailbox rotation under conference-morning load.
 *
 * Every email goes to plus-addresses of ONE mailbox you own
 * (you+lt-<run>-001@domain … ), so nothing bounces and you can count arrivals.
 * Never point this at made-up addresses: bounces hurt the sending mailboxes.
 *
 * Usage (from scripts/):
 *   node emailLoadTest.js --to you@community-essentials.com --count 1               # canary: check it arrives first
 *   node emailLoadTest.js --to you@community-essentials.com --count 200 --minutes 5 # realistic opening rush
 *   node emailLoadTest.js --to you@community-essentials.com --count 200 --minutes 0 # worst case: all at once
 *   node emailLoadTest.js --to you@community-essentials.com --cleanup               # delete the test attendees
 *
 * Cleanup reads COSMOS_CONNECTION_STRING from ../api/local.settings.json.
 */

import { readFileSync } from 'node:fs';
import { CosmosClient } from '@azure/cosmos';

const API = 'https://func-ipelra-xokxr7c5kfc64.azurewebsites.net';
const MAX_CONCURRENT = 50;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const to = String(arg('to', '')).trim().toLowerCase();
if (!/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Pass --to <your real mailbox> (without a "+" part).');
  process.exit(1);
}
const [local, domain] = to.split('@');
const prefix = `${local}+lt-`;

// ── Cleanup ──────────────────────────────────────────────────────────────────
if (arg('cleanup', false)) {
  const conn = JSON.parse(readFileSync(new URL('../api/local.settings.json', import.meta.url))).Values.COSMOS_CONNECTION_STRING;
  const attendees = new CosmosClient(conn).database('ipelra-passport').container('attendees');
  const { resources } = await attendees.items.query({
    query: 'SELECT c.id, c.email FROM c WHERE STARTSWITH(c.email, @prefix)',
    parameters: [{ name: '@prefix', value: prefix }],
  }).fetchAll();
  for (const a of resources) await attendees.item(a.id, a.email).delete();
  console.log(`Deleted ${resources.length} test attendee record(s) starting with "${prefix}".`);
  process.exit(0);
}

// ── Send ─────────────────────────────────────────────────────────────────────
const count   = Math.max(1, Number(arg('count', 1)));
const minutes = Math.max(0, Number(arg('minutes', 5)));
const run     = Date.now().toString(36).slice(-4);
const spacing = minutes > 0 ? (minutes * 60_000) / count : 0;

console.log(`Sending ${count} login email(s) to ${prefix}${run}-NNN@${domain} over ${minutes || 'no'} minute(s)…\n`);

const results = [];
let inFlight = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sendOne(n) {
  const email = `${prefix}${run}-${String(n).padStart(3, '0')}@${domain}`;
  const t0 = performance.now();
  let status, error = '';
  try {
    const res = await fetch(`${API}/api/auth/sendMagicLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    status = res.status;
    if (!res.ok) error = (await res.json().catch(() => ({}))).error ?? '';
  } catch (e) {
    status = 'NETWORK_ERR';
    error = e.message;
  }
  results.push({ n, status, ms: performance.now() - t0, error });
  process.stdout.write(status === 200 ? '.' : 'x');
}

const started = Date.now();
const pending = [];
for (let n = 1; n <= count; n++) {
  while (inFlight >= MAX_CONCURRENT) await sleep(20);
  inFlight++;
  pending.push(sendOne(n).finally(() => inFlight--));
  if (spacing) await sleep(spacing);
}
await Promise.all(pending);

// ── Report ───────────────────────────────────────────────────────────────────
const secs = (Date.now() - started) / 1000;
const times = results.map(r => r.ms).sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))].toFixed(0);
const byStatus = results.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});

console.log(`\n\nDone in ${secs.toFixed(0)}s (~${(count / (secs / 60)).toFixed(0)} emails/min requested)`);
console.log('Statuses:', JSON.stringify(byStatus), '  (200 = accepted for sending, 502 = every mailbox failed, 429 = rate limited)');
console.log(`Response time: median ${pct(0.5)} ms, 95% under ${pct(0.95)} ms, slowest ${pct(1)} ms`);
const errors = [...new Set(results.filter(r => r.error).map(r => `${r.status}: ${r.error}`))];
if (errors.length) console.log('Errors seen:\n  ' + errors.join('\n  '));
console.log(`\nNext: count emails in ${to} (search "lt-${run}") — expect ${byStatus[200] ?? 0}.`);
console.log(`Then clean up: node emailLoadTest.js --to ${to} --cleanup`);
