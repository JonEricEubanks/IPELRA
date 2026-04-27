// ============================================================
// main.bicepparam — IPELRA Conference Passport
// Fill in ALL values marked ⚠️ REQUIRED before deploying.
// ⛔ DO NOT commit real secrets to source control.
// ============================================================

using './main.bicep'

// ── Infrastructure ────────────────────────────────────────────
param location = 'eastus2'
param projectTag = 'ipelra-passport'
param envTag = 'mvp'

// ── Secrets — REQUIRED ⚠️ ─────────────────────────────────────
// Recommended: pass these via environment variables at deploy time
// rather than editing this file. See README > Deployment.
//
// Example deploy command:
//   az deployment group create \
//     --resource-group conferenceapp \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam \
//     --parameters jwtSecret=$JWT_SECRET \
//                  adminEmails=$ADMIN_EMAILS \
//                  exportSecret=$EXPORT_SECRET

// JWT_SECRET: Random string, minimum 32 characters.
// Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
param jwtSecret = ''  // ⚠️ REQUIRED — do not leave blank on deploy

// ADMIN_EMAILS: Comma-separated Google Workspace email addresses.
// These are the EXACT Google accounts admin users will log in with.
// Example: 'admin@yourorganization.gov,staff@ipelra.org'
param adminEmails = ''  // ⚠️ REQUIRED — get from IPELRA before go-live

// EXPORT_SECRET: Long random string for emergency CSV export endpoint.
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
param exportSecret = ''  // ⚠️ REQUIRED — store in a safe place (password manager)

// ── Conference Configuration ──────────────────────────────────

// Points required to complete the passport.
// ⚠️ MUST BE UPDATED after IPELRA confirms final sponsor count and tier mix.
// Formula: (# Gold sponsors × 100) + (# Platinum sponsors × 150) × 0.80
// Example with 10 Gold + 3 Platinum: (1000 + 450) × 0.80 = 1160
// For now, 1000 is the placeholder — safe to deploy with this value.
param completionThresholdPoints = '1000'

// Set to 'false' until the morning of October 5, 2026.
// Flip to 'true' via: az functionapp config appsettings set
//   --resource-group conferenceapp --name <func-name>
//   --settings PASSPORT_LIVE=true
param passportLive = 'false'

// Passport lock time: midnight UTC on Oct 11 = 7:00 PM Central Oct 10.
// Do NOT change this unless explicitly discussed with IPELRA.
param passportLockUtc = '2026-10-11T00:00:00Z'

// Conference year — used for data partitioning and year-to-year archive.
param conferenceYear = '2026'
