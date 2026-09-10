/**
 * seedSponsors.js — Upserts the 3 example sponsors into Cosmos DB.
 *
 * Usage (from the scripts/ directory):
 *   npm install
 *   node seedSponsors.js
 *
 * Connection string resolution order:
 *   1. COSMOS_CONNECTION_STRING environment variable
 *   2. ../api/local.settings.json  (Values.COSMOS_CONNECTION_STRING)
 *
 * Idempotent — uses fixed IDs (seed-sponsor-001..003) so re-runs
 * update rather than duplicate. All sponsors seeded with isActive=false;
 * an admin must explicitly activate each one in the admin portal.
 */

import { CosmosClient } from '@azure/cosmos';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Resolve connection string ─────────────────────────────────────────────────

let connStr = process.env.COSMOS_CONNECTION_STRING;

if (!connStr) {
  const settingsPath = resolve(__dirname, '../api/local.settings.json');
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      connStr = settings?.Values?.COSMOS_CONNECTION_STRING;
    } catch {
      // parse error — fall through to the error below
    }
  }
}

if (!connStr || connStr.includes('<your-account>')) {
  console.error(
    '\n❌  COSMOS_CONNECTION_STRING not configured.\n' +
    '    Options:\n' +
    '      a) Set COSMOS_CONNECTION_STRING as an environment variable, or\n' +
    '      b) Copy api/local.settings.json.example → api/local.settings.json\n' +
    '         and fill in the real connection string.\n'
  );
  process.exit(1);
}

// ── Cosmos client ─────────────────────────────────────────────────────────────

const client    = new CosmosClient(connStr);
const container = client.database('ipelra-passport').container('sponsors');

// ── Seed data (matches plan §"Seed Data") ────────────────────────────────────

const now = new Date().toISOString();

const SPONSORS = [
  {
    id:                   'seed-sponsor-001',
    name:                 'CityTech Solutions',
    logoUrl:              null,
    tagline:              'Smart technology for modern municipalities.',
    description:          'CityTech Solutions builds enterprise software tailored for city and county governments—from permitting platforms to constituent engagement portals. Stop by to learn about our newest AI-powered workflow tools.',
    website:              'https://citytech.example.com',
    tier:                 'partnership',
    pointValue:           100,
    promptQuestion:       'What does CityTech specialize in?',
    promptAnswerKeyword:  'municipal technology',
    isActive:             false,
    displayOrder:         10,
    createdAt:            now,
  },
  {
    id:                   'seed-sponsor-002',
    name:                 'SecureGov Inc',
    logoUrl:              null,
    tagline:              'Identity and access management for government.',
    description:          'SecureGov delivers zero-trust identity solutions purpose-built for public-sector compliance. Our platform meets FedRAMP, CJIS, and HIPAA requirements out of the box. Visit our table for a live demo.',
    website:              'https://securegov.example.com',
    tier:                 'leadership',
    pointValue:           150,
    promptQuestion:       'Name one product SecureGov offers.',
    promptAnswerKeyword:  'identity management',
    isActive:             false,
    displayOrder:         20,
    createdAt:            now,
  },
  {
    id:                   'seed-sponsor-003',
    name:                 'DataBridge Partners',
    logoUrl:              null,
    tagline:              'Connecting local governments with data-driven insights.',
    description:          'DataBridge Partners integrates siloed legacy systems into a unified data lakehouse—giving analysts real-time dashboards without the usual migration headaches. Ask us about our 90-day pilot program.',
    website:              'https://databridge.example.com',
    tier:                 'partnership',
    pointValue:           100,
    promptQuestion:       'What industry does DataBridge serve?',
    promptAnswerKeyword:  'local government',
    isActive:             false,
    displayOrder:         30,
    createdAt:            now,
  },
];

// ── Upsert ────────────────────────────────────────────────────────────────────

console.log('\n🌱  Seeding example sponsors into Cosmos DB...\n');

for (const sponsor of SPONSORS) {
  try {
    const { resource } = await container.items.upsert(sponsor);
    const tier  = resource.tier.padEnd(8);
    const pts   = String(resource.pointValue).padStart(3);
    console.log(`  ✅  [${tier}  ${pts} pts]  ${resource.name}  (id: ${resource.id})`);
  } catch (err) {
    console.error(`\n  ❌  Failed to upsert "${sponsor.name}":\n      ${err.message}\n`);
    process.exit(1);
  }
}

console.log(
  '\n✅  Seed complete.\n' +
  '    All 3 sponsors are inactive by default (isActive=false).\n' +
  '    Activate them individually in the admin portal → Sponsor List.\n'
);
