# IPELRA Conference Passport — Decision Reasoning

**Project:** IPELRA Conference Passport App
**Maintained by:** MGP Technology Solutions

> This file captures the *why* behind every significant design and architecture decision.
> Updated after each session when new decisions are made.

---

## Architecture Decisions

### R-001 — Azure Static Web Apps + Functions + Cosmos DB (not Power Platform)
**Decision:** Use Azure SWA + Functions + Cosmos DB instead of the Power Platform recommendation in the intake form.
**Reasoning:** The scope form suggested Power Platform as a "recommended approach," but the actual requirements (custom magic link auth, fuzzy answer matching, points engine, real-time progress tracking, admin export, year-to-year reset) exceed what Power Platform canvas apps handle cleanly without significant licensing cost and workarounds. The Azure serverless stack delivers a better attendee experience, lower total cost, full code ownership by MGP, and a clean path to reuse in future years.

### R-002 — Cosmos DB Serverless (not Free Tier provisioned)
**Decision:** Use Cosmos DB Serverless mode instead of the Free Tier 1,000 RU/s provisioned mode.
**Reasoning:** Free Tier caps at 1,000 RU/s. If all 160 attendees hit the checkin endpoint simultaneously during a sponsor engagement burst, writes would exceed 1,000 RU/s and trigger 429 throttle responses. The SDK auto-retries but adds latency. Serverless has no RU ceiling — it scales automatically and charges per RU consumed. At this event's scale (~160 users over 2 days), total Cosmos cost in serverless mode will be approximately $0.05–$0.15 for the entire conference. Zero throttling risk for essentially zero additional cost.

### R-003 — ACS Email Pay-As-You-Go (not Free Tier)
**Decision:** Use ACS Email PAYG from day one instead of the Free Tier (100 emails/day).
**Reasoning:** The Free Tier allows 100 emails per day. If 160 attendees all scan the conference QR code and request magic links within the same 20-minute registration window on Monday morning (a realistic scenario), the system would exceed 100 sends and subsequent magic links would fail silently. PAYG pricing is $0.00025/email. Total cost for the entire conference (~160–200 emails including test sends) is approximately $0.04–0.05. The free tier is not worth the risk.

### R-004 — Custom JWT (not SWA Managed Auth for attendees)
**Decision:** Handle attendee auth via custom JWT issued by Functions, stored in localStorage.
**Reasoning:** SWA managed auth is designed for named user accounts (GitHub, AAD, Google). Attendees are anonymous members of the public with no existing account — they're identified only by their email. Magic-link-to-JWT is the standard passwordless pattern for this use case. The JWT carries the attendee's id and email, is signed with a server secret, and expires Oct 10 so they never need to re-authenticate during the conference.

### R-005 — Single JWT Expiry: Oct 10, 2026 (not 24h rolling)
**Decision:** JWT expires on the last day of the passport window rather than rolling 24h.
**Reasoning:** A 24h expiry would require re-authentication every morning. Attendees forget the process, lose access to the app on Day 2, and burden IPELRA support staff. Since the entire conference is 3 days and the passport is locked at Oct 10 anyway, a single long-lived token is the right tradeoff. The security delta is minimal — this is a conference passport, not a bank. The UX improvement is significant.

### R-006 — Google OAuth for Admins (not M365/Entra)
**Decision:** Use Google OAuth for admin login.
**Reasoning:** Discovery doc confirmed IPELRA operates on Google Workspace, not Microsoft 365. M365/Entra login would require accounts they don't have. Google OAuth via SWA's built-in OIDC provider is the natural fit — admins log in with the same Google accounts they use for daily work. No new accounts, no password management.

---

## UX Decisions

### R-007 — Onboarding Screen (3-card swipe, first login only)
**Decision:** Show a brief onboarding flow the first time an attendee logs in.
**Reasoning:** Without context, an attendee who scans the QR code sees an email field with no explanation of what the app does, why they should participate, or what prize they're working toward. In testing analogous experiences, unexplained apps see high immediate abandonment. The 3-card onboarding (what is this / how stops work / how answers work) takes 30 seconds and eliminates confusion at the most critical drop-off point.

### R-008 — Prompt Questions Only (no QR scanning)
**Decision:** Sponsor stops are unlocked by answering a prompt question, not scanning a QR code.
**Reasoning:** Confirmed in the discovery meeting. IPELRA's intent is to force genuine interaction between attendees and sponsors — the sponsor verbally shares the answer during conversation. Drive-by QR scanning (walk up, scan, leave) defeats the purpose. Prompts require engagement.

### R-009 — Stop Confirmed Overlay (+pts flash after correct answer)
**Decision:** Show a brief full-screen animated confirmation ("✓ +100 Points!") after a correct answer before returning to the sponsor list.
**Reasoning:** Without feedback, the user closes the modal and sees a checkmark. That's underwhelming. Gamification research consistently shows that a brief reward moment (0.5–2 seconds) dramatically increases engagement and repeat behavior. This is a trivial frontend addition (no API change needed) with outsized UX impact.

### R-010 — "Almost There" Nudge Banner
**Decision:** Show a prominent banner on Passport Home when the attendee is within 1 sponsor stop of the completion threshold.
**Reasoning:** The "almost done" psychological trigger is one of the strongest drivers of completion in gamified experiences. This is a pure frontend calculation (current points vs. threshold) requiring no API change. It costs nothing to build and demonstrably increases completion rates.

### R-011 — Sponsor Card 4-State Design
**Decision:** Sponsor cards have 4 visual states: Available, Completed, In-Progress, and "Passport Complete."
**Reasoning:** The original plan had 2 states (complete/incomplete). The missing state is "Passport Complete" — when an attendee finishes, remaining uncompleted cards shouldn't look like failures. They should celebrate the completion. Without this, a user who finishes 12 of 13 sponsors sees 1 card that looks like they failed. It should say "Passport Complete! 🎉" instead.

---

## Admin UX Decisions

### R-012 — Attendee Lookup + Manual Credit
**Decision:** Admin portal includes an attendee lookup screen with the ability to manually credit a sponsor stop.
**Reasoning:** On conference day, real problems happen: attendee's phone dies at a sponsor table, app throws an error during submission, sponsor table is too crowded to hear the answer. Without a manual override, the only remedy is "sorry, you can't complete your passport." That's a bad outcome with real consequences (prize eligibility). Manual credit creates an audit trail (`manualCredit: true`, `manualCreditBy`, `manualCreditNote`) so every override is documented.

### R-013 — Flagged Answers Review Screen
**Decision:** Admin portal shows a log of rejected answers grouped by sponsor for review.
**Reasoning:** Sponsors write their own prompt questions, and many will write bad keywords. Example: sponsor says "What is our product called?" Answer keyword set to "CivicSuite Pro" but attendee types "civic suite pro" — rejected by exact match, potentially rejected even by fuzzy match if keyword has unusual formatting. By logging and surfacing rejected answers, admins can identify a bad keyword on Day 1 and fix it before it ruins engagement for Day 2. This is also useful post-conference for improving prompts in Year 2.

### R-014 — Pre-Conference Readiness Checklist in Admin Portal
**Decision:** Build a live readiness checklist as an admin screen rather than just a README checklist.
**Reasoning:** A checklist in a README file requires someone to open a document, understand the steps, and manually verify each item. A live checklist in the admin portal pulls real data (sponsors active count, threshold set, sender domain status, test attendee exists) and shows green/amber/red status per item. It's actionable — each unresolved item links directly to the fix. This is the difference between "I think we're ready" and "the app confirms we are ready."

### R-015 — Metrics Auto-Refresh Every 30 Seconds
**Decision:** Admin metrics dashboard auto-refreshes every 30 seconds with a "last updated" indicator.
**Reasoning:** Admins will be checking metrics on their phones while walking the conference floor. A stale dashboard that requires manual refresh is useless in this context. 30-second auto-refresh keeps data current without hammering the API. The "last updated X seconds ago" indicator tells the admin exactly how fresh the data is.

---

## Infrastructure Decisions

### R-016 — Warmup Timer Trigger (Oct 5–7 Only)
**Decision:** A timer trigger function runs every 10 minutes during conference hours (Oct 5–7, 6AM–6PM CT / 11:00–23:00 UTC) to prevent cold starts.
**Reasoning:** Azure Functions Consumption plan cold starts typically add 1–3 seconds to the first invocation after an idle period. If the first sponsor check-in wave hits cold Functions at 9am Monday, 40 attendees simultaneously experience a 2-3 second delay. The warmup timer is a simple, low-cost solution (timer triggers are free) that eliminates this risk by keeping the Function host and Cosmos connection warm during business hours.

### R-017 — Passport Lock at 2026-10-11T00:00:00Z UTC
**Decision:** The passport locks at midnight UTC on October 11, not midnight CT on October 10.
**Reasoning:** The stated requirement is "passport locks after October 10." October 10 ends at midnight in every timezone. In Central Time (UTC-5), midnight Oct 10/11 CT = 05:00 UTC Oct 11. Locking at 2026-10-11T00:00:00Z (midnight UTC) means the passport closes at 7pm CT on Oct 10 — earlier than IPELRA expects but acceptable since the conference ends Wednesday noon. This is explicitly documented so there is no ambiguity. Server-side check always uses UTC to prevent client clock manipulation.

### R-018 — isActive Default: false for All Sponsors
**Decision:** All sponsor records default to `isActive: false`. Admin must explicitly activate each sponsor.
**Reasoning:** Sponsors are loaded incrementally as content is received from IPELRA. If `isActive` defaulted to `true`, partially configured sponsors (missing logo, missing prompt) would appear to attendees before they're ready. The default-off gate ensures only fully configured and reviewed sponsors are visible. It also gives IPELRA control over the go-live sequence — they can load all sponsors and activate them all at once on the morning of Oct 5.

### R-019 — conferenceYear Field on All Records
**Decision:** All `attendees` and `checkins` documents include a `conferenceYear` field.
**Reasoning:** The app is designed to be reused year-to-year. Without a year tag, resetting the app for 2027 requires deleting all 2026 data — destroying valuable post-conference analytics. With `conferenceYear: 2026` on every record, the reset operation archives old records (filtered by year) rather than deleting them, and new records start fresh for 2027. This makes the year-to-year transition a clean, safe, reversible operation.

### R-020 — Emergency Export Token Endpoint
**Decision:** A second export endpoint (`GET /api/admin/exportToken`) bypasses Google OAuth and instead validates an `x-export-secret` header against the `EXPORT_SECRET` env var.
**Reasoning:** If Google OAuth fails on conference day (Google outage, admin uses wrong account, browser blocks cookies), IPELRA cannot access the CSV export — which they need for the prize drawing. The emergency token endpoint provides a backup path that works from any browser or curl command. The secret is a long random string stored in app settings; it's documented in the README with instructions for IPELRA. Acceptable security tradeoff for a conference passport app.

---

## Scope Decisions

### R-021 — Optional Name Collection at Login
**Decision:** Add optional firstName/lastName fields to the login screen.
**Reasoning:** Magic link auth only provides an email address. For the prize drawing, IPELRA needs to identify winners by name, not just email address. "The winner is angie@ipelra.org" is awkward. Making name collection optional (not required) preserves low-friction login for attendees who don't want to share their name while still capturing names for attendees who do. The export CSV includes name + email + completedAt.

### R-022 — Completion Email (Congratulations)
**Decision:** When an attendee hits the completion threshold, automatically send a congratulations email via ACS.
**Reasoning:** The completed passport screen is ephemeral — the attendee sees it on their phone and then closes the app. If they lose their phone or clear the browser, they have no proof they completed. A congratulations email creates a permanent record for the attendee, reduces "I completed it but you can't find me" disputes at the prize table, and adds a professional polish to the experience. Cost: ~$0.00025 per email (effectively free). Code delta: ~20 lines in the checkin function.

### R-024 — SWA Free + Separate Azure Functions Consumption (not SWA Standard with Linked Backend)
**Decision:** Use Azure Static Web Apps Free tier for the React frontend only. Deploy Azure Functions as a separate Consumption Plan resource. React calls the Functions URL directly via CORS. Do NOT use SWA Standard tier with linked backend.
**Reasoning:** SWA Standard tier is required to link an external Azure Function App backend (the "Bring Your Own Functions" feature). SWA Standard costs $9/month. From project start (April 27, 2026) through the end of the conference (October 10, 2026) that is ~5.5 months = ~$49.50 in SWA Standard cost alone. The SWA Free + separate Functions approach achieves the identical result: React frontend on the SWA origin, API calls to the Functions origin with CORS allowed. Functions Consumption billing is ~$0 (first 1M executions free, well within our scale). The only tradeoff is that `/api/*` is not automatically proxied through SWA — the React app uses a `VITE_API_BASE_URL` env var to target the Functions endpoint directly. This is entirely standard and requires no workarounds.

### R-023 — QR-per-Sponsor Built but Hidden (Year 1)
**Decision:** Build the QR code generation infrastructure in the admin portal but disable/hide it in Year 1 with a "Coming in Year 2" label.
**Reasoning:** The original scope included unique QR codes per sponsor for table display, but the discovery meeting confirmed prompts-only for Year 1. However, QR generation is a standard feature that sponsors will likely request in Year 2 (hybrid model: scan QR + answer prompt). Building the foundation now (storing a `qrCodeUrl` field in the sponsor model, wiring up a QR generation library) costs minimal effort and avoids a breaking schema change next year. It's hidden in the UI so it doesn't confuse Year 1 admins.
