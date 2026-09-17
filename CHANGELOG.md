# IPELRA Conference Passport — Change Log

**Project:** MGP Technology Solutions
**Maintained by:** MGP Technology Solutions

> Updated after every implementation session. Records what was built, changed, or removed.

---

## [2026-09-16] — Answer-attempt messaging, table nudges, and sponsor content checks

From a second round of tester feedback on the Workday question.

### Changed

- **Wrong-answer messaging no longer implies a lockout** (`api/src/functions/checkin.js`). Attempts were always unlimited by design, but the copy said "N attempt(s) remaining", so testers expected to be cut off. Messages now count down to the *hint* ("2 more tries before we show a hint") and every one names the sponsor table as the real path to the answer. Response gains `triesUntilHint`.
- **Escalating "go to the table" nudge** in `SponsorSheet` — neutral after miss 1, orange "walk over there" after miss 2, "skip the guessing, head to the table — that's the whole point" after miss 3+.
- **Website link removed from the question screen** — testers left the app to look up the answer and couldn't find their way back. The link stays on the sponsor profile screen, labelled "opens in a new tab — switch back here to answer".
- **Sponsor edit page** (`AdminSponsorEditPage.jsx`) is now where the Dashboard's **Fix** / **Review** buttons land, and it explains why: a banner names the problem, the offending field is outlined orange with an inline reason, and a **"Wrong answers attendees typed here"** panel shows every rejected guess (tallied), coloured green/red against the *current* keyword so staff can see whether loosening the keyword would help. Tapping a chip runs it through the fuzzy tester. `?from=attention` makes Back return to the Dashboard. Labels now bound to inputs; the local fuzzy tester matches the server rules exactly (ceil tolerance + all-words rule); the stale "Max 3 attempts" hint text is gone.

### Added

- `api/src/lib/sponsorContent.js` (+ client twin `app/src/lib/sponsorContent.js`) — flags template text left in active sponsor copy: `[Company Name]`-style brackets, `{{braces}}`, "company name", TODO/TBD, lorem ipsum, and questions with no `?`. Surfaced in `GET /api/mgmt/metrics` as `contentIssues` → Dashboard **Needs attention** card, and as a `sponsor_content` readiness check. On first run it caught **two** live sponsors (Workday and "test") with `[Company Name]` still in their question.
- `adminGetSponsorWrongAnswers()` client helper over the existing `/api/mgmt/flagged` endpoint.

### Tests

- New `sponsorContent.test.js` (4), `AdminSponsorEditPage.test.jsx` (4); extended `checkin.test.js` (4th attempt still allowed, no "remaining" wording), `adminMetrics.test.js` (active-only content issues), `SponsorSheet.test.jsx` (escalating nudge, no website in question phase), `AdminDashboardPage.test.jsx` (Fix link). Totals: 67 frontend, 73 backend.

---

## [2026-09-16] — Staff portal redesign: 8 tabs → 4, analytics dashboard, bug fixes

Driven by a co-review of the admin area against what conference staff actually need on the day: **numbers at a glance and clean exports**. Developer/deployment tooling that had leaked into the staff UI was folded away or removed.

### Changed

- **Navigation collapsed to four tabs** (`app/src/components/AdminLayout.jsx`): Dashboard · Attendees · Sponsors · Export. Desktop now gets a proper dark sidebar; mobile gets a 4-item bottom bar. Old routes `/admin/flagged`, `/admin/readiness`, `/admin/settings`, `/admin/reset` redirect to the tab that now holds their content (`app/src/App.jsx`).
- **Dashboard rebuilt** (`app/src/pages/AdminDashboardPage.jsx`): hero row (Registered with real "have started" count · Completed with % ring · Check-ins today · Almost there), live/closed/not-open status pill, hourly check-in activity chart (last 3 days), sponsor ranking across *all* active sponsors with **No visits** and **N stuck** badges, "how far along is the room" stops funnel, live check-in feed, recent completions, and a **Needs attention** card that only appears when attendees have burned all 3 attempts at a table. 30s auto-refresh with a stale-data warning on failure.
- **Attendees rebuilt** (`app/src/pages/AdminAttendeePage.jsx`): roster loads immediately; type-to-search plus status chips with live counts; click any row for a side drawer with points/stops/status, check-in history, and **manual credit via a sponsor dropdown** (only active sponsors the attendee hasn't collected are offered).
- **Sponsors** (`app/src/pages/AdminSponsorsPage.jsx`): per-sponsor check-in count and stuck badge inline; tier shown under the name; empty state; action buttons no longer break the table row layout.
- **Export rebuilt** (`app/src/pages/AdminExportPage.jsx`): three honest, purpose-named Excel downloads — **Prize drawing list** (completed only, numbered in finish order), **Full attendee roster**, **Sponsor report** (check-ins + % of attendees per table). **System status** (the readiness checks) and **Reset for next year** live here as collapsed sections.
- **`GET /api/mgmt/metrics` extended** (`api/src/functions/adminMetrics.js`) — one endpoint now returns everything the dashboard needs, all derived from existing documents: real `activeAttendees`, `checkinsToday` (conference-local day), `almostThere`, `manualCredits`, `passport` status block, zero-filled `hourly` buckets, `sponsors` rollup incl. zero-visit and stuck counts, `funnel`, `recentCheckins`, `needsAttention`. New `adminMetrics.test.js` (9 tests).

### Fixed

- Desktop admin sidebar was `display:none` with no CSS rule to ever show it — staff on a laptop were navigating with a 10px-label mobile bottom bar.
- "Active" stat was faked as equal to "Registered" (`api.js` set `activeAttendees = registeredAttendees`); now counts attendees with ≥1 stamp.
- Settings page read fields the readiness API never returned, so Passport Live showed "Unknown" and threshold "—". Page removed; live status now shows on the Dashboard header, threshold in the funnel caption.
- CSV and Excel exports silently returned different populations (completed-only vs everyone) with near-identical labels.
- Attendee roster required clicking "Load" before showing anything.
- Manual credit required pasting a raw sponsor UUID.
- Attendee check-in history read `c.points` / `c.isManual`, which don't exist on check-in docs (now `pointsAwarded` / `manualCredit`).
- `adminManualCredit()` read `data.attendee.totalPoints` (never present) so the success toast always said 0 pts; `adminResetConference()` and `adminManualCredit()` now surface server errors instead of swallowing them.

### Removed

- `AdminFlaggedPage`, `AdminReadinessPage`, `AdminSettingsPage`, `AdminResetPage` and the `adminGetFlagged` / `adminExportCsv` client helpers. (Backend `GET /api/mgmt/flagged` and the `x-export-secret` CSV endpoint are untouched.)

### Tests

- `src/test/setup.js` stubs `window.matchMedia` so pages using `react-hot-toast` render under jsdom.
- New: `AdminDashboardPage.test.jsx` (6), `AdminAttendeePage.test.jsx` (3), `adminMetrics.test.js` (9). Totals: 60 frontend, 68 backend.

---

## [2026-09-16] — Post-testing fixes: magic-link delivery, email logo, completion loop, QR scanning

### Fixed

- **Magic links now tolerate slow/batching corporate mail servers** (`api/src/functions/sendMagicLink.js`, `api/src/functions/verifyToken.js`) — an attendee's Cosmos record now keeps a short list of unexpired pending magic-link tokens instead of a single token that got silently overwritten (and thus invalidated) by every new "send link" request. Any outstanding link now works; a successful login invalidates all of them at once.
- **Email logo restored** (`api/src/lib/email.js`) — the magic-link, completion, and admin-login emails pointed at `https://ipelra.org/wp-content/uploads/.../ipelra-logo.png`, which now 404s (the domain has been repurposed). Emails now use the app's own hosted `/logo-text.png`.
- **"View My Passport" no longer loops back to the celebration screen** (`app/src/pages/CompletedPage.jsx`, `app/src/pages/PassportHomePage.jsx`) — the home route unconditionally redirected completed attendees to `/completed`. It now shows the passport dashboard once the celebration screen has been seen.
- **Scanning a sponsor's QR code no longer auto-awards points** (`api/src/functions/checkin.js`, `app/src/pages/ScanPage.jsx`, `app/src/components/SponsorSheet.jsx`) — this had drifted from the original discovery-meeting decision (prompt questions only, to force genuine attendee/sponsor interaction). `POST /api/checkin` now only accepts `{ sponsorId, answer }`; the QR-code bypass path is removed. A scan (printed table QR or in-app scanner) now just deep-links to that sponsor's prompt question — same as tapping the sponsor card — and the attendee must still answer correctly to earn the stamp. `SponsorSheet` gained an `initialPhase` prop so `ScanPage` can open straight to the question; its "scan to unlock instantly" shortcut button was removed since it no longer applied.
- **First-time QR scanners now see onboarding before the sponsor question** (`app/src/pages/VerifyPage.jsx`, `app/src/pages/OnboardingPage.jsx`) — previously, a brand-new attendee who scanned a sponsor's QR as their very first interaction skipped the 3-card "what is this passport" intro entirely, landing straight on a sponsor's question with zero context. `VerifyPage` now sends never-onboarded attendees to `/onboarding` first (re-saving the pending scan so it survives the detour); `OnboardingPage` resumes straight to the sponsor's question once the intro is finished or skipped. Returning attendees still resume immediately, unchanged.

---

## [2026-04-27] — Phase 9 & 10: SWA Config + README (Complete)

### Added

- `app/staticwebapp.config.json` — Complete Azure Static Web App configuration: Google OAuth only (GitHub/Twitter/AAD explicitly blocked); `/admin` and `/admin/*` require `authenticated` role; 401 auto-redirects to Google login with `post_login_redirect_uri=/admin`; SPA `navigationFallback` to `/index.html`; `404` response override rewrites to `/index.html` (handles deep links); `/assets/*` cached 1yr immutable; `/logos/*` cached 1 day; `globalHeaders` with X-Content-Type-Options, X-Frame-Options DENY, X-XSS-Protection, Referrer-Policy, Permissions-Policy; `auth.identityProviders.google` referencing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` app settings

- `README.md` — Comprehensive project documentation: architecture diagram + cost table; prerequisites; local dev setup (two-terminal: `func start` + `npm run dev`); full environment variables reference table with all 11 API vars and 3 SWA vars; step-by-step first deploy walkthrough (Bicep, Functions, React build, SWA deploy); post-deploy steps (CORS, Google OAuth config, ACS domain verification, admin login test, magic link test); **pre-conference checklist** (infrastructure, sponsors, access, app, monitoring); day-of runbook (open passport, monitor, incident responses, end-of-conference export); troubleshooting section (6 common issues); open items tracking table (G1–G4)

---

## [2026-04-27] — Phase 7: Admin Portal (Complete)

### Added

- `app/src/pages/AdminSettingsPage.jsx` — Reads current runtime configuration via the readiness endpoint; displays each check with status badge; documents `az functionapp config appsettings set` commands for `COMPLETION_THRESHOLD_POINTS`, `PASSPORT_LIVE`, and `CONFERENCE_YEAR`; quick-links to Readiness, Reset, and Export pages
- `app/src/pages/AdminResetPage.jsx` — Danger-zone archive page; requires typing `RESET-<year>` token exactly; calls `adminResetConference(confirmToken)` via POST `/api/admin/resetConference`; shows archived attendee + check-in counts on success; inline "Export first" CTA

### Changed

- `app/src/App.jsx` — Added imports for `AdminSettingsPage` and `AdminResetPage`; added routes `/admin/settings` and `/admin/reset`
- `app/src/api.js` — Fixed `adminExportCsv()`: was returning raw `Response` object; now returns `res.blob()` so `URL.createObjectURL()` works correctly in the export page
- `app/src/pages/AdminExportPage.jsx` — Removed broken reset section (used non-existent `adminReset` export and wrong confirmation model); removed `adminReset` import; page now handles CSV export only; added link card pointing to `/admin/reset`
- `app/src/pages/AdminSponsorEditPage.jsx` — Removed duplicate `export default function AdminSponsorEditPage()` block (old wrong-field version, lines 294–end); correct implementation with `tier/tagline/logoUrl/pointValue/promptQuestion/promptAnswerKeyword/displayOrder/isActive` and live fuzzy-match tester is now the sole export

---



## [2026-04-27] — Phase 6: React Frontend (Complete)

### Added

**Foundation (previously completed this session):**
- `app/package.json` — React 18, Vite 5, React Router v6, project metadata
- `app/vite.config.js` — dev proxy `/api → localhost:7071`, build output to `dist/`
- `app/index.html` — root HTML shell with viewport meta, theme-color, app title
- `app/src/api.js` — centralized fetch client; auto-clears token on 401/403; exports all attendee + admin API calls
- `app/src/context/AuthContext.jsx` — JWT + attendee profile state; localStorage with sessionStorage fallback for iOS Safari private mode
- `app/src/main.jsx` — React entry point
- `app/src/App.jsx` — BrowserRouter with all 17 routes; `RequireAuth` guard for attendee-protected pages
- `app/src/index.css` — complete design system: CSS tokens (Soft Aurora + IPELRA blue `#0077cc`), reset, buttons, forms, progress bar with shimmer, 4-state sponsor cards, points-flash animation, confetti keyframe, overlay pop-in, skeleton shimmer, admin stat grid, admin tables, responsive sidebar/bottom-nav breakpoints

**Attendee pages:**
- `app/src/pages/LoginPage.jsx` — email + optional name form; sent-confirmation state; 429 → "not open yet" message
- `app/src/pages/VerifyPage.jsx` — token exchange; routes first-time users to `/onboarding`, returning users to `/`; 401 → `/link-expired`
- `app/src/pages/OnboardingPage.jsx` — 3-card swipe (what is the passport / sponsor stops / prizes); animated step dots; "Skip intro"; sets `passport_onboarded` localStorage flag
- `app/src/pages/PassportHomePage.jsx` — header with points badge + animated progress bar; almost-there banner (≥80% threshold); sponsor card grid (4 states: available/done/locked/passport-complete); skeleton loading; `getSponsors()` + `getProgress()` on mount; bottom nav
- `app/src/pages/SponsorStopPage.jsx` — sponsor question display; answer input; attempt counter; hint revealed after 3 failures; success overlay with `+pts` float animation; navigates back to `/`
- `app/src/pages/CompletedPage.jsx` — 20-piece CSS confetti; completion timestamp; prize station instructions; guards redirect if `completed=false`
- `app/src/pages/LinkExpiredPage.jsx` — expired magic link state; re-request CTA back to `/login`
- `app/src/pages/OfflinePage.jsx` — listens to `online`/`offline` events; auto-redirects when connection restored; shows IPELRA2026 Wi-Fi network name
- `app/src/pages/HelpPage.jsx` — 7-item accordion FAQ; blue lanyard staff callout; shared bottom nav

**Admin pages:**
- `app/src/components/AdminLayout.jsx` — shared wrapper: top bar with sign-out, desktop sidebar (≥768px), mobile bottom nav (6 items)
- `app/src/pages/AdminLoginPage.jsx` — standalone Google OAuth entry via `/.auth/login/google?post_login_redirect_uri=/admin`; shows current user if already signed in
- `app/src/pages/AdminDashboardPage.jsx` — 6-stat grid (registered/active/completed/completion%/check-ins/active sponsors); top sponsors table; recent completions table; 30-second auto-refresh via `setInterval`
- `app/src/pages/AdminSponsorsPage.jsx` — sponsor list table with inline isActive toggle; links to edit/new
- `app/src/pages/AdminSponsorEditPage.jsx` — create (`/admin/sponsors/new`) and edit (`/admin/sponsors/:id`) form; all fields: name, description, question, answer, hint, points, tableLocation, website, isActive checkbox
- `app/src/pages/AdminAttendeePage.jsx` — email/name search; attendee detail with check-in history table (flags manual credits); manual credit form (sponsorId + optional note)
- `app/src/pages/AdminFlaggedPage.jsx` — failed answers grouped by sponsor; fail-count badge + last-attempt timestamp
- `app/src/pages/AdminExportPage.jsx` — CSV download (triggers browser save); emergency reset section with double confirmation (secret key + type "DELETE ALL DATA")
- `app/src/pages/AdminReadinessPage.jsx` — live checklist from `/api/admin/readiness`; sponsor count / threshold / email config summary cards; manual refresh button

### Changed
- `app/src/api.js` — added `adminReset(secret)` export; fixed `adminExportCsv()` to return `res.blob()` instead of raw response
- `app/src/App.jsx` — fixed admin import paths to `./pages/Admin*.jsx`; moved Dashboard to `/admin`, moved standalone login to `/admin/login`
- `app/src/index.css` — added `.stat-grid`, `.stat-card`, `.stat-value`, `.stat-label`, `.admin-table-wrap`, `.admin-table`, `.admin-sidebar` / `.admin-bottom-nav` responsive classes; added `-webkit-user-select`, `-webkit-backdrop-filter` Safari vendor prefixes; removed bare `text-size-adjust` (keep only `-webkit-text-size-adjust`)

### Notes
- Design palette: **Soft Aurora** adapted with IPELRA brand blue (`#0077cc`). Chosen over Neon Dark for professional conference context.
- All inputs use `font-size: 16px` minimum — prevents iOS Safari auto-zoom on focus.
- `100dvh` + `env(safe-area-inset-*)` used throughout for notched iPhone compatibility.
- `prefers-reduced-motion` respected — all keyframe animations set to `0.01ms` duration.
- Phase 7 (seed script) and Phase 8 (staticwebapp.config.json) were handled by parallel agents this session.

---

## [2026-04-27] — Phase 8: Seed Script

### Added
- `scripts/package.json` — ESM package manifest for dev/admin scripts; declares `@azure/cosmos` dependency
- `scripts/seedSponsors.js` — Idempotent sponsor seed script. Upserts 3 example sponsors (CityTech Solutions / Gold, SecureGov Inc / Platinum, DataBridge Partners / Gold) using fixed IDs (`seed-sponsor-001..003`). Loads `COSMOS_CONNECTION_STRING` from env var or `api/local.settings.json` automatically. All sponsors seeded with `isActive=false`; admin must activate each one in the portal.

### Notes
- Fixed IDs ensure re-runs update rather than duplicate
- Run from `scripts/` directory: `npm install && node seedSponsors.js`

---

## [2026-04-27] — Project Kickoff & Planning

### Added
- `PLAN.md` — full project plan including architecture, data model, screen inventory, API surface, cost estimate, build phases, and open items
- `ERRORS.md` — error log template (empty, ready to receive entries)
- `CHANGELOG.md` — this file
- `REASONING.md` — decision rationale document

### Decisions Finalized
- Architecture: Azure Static Web Apps (Free) + Functions (Consumption) + Cosmos DB (Serverless) + ACS Email (PAYG) + App Insights
- Auth: Magic link JWT (exp Oct 10 2026) for attendees; Google OAuth via SWA for admins
- Unlock method: Prompt questions only (no QR scanning)
- Cosmos mode: Serverless (replaces Free tier provisioned — no RU ceiling, handles burst)
- ACS: Pay-as-you-go from day one (100/day free tier insufficient for 160-attendee registration rush)
- Session lifetime: Single auth for entire conference (JWT expires Oct 10, 2026)
- Completion rule: Points threshold via `COMPLETION_THRESHOLD_POINTS` env var (tunable without redeploy)
- Answer matching: Fuzzy (keyword containment + Levenshtein ≤ 30%), 3 attempts, hint after 3 fails
- Passport lock: `2026-10-11T00:00:00Z` UTC (midnight UTC = 7pm Oct 10 CT)
- Logo hosting: URL field in Cosmos + `/public/logos/` folder in repo; null → placeholder
- Attendee name: Optional firstName/lastName collected at login; in export CSV + completion screen
- Completion verification: Export CSV only; completed screen shows email + timestamp
- Soft launch: `PASSPORT_LIVE` env var toggle
- Year-to-year: `conferenceYear` field on all records + `/api/admin/resetConference` endpoint
- 26 total screens: 14 attendee (including onboarding, stop confirmation, link expired, help/FAQ, offline error) + 12 admin (including readiness checklist, attendee lookup, manual credit, flagged answers)

### Open Items Identified
- G1: ACS verified sender domain + SPF/DKIM (MGP action)
- G2: Google OAuth Client ID (post-deploy step — requires live SWA URL)
- G3: Final sponsor count/tier mix → COMPLETION_THRESHOLD_POINTS value (IPELRA action)
- G4: Admin Google email addresses (Angie Miller / IPELRA action)

---

## [2026-04-27] — Phase 1: Bicep Infrastructure

### Added
- `infra/modules/appInsights.bicep` — Log Analytics workspace + workspace-based Application Insights component
- `infra/modules/cosmosDb.bicep` — Cosmos DB Serverless account + `ipelra-passport` database + 3 containers (`sponsors`, `attendees`, `checkins`). Unique key `/sponsorId` on checkins partition prevents duplicate check-ins per attendee per sponsor.
- `infra/modules/communicationServices.bicep` — ACS Communication Service + Email Service + Azure Managed Domain. Domain linked to ACS on deploy. Outputs connection string and sender domain for Function App auto-configuration.
- `infra/modules/staticWebApp.bicep` — SWA Free tier (frontend only). Outputs auto-generated hostname for post-deploy CORS configuration.
- `infra/modules/functionApp.bicep` — Storage account (LRS) + App Service Plan (Y1 Windows Consumption) + Function App with Node.js v4. All 17 app settings pre-wired. CORS allows localhost origins for local dev; production SWA origin added post-deploy.
- `infra/main.bicep` — Orchestrator module. Deploys all 5 modules in dependency order. Auto-computes `ACS_SENDER_ADDRESS` from managed domain output. Outputs SWA URL, Function App URL, and post-deploy CORS reminder command.
- `infra/main.bicepparam` — Parameter template with complete documentation for each value. Secure params (jwtSecret, adminEmails, exportSecret) intentionally left blank with deploy-time instructions.

### Architecture Finalized
- SWA Free + separate Functions Consumption (not SWA Standard with linked backend) — cost savings $9/month, see R-024 in REASONING.md
- Unique suffix via `uniqueString(resourceGroup().id)` for globally unique resource names (Function App, Storage, Cosmos)
- ACS sender address auto-configured from Azure Managed Domain at deploy time (override after custom domain setup)
- Windows Consumption Y1 plan for Functions (Node.js v4 on Windows) — avoids Linux WEBSITE_CONTENTSHARE differences

---

## Change Entry Format

```
## [YYYY-MM-DD] — [Session description]

### Added
- [new files / features]

### Changed
- [modifications to existing files/logic]

### Fixed
- [bug fixes — reference ERRORS.md entry if applicable]

### Removed
- [deleted files or deprecated features]

### Notes
- [any context, decisions made, or items deferred]
```
