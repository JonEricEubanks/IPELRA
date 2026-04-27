# IPELRA Conference Passport — Project Plan

**Project:** IPELRA Conference Passport App
**Client:** IPELRA | Contact: Angie Miller
**Developer:** MGP Technology Solutions
**Plan Created:** 2026-04-27
**Last Updated:** 2026-04-27 (Phase 1 complete)

---

## Project Summary

A mobile-friendly web-based "conference passport" app for IPELRA's annual conference (Oct 5–7, 2026, Eagle Ridge Resort, Galena IL). ~160 attendees complete sponsor stops by answering prompt questions at sponsor tables, earn points, and receive a "Completed Passport" confirmation for prize entry. IPELRA admins manage sponsors, monitor live metrics, and export a raffle list. Hosted on Azure using free/consumption tiers. Total Azure cost: ~$0.31 from project start through Oct 10, 2026.

---

## Target Environment

| Setting | Value |
|---|---|
| Azure Subscription | Microsoft Azure Sponsorship |
| Subscription ID | b8f90e47-b8ee-45f1-9442-d3b4f8fd0695 |
| Resource Group | conferenceapp (existing — do not create new) |
| Region | East US 2 |
| Directory | Spark by MGP (Community-Essentials.com) |

---

## Architecture

### Service Map

```
Attendee (mobile browser)
  └─→ Azure Static Web App (Free tier) — React/Vite SPA
        └─→ Azure Functions (Consumption, Node.js v4) — all API logic
              ├─→ Cosmos DB Serverless (NoSQL) — sponsors / attendees / checkins
              ├─→ ACS Email (PAYG)             — magic link + completion emails
              └─→ Application Insights (Free)  — monitoring + metrics

Admin (laptop/phone)
  └─→ Same Static Web App /admin
        └─→ Google OAuth (SWA built-in OIDC)
              └─→ Same Functions (/api/admin/*)
                    └─→ Same Cosmos DB
```

### Auth Strategy

**Attendees — Magic Link Flow**
1. Enter email (+ optional name) → POST `/api/auth/sendMagicLink`
2. Token generated (UUID v4), hashed with SHA-256, stored in Cosmos `attendees` doc with 15-min expiry
3. ACS Email sends link: `https://<app>/verify?token=<raw-uuid>`
4. GET `/api/auth/verify?token=` — validates hash, invalidates token (single-use), issues session JWT
5. JWT signed with `JWT_SECRET`, expires `2026-10-10T23:59:59Z` (single auth for entire conference)
6. JWT stored in `localStorage` with cookie fallback for iOS Safari private mode

**Admins — Google OAuth**
- SWA built-in Google OIDC provider
- Backend validates `x-ms-client-principal` header + email against `ADMIN_EMAILS` env var
- All `/api/admin/*` routes blocked by SWA `staticwebapp.config.json` route rules
- Emergency export: `GET /api/admin/exportToken` with `x-export-secret` header (no Google auth needed)

---

## Data Model (Cosmos DB NoSQL — Serverless)

### Container: `sponsors` (partition key: `/id`)

| Field | Type | Notes |
|---|---|---|
| id | string | UUID v4 |
| name | string | Sponsor display name |
| logoUrl | string \| null | Relative `/logos/filename.png` or absolute URL; null → placeholder |
| tagline | string | Short tagline shown on card |
| tier | `gold` \| `platinum` | Drives pointValue |
| pointValue | number | Gold=100, Platinum=150 |
| promptQuestion | string | Question shown to attendee |
| promptAnswerKeyword | string | Keyword for fuzzy match |
| isActive | boolean | Default: false — admin explicitly activates |
| displayOrder | number | Admin-controlled sort order |
| createdAt | string | ISO 8601 |

### Container: `attendees` (partition key: `/email`)

| Field | Type | Notes |
|---|---|---|
| id | string | UUID v4 |
| email | string | Partition key |
| firstName | string \| null | Optional, collected at login |
| lastName | string \| null | Optional, collected at login |
| magicLinkTokenHash | string \| null | SHA-256 of raw token; null after use |
| tokenExpiry | string \| null | ISO 8601; 15 min from issue |
| totalPoints | number | Running total |
| completedStamps | string[] | Array of completed sponsorIds |
| isComplete | boolean | true when totalPoints >= threshold |
| completedAt | string \| null | ISO 8601 timestamp of completion |
| createdAt | string | ISO 8601 |
| conferenceYear | number | e.g. 2026 — for year-to-year archive |

### Container: `checkins` (partition key: `/attendeeId`)

| Field | Type | Notes |
|---|---|---|
| id | string | UUID v4 |
| attendeeId | string | Reference to attendee.id |
| attendeeEmail | string | Denormalized for query convenience |
| sponsorId | string | Reference to sponsor.id |
| sponsorName | string | Denormalized |
| pointsAwarded | number | Points at time of checkin |
| answerSubmitted | string | Final accepted answer |
| attemptCount | number | 1–N |
| rejectedAnswers | string[] | All failed attempts logged |
| timestamp | string | ISO 8601 |
| conferenceYear | number | For archive |
| manualCredit | boolean | Default: false |
| manualCreditNote | string \| null | Admin note if manualCredit=true |
| manualCreditBy | string \| null | Admin email for audit |

---

## Completion Rules

- Completion = `totalPoints >= COMPLETION_THRESHOLD_POINTS` (env var, tunable without redeploy)
- Default value: `1000` — adjust after final sponsor count confirmed
- Reference: 13 sponsors (3 Platinum @ 150 + 10 Gold @ 100 = 1,450 total) → ~80% threshold = ~1,160 pts
- Admin dashboard shows live "X of Y attendees completed" for real-time monitoring
- If threshold is wrong on conference day: adjust env var (2-min fix, no redeploy)

---

## Fuzzy Answer Matching

1. Normalize both submitted answer and keyword: lowercase, trim, remove punctuation
2. **Primary check:** does normalized answer contain the normalized keyword phrase?
3. **Fallback:** Levenshtein distance between answer and keyword ≤ 30% of keyword length (handles typos)
4. Library: `fastest-levenshtein` (npm)
5. Max 3 attempts per attendee per sponsor stop
6. After 3 failures: show hint (first word of keyword)
7. All rejected answers logged to `checkins.rejectedAnswers[]` for post-conference review
8. UX: "Close — try rephrasing" (not "wrong")

---

## Key Configuration (Environment Variables)

| Variable | Description |
|---|---|
| `COSMOS_CONNECTION_STRING` | Cosmos DB serverless connection string |
| `JWT_SECRET` | Secret for signing attendee session JWTs (min 32 chars) |
| `ACS_CONNECTION_STRING` | Azure Communication Services connection string |
| `ACS_SENDER_ADDRESS` | Verified sender email (e.g. `passport@mgpsolutions.com`) |
| `ADMIN_EMAILS` | Comma-separated Google emails authorized as admins |
| `COMPLETION_THRESHOLD_POINTS` | Points required for passport completion (default: 1000) |
| `PASSPORT_LIVE` | `true` = live, `false` = Coming Soon screen |
| `PASSPORT_LOCK_UTC` | `2026-10-11T00:00:00Z` (midnight UTC = 7pm Oct 10 CT) |
| `EXPORT_SECRET` | Long random token for emergency export endpoint |
| `CONFERENCE_YEAR` | Current conference year (e.g. `2026`) |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | App Insights connection |

---

## File Structure

```
c:\CodeApps\IPELRA\
├── infra/
│   ├── main.bicep
│   ├── main.bicepparam
│   └── modules/
│       ├── staticWebApp.bicep
│       ├── functionApp.bicep
│       ├── cosmosDb.bicep
│       ├── appInsights.bicep
│       └── communicationServices.bicep
│
├── api/                                  ← Node.js v4 Azure Functions
│   ├── host.json
│   ├── package.json
│   ├── local.settings.json.example
│   └── src/
│       ├── functions/
│       │   ├── sendMagicLink.js
│       │   ├── verifyToken.js
│       │   ├── getSponsors.js
│       │   ├── checkin.js
│       │   ├── getProgress.js
│       │   ├── adminMetrics.js
│       │   ├── adminExport.js
│       │   ├── adminSettings.js
│       │   ├── adminAttendee.js
│       │   ├── adminFlagged.js
│       │   ├── adminReset.js
│       │   ├── adminReadiness.js
│       │   └── warmup.js
│       └── lib/
│           ├── cosmos.js
│           ├── auth.js
│           ├── fuzzyMatch.js
│           └── email.js
│
├── app/                                  ← React + Vite SPA
│   ├── public/
│   │   └── logos/                        ← sponsor logo files
│   ├── src/
│   │   ├── pages/
│   │   │   ├── attendee/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── CheckEmail.jsx
│   │   │   │   ├── Onboarding.jsx
│   │   │   │   ├── Verifying.jsx
│   │   │   │   ├── LinkExpired.jsx
│   │   │   │   ├── PassportHome.jsx
│   │   │   │   ├── PromptModal.jsx
│   │   │   │   ├── StopConfirmed.jsx
│   │   │   │   ├── PrizeInfo.jsx
│   │   │   │   ├── HelpFAQ.jsx
│   │   │   │   ├── ErrorOffline.jsx
│   │   │   │   ├── CompletedPassport.jsx
│   │   │   │   ├── PassportClosed.jsx
│   │   │   │   └── ComingSoon.jsx
│   │   │   └── admin/
│   │   │       ├── AdminLogin.jsx
│   │   │       ├── Readiness.jsx
│   │   │       ├── Metrics.jsx
│   │   │       ├── AttendeeLookup.jsx
│   │   │       ├── Export.jsx
│   │   │       ├── SponsorList.jsx
│   │   │       ├── SponsorForm.jsx
│   │   │       ├── FlaggedAnswers.jsx
│   │   │       ├── Settings.jsx
│   │   │       └── ResetConference.jsx
│   │   ├── components/
│   │   │   ├── SponsorCard.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── AlmostThereNudge.jsx
│   │   │   └── PrivateModeWarning.jsx
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   └── session.js
│   │   └── App.jsx
│   ├── staticwebapp.config.json
│   ├── vite.config.js
│   └── package.json
│
├── scripts/
│   └── seedSponsors.js
│
├── PLAN.md           ← this file
├── CHANGELOG.md
├── REASONING.md
├── ERRORS.md
└── README.md
```

---

## API Endpoints (15 total)

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/sendMagicLink` | None | Generate + email single-use magic link |
| GET | `/api/auth/verify` | None | Validate token → session JWT (exp Oct 10) |
| GET | `/api/sponsors` | Attendee JWT | Active sponsors (respects PASSPORT_LIVE) |
| POST | `/api/checkin` | Attendee JWT | Fuzzy match, idempotent, sends completion email |
| GET | `/api/attendee/{id}/progress` | Attendee JWT | Points + stops + attempt counts |
| GET | `/api/admin/metrics` | Google OAuth | Dashboard data + engagement sort |
| GET | `/api/admin/export` | Google OAuth | CSV: name, email, completedAt |
| GET | `/api/admin/exportToken` | `x-export-secret` header | Emergency CSV bypass |
| PUT | `/api/admin/settings` | Google OAuth | Update threshold + PASSPORT_LIVE |
| GET | `/api/admin/attendee` | Google OAuth | Lookup attendee by email/name |
| POST | `/api/admin/manualCredit` | Google OAuth | Credit stop manually with audit note |
| GET | `/api/admin/flagged` | Google OAuth | Rejected answer review log |
| GET | `/api/admin/readiness` | Google OAuth | Pre-conference checklist status |
| POST | `/api/admin/resetConference` | Google OAuth | Archive + reset for new year |
| *(timer)* | `warmup` | Internal | Cold start prevention Oct 5–7, 6AM–6PM CT |

---

## All Screens (26 total)

### Attendee (14)

| # | Screen | Trigger |
|---|---|---|
| 1 | **Login** | No valid session JWT |
| 2 | **Check Email** | After sendMagicLink |
| 3 | **Onboarding** | First login only (3-card swipe) |
| 4 | **Verifying** | Magic link clicked |
| 5 | **Link Expired** | Token expired (>15 min) |
| 6 | **Passport Home** | Valid session, passport open |
| 7 | **Prompt Modal** | Tap sponsor card |
| 8 | **Stop Confirmed** | Correct answer submitted (+pts flash) |
| 9 | **Prize Info** | Info icon on Home |
| 10 | **Help / FAQ** | Help icon on Login or Home |
| 11 | **Error / Offline** | Network failure |
| 12 | **Completed Passport** | Threshold reached |
| 13 | **Passport Closed** | After Oct 10, 2026 |
| 14 | **Coming Soon** | PASSPORT_LIVE=false |

### Admin (12)

| # | Screen | Notes |
|---|---|---|
| 1 | **Admin Login** | Google OAuth |
| 2 | **Readiness Checklist** | Pre-conference actionable checklist |
| 3 | **Metrics Dashboard** | Auto-refresh 30s, trend chart, amber flags |
| 4 | **Attendee Lookup** | Search + manual credit |
| 5 | **Manual Credit** | Override with audit trail |
| 6 | **Export** | CSV download + emergency token info |
| 7 | **Sponsor List** | Inline check-in counts, active toggle |
| 8 | **Sponsor Form** | Add/edit + live prompt test |
| 9 | **Flagged Answers** | Rejected answer review |
| 10 | **Conference Settings** | Threshold, live toggle, conference QR |
| 11 | **Reset Conference** | Year-to-year archive (Year 2+) |

---

## Caveats & Mitigations

| Risk | Mitigation |
|---|---|
| ACS emails in spam | Verified custom sender domain with SPF/DKIM |
| ACS 100/day free limit | PAYG from day one (~$0.04 total) |
| iOS Safari private mode | Warning banner + cookie-based session fallback |
| Double-submission | Idempotent checkin (unique attendeeId+sponsorId) |
| Function cold starts | Timer warm-up Oct 5–7, 6AM–6PM CT |
| Cosmos cold start | Same warm-up timer pings Cosmos |
| Wrong fuzzy threshold | 3-attempt counter, hint, answer logging |
| Threshold misconfigured | Env var + live admin count — adjustable in 2 min |
| Sponsor content not ready | isActive=false default, admin explicitly activates |
| Admin lockout | Pre-conference login test + emergency export token |
| Timezone lock bug | Lock at `2026-10-11T00:00:00Z` UTC, documented |
| Last-minute sponsor add | isActive flag + admin form available day-of |

---

## Seed Data (3 example sponsors)

| Name | Tier | Points | Prompt Question | Answer Keyword |
|---|---|---|---|---|
| CityTech Solutions | Gold | 100 | "What does CityTech specialize in?" | "municipal technology" |
| SecureGov Inc | Platinum | 150 | "Name one product SecureGov offers." | "identity management" |
| DataBridge Partners | Gold | 100 | "What industry does DataBridge serve?" | "local government" |

---

## Cost Estimate

| Period | Cost |
|---|---|
| Apr 27 → Oct 4 (dev/staging, 5.3 months) | ~$0.10 |
| Conference week (Oct 5–10) | ~$0.20 |
| Test emails during development | ~$0.01 |
| **Total: Apr 27 → Oct 10** | **~$0.31** |
| Monthly idle after conference | ~$0.01/month |
| Full first-year total | ~$0.43 |

---

## Build Phases

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Bicep infrastructure (6 modules + main + params) | ✅ Complete |
| 2 | API lib layer (cosmos, auth, fuzzyMatch, email) | ⬜ Not started |
| 3 | Auth functions (sendMagicLink, verifyToken) | ⬜ Not started |
| 4 | Core attendee functions (sponsors, checkin, progress) | ⬜ Not started |
| 5 | Admin functions (8 endpoints + warmup) | ⬜ Not started |
| 6 | React frontend — attendee flow (14 screens) | ⬜ Not started |
| 7 | React frontend — admin portal (12 screens) | ⬜ Not started |
| 8 | Seed script | ✅ Complete |
| 9 | staticwebapp.config.json + vite.config.js | ⬜ Not started |
| 10 | README + pre-conference checklist | ⬜ Not started |

---

## Open Items (Blocking / Pre-Go-Live)

| # | Item | Owner | Status |
|---|---|---|---|
| G1 | ACS verified sender domain + SPF/DKIM setup | MGP (DNS owner) | ⬜ Open |
| G2 | Google OAuth Client ID — requires SWA URL (post-deploy step) | MGP | ⬜ Open |
| G3 | Final sponsor count + tier mix → set COMPLETION_THRESHOLD_POINTS | IPELRA / MGP | ⬜ Open |
| G4 | Exact admin Google email addresses | Angie Miller / IPELRA | ⬜ Open |
