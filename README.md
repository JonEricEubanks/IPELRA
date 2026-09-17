# IPELRA Conference Passport

**Client:** IPELRA  
**Developer:** MGP Technology Solutions  
**Conference:** October 5–10, 2026 — Eagle Ridge Resort, Galena IL  
**Attendees:** ~160  
**Live URL:** https://gentle-flower-01d10d50f.7.azurestaticapps.net

A mobile-friendly web app where conference attendees visit sponsor tables, answer a prompt question at each stop, earn points, and complete their passport for prize entry. Admins manage sponsors, monitor live metrics, and export a raffle list.

### Deployed Azure Resources

| Resource | Name | Resource Group |
|---|---|---|
| Static Web App | `swa-ipelra-passport` | `conferenceapp` |
| Function App | `func-ipelra-xokxr7c5kfc64` | `conferenceapp` |
| Cosmos DB | `cosmos-ipelra-xokxr7c5kfc64` | `conferenceapp` |
| ACS Email | `acs-ipelra` | `conferenceapp` |
| App Insights | `appi-ipelra` | `conferenceapp` |

---

## Table of Contents

1. [Architecture](#architecture)
2. [App Routes](#app-routes)
3. [Prerequisites](#prerequisites)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [Deployment](#deployment)
7. [Post-Deploy Steps](#post-deploy-steps)
8. [Pre-Conference Checklist](#pre-conference-checklist)
9. [Day-Of Runbook](#day-of-runbook)
10. [Troubleshooting](#troubleshooting)
11. [Capacity & Peak Load](#capacity--peak-load)
12. [Cost Reference](#cost-reference)

---

## Architecture

```
Attendee (mobile browser)
  └─→ Azure Static Web App (Free)  ← React/Vite SPA
        └─→ Azure Functions (Consumption, Node v4)  ← all API logic
              ├─→ Cosmos DB (Serverless)  ← sponsors / attendees / checkins
              ├─→ ACS Email (PAYG)        ← magic link + completion emails
              └─→ Application Insights    ← monitoring

Admin (any browser, /admin)
  └─→ Same SWA  →  magic link email auth
        └─→ Same Functions (/api/admin/*)
```

| Azure Resource | Tier | ~Monthly Cost |
|---|---|---|
| Static Web App | Free | $0.00 |
| Functions | Consumption Y1 | ~$0.00 (under free grant) |
| Cosmos DB | Serverless | ~$0.01 |
| ACS Email | PAYG | ~$1–2 total (conference week) |
| Application Insights | Free 5GB | $0.00 |
| **Total through Oct 10, 2026** | | **~$2.00** |

---

## App Routes

### Attendee

| Path | Description |
|---|---|
| `/login` | Enter email → receive magic link |
| `/verify` | Magic link redirect / token exchange |
| `/onboarding` | 3-slide first-visit intro |
| `/` | Passport home — sponsor grid + progress bar |
| `/sponsor/:id` | Sponsor stop — prompt + check-in |
| `/completed` | Passport completion celebration |
| `/rankings` | Leaderboard — top attendees by points |
| `/help` | FAQ accordion |
| `/link-expired` | Shown when magic link has expired |
| `/offline` | Shown when device is offline |

### Admin

| Path | Description |
|---|---|
| `/admin/login` | Admin magic link request |
| `/admin/verify` | Admin magic link exchange |
| `/admin/dashboard` | Live numbers: registered / completed / check-ins today / almost-there, hourly activity, sponsor ranking (dead tables flagged), stops funnel, live feed, "needs attention" (30s auto-refresh) |
| `/admin/attendees` | Roster (auto-loads) with search + status filters; click a row for check-in history and manual credit (sponsor dropdown) |
| `/admin/sponsors` | Sponsor list — add/edit/toggle active/reorder, with per-sponsor check-in count and "stuck" badge |
| `/admin/sponsors/:id` | Edit sponsor — name, logo, tier, question, answer |
| `/admin/export` | Excel downloads (prize drawing list · full roster · sponsor report) + collapsed **System status** and **Reset for next year** sections |

Old bookmarks to `/admin/flagged`, `/admin/readiness`, `/admin/settings`, and `/admin/reset` redirect to the tab that now holds that content.

---

## Prerequisites

- **Azure CLI** `az` — [install](https://docs.microsoft.com/cli/azure/install-azure-cli)
- **Azure Functions Core Tools v4** — `npm install -g azure-functions-core-tools@4`
- **Node.js 22+** — `node --version`
- **Access** to Azure subscription `b8f90e47-b8ee-45f1-9442-d3b4f8fd0695` (Microsoft Azure Sponsorship)

```powershell
az login
az account set --subscription "b8f90e47-b8ee-45f1-9442-d3b4f8fd0695"
```

---

## Local Development

### 1. API (Azure Functions)

```powershell
cd api
npm install
copy local.settings.json.example local.settings.json
# Fill in local.settings.json with real values (see Environment Variables below)
func start
# Functions running at http://localhost:7071
```

### 2. React App

```powershell
cd app
npm install
npm run dev
# App running at http://localhost:5173
# /api requests proxied to localhost:7071
```

Open `http://localhost:5173` in a browser. Magic links in local dev will print to the Function console log (ACS not required locally).

### 3. Seed Sponsors (optional)

```powershell
cd scripts
npm install
# Set COSMOS_CONNECTION_STRING in env or ensure api/local.settings.json exists
node seedSponsors.js
# Upserts 3 example sponsors with isActive=false
```

---

## Environment Variables

### API (Azure Functions) — `api/local.settings.json` locally, App Settings in Azure

| Variable | Required | Description | Example |
|---|---|---|---|
| `COSMOS_CONNECTION_STRING` | ✅ | Cosmos DB account connection string | `AccountEndpoint=https://...` |
| `JWT_SECRET` | ✅ | ≥32 char random string — signs attendee JWTs | See generate command below |
| `EMAIL_PROVIDER` | ✅ | `graph` (production) or `acs` (dev/test, 10 emails/hour). See [docs/EMAIL-SENDING.md](docs/EMAIL-SENDING.md) | `graph` |
| `GRAPH_TENANT_ID` | for `graph` | Entra tenant ID of the sending mailbox's org | `ce08ca1a-…` |
| `GRAPH_CLIENT_ID` | for `graph` | App registration (client) ID with `Mail.Send` app permission | `dda92421-…` |
| `GRAPH_CLIENT_SECRET` | for `graph` | App registration client secret | — |
| `GRAPH_SENDER_ADDRESS` | for `graph` | M365 mailbox to send as | `passport@ipelra.org` |
| `EMAIL_FROM_NAME` | optional | Display name in the inbox | `IPELRA Conference Passport` |
| `ACS_CONNECTION_STRING` | fallback | Azure Communication Services connection string | `endpoint=https://...` |
| `ACS_SENDER_ADDRESS` | fallback | ACS sender address | `DoNotReply@<domain>` |
| `ADMIN_EMAILS` | ✅ | Comma-separated Google emails for admin access | `angie@ipelra.org,mgp@example.com` |
| `COMPLETION_THRESHOLD_POINTS` | ✅ | Points needed to complete passport | `1000` |
| `EXPORT_SECRET` | ✅ | Random token for emergency CSV export | See generate command below |
| `PASSPORT_LIVE` | ✅ | `true` to open passport to attendees | `false` during setup |
| `PASSPORT_LOCK_UTC` | ✅ | ISO 8601 UTC — passport closes at this time | `2026-10-11T00:00:00Z` |
| `CONFERENCE_YEAR` | ✅ | Current conference year (for data partitioning) | `2026` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | recommended | App Insights telemetry | Auto-set by Bicep deploy |

**Generate secrets:**
```powershell
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# EXPORT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### SWA (Azure Static Web App) — Application Settings in Azure Portal

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | Full URL of deployed Function App (no trailing slash) |

---

## Deployment

### Redeploy (existing infrastructure is already live)

**API (backend changes):**
```powershell
cd api
func azure functionapp publish func-ipelra-xokxr7c5kfc64 --javascript
```

**Frontend (UI changes):**
```powershell
cd app
npx vite build
npx @azure/static-web-apps-cli deploy "dist" `
  --deployment-token "<SWA_DEPLOY_TOKEN>" `
  --env production
```

Retrieve the deploy token:
```powershell
az staticwebapp secrets list --name swa-ipelra-passport --resource-group conferenceapp
```

### First Deploy (new environment)

#### Step 1 — Prepare secrets

```powershell
$JWT_SECRET    = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
$EXPORT_SECRET = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 2 — Deploy Bicep infrastructure

```powershell
az deployment group create `
  --resource-group conferenceapp `
  --template-file infra/main.bicep `
  --parameters infra/main.bicepparam `
  --parameters jwtSecret="$JWT_SECRET" `
               adminEmails="angie@ipelra.org,YOUR_ADMIN_EMAIL" `
               exportSecret="$EXPORT_SECRET"
```

Outputs: `staticWebAppUrl` and `functionAppUrl` — note both for the next steps.

#### Step 3 — Deploy the API

```powershell
cd api
npm install
func azure functionapp publish func-ipelra-xokxr7c5kfc64 --javascript
```

#### Step 4 — Build and deploy the React app

```powershell
cd app
npm install
npm run build
npx @azure/static-web-apps-cli deploy "dist" `
  --deployment-token "<SWA_DEPLOY_TOKEN>" `
  --env production
```

---

## Post-Deploy Steps

Complete these **after the first successful deploy**. All are required before going live.

### 1 — Configure the sending mailbox

Emails are sent through **Microsoft Graph as a real Microsoft 365 mailbox** (30/min,
10k/day). The original ACS-on-a-test-domain path is capped at **10 emails/hour** and
is kept only as a fallback. Full setup, tenant-switch, and hardening steps are in
[docs/EMAIL-SENDING.md](docs/EMAIL-SENDING.md). In short:

1. Create an app registration in the mailbox's Entra tenant with the `Mail.Send`
   **application** permission and grant admin consent
2. Set `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER_ADDRESS`,
   `EMAIL_PROVIDER=graph` on the Function App
3. Send a test magic link and confirm delivery + not in spam folder

### 2 — Set CORS on Function App

```powershell
az functionapp cors add `
  --name func-ipelra-xokxr7c5kfc64 `
  --resource-group conferenceapp `
  --allowed-origins "https://gentle-flower-01d10d50f.7.azurestaticapps.net"
```

### 3 — Verify admin login

1. Navigate to `https://gentle-flower-01d10d50f.7.azurestaticapps.net/admin/login`
2. Enter an email listed in `ADMIN_EMAILS`
3. Check email for the magic link — click it
4. Should land on the Admin Dashboard

### 4 — Test attendee magic link flow

1. Go to `https://gentle-flower-01d10d50f.7.azurestaticapps.net/login`
2. Enter a real email address
3. Confirm you receive the magic link email
4. Click the link — should land on onboarding

---

## Pre-Conference Checklist

Run this checklist **at least 48 hours before October 5, 2026**.

### Infrastructure

- [ ] Function App responding: `GET https://func-ipelra-xokxr7c5kfc64.azurewebsites.net/api/admin/readiness`
- [ ] Admin dashboard loads at `/admin`
- [ ] Magic link email arrives in under 2 minutes (test with personal email)
- [ ] Magic link email not in spam (check SPF/DKIM/DMARC if so)

### Sponsors

- [ ] All sponsor records entered in admin portal (`/admin/sponsors`)
- [ ] All sponsor questions reviewed and finalized with IPELRA
- [ ] All sponsor records set `isActive = true`
- [ ] `COMPLETION_THRESHOLD_POINTS` set to final value (confirm with IPELRA)
  - Reference: 13 sponsors × avg ~115 pts/stop × 80% = ~1,195 pts
- [ ] Test each sponsor question answer in admin edit form (fuzzy tester)

### Access

- [ ] Admin email addresses confirmed with Angie Miller
- [ ] All admin emails added to `ADMIN_EMAILS` env var
- [ ] All admins have tested logging in
- [ ] Emergency export secret tested: `GET /api/admin/export` with `x-export-secret` header

### App

- [ ] `PASSPORT_LIVE` = `false` (leave closed until morning of Oct 5)
- [ ] App tested on real iPhone (Safari) — confirm no iOS zoom bugs, bottom nav visible
- [ ] App tested on Android Chrome
- [ ] Onboarding flow reviewed with IPELRA — content approved
- [ ] Help/FAQ page reviewed — Wi-Fi network name is correct

### Monitoring

- [ ] Application Insights live metrics open in Azure Portal
- [ ] Admin dashboard auto-refresh verified (30s)

---

## Day-Of Runbook

### Morning of October 5

1. **Open the passport:**
   ```powershell
   az functionapp config appsettings set `
     --name func-ipelra-xokxr7c5kfc64 `
     --resource-group conferenceapp `
     --settings "PASSPORT_LIVE=true"
   ```

2. **Announce to attendees** — share the app URL (QR code, printed signage, etc.)

3. **Monitor dashboard** — open `/admin` and leave the dashboard tab open

### During the Conference

- **Attendee can't check in:** Go to `/admin/attendees`, search by email, use **Manual Credit** button.
- **Sponsor question too hard / too easy:** Edit in `/admin/sponsors`, adjust the answer keyword, re-test with the fuzzy tester.
- **Completion threshold needs adjusting:**
  ```powershell
  az functionapp config appsettings set `
    --name func-ipelra-xokxr7c5kfc64 `
    --resource-group conferenceapp `
    --settings "COMPLETION_THRESHOLD_POINTS=900"
  ```
  Takes effect immediately — no redeploy needed.
- **Suspicious activity / cheating:** The Dashboard's **Needs attention** card and the **stuck** badge on `/admin/sponsors` show attendees who burned all 3 answer attempts at a table.

### End of Conference (October 10)

1. **Export raffle list:** Go to `/admin/export` → Download CSV  
   CSV includes: email, firstName, lastName, totalPoints, completedAt

2. **Close the passport:** Auto-locks at UTC midnight Oct 11 if `PASSPORT_LOCK_UTC` is set correctly — no action needed if configured.

3. **Backup confirmation:** Download CSV one more time and save to IPELRA shared drive.

---

## Troubleshooting

### Magic link email not arriving

1. Admin portal → Export → **System status** → check the **Email sending** line (provider + sender, red if misconfigured)
2. Application Insights (`appi-ipelra-passport`) → search traces for `[email]` — a failed Graph send logs the HTTP status and reason
3. If the attendee saw *"We couldn't send your login email"*, every provider failed — check `GRAPH_CLIENT_SECRET` hasn't expired (see [docs/EMAIL-SENDING.md](docs/EMAIL-SENDING.md#rotating-the-client-secret))
4. Check attendee spam folder; confirm the sending mailbox's domain has SPF/DKIM in M365

### Admin login not working (401 / link invalid)

1. Confirm the email is listed exactly in `ADMIN_EMAILS` on the Function App (case-insensitive, comma-separated)
2. Check `JWT_SECRET` is set — a mismatch causes all tokens to fail validation
3. Magic links expire in 15 minutes — request a fresh one if the link is old
4. Check Function App logs: Azure Portal → Function App → Monitor

### Check-in returns "wrong answer" even though answer seems correct

1. Go to `/admin/sponsors` → edit the sponsor
2. Review the **Answer keyword** — the fuzzy matcher looks for this as a substring or close match
3. Use the live fuzzy tester in the edit form to test the exact answer typed
4. Shorten/simplify the keyword if needed (e.g. `"municipal"` instead of `"municipal technology"`)

### Function App cold start — slow first request

The warmup timer runs every 5 minutes on Oct 5–10, 6AM–6PM CT. Outside those hours the first request may take ~3–5 seconds. Subsequent requests will be fast.

### Attendee lost their magic link

Go to `/login` and enter the email again — a fresh link will be sent. The old link is automatically invalidated.

### Points not updating after check-in

1. Pull-to-refresh on the Passport Home page
2. If still wrong, check `/admin/attendees` → attendee's check-in history shows actual stored points
3. If check-in is missing entirely, use Manual Credit

---

## Capacity & Peak Load

This app is built on Azure's consumption and serverless tiers, which scale automatically in response to traffic — there are no fixed instance limits to plan around.

### Architecture scaling behavior

| Layer | Scaling mechanism | Effective capacity |
|---|---|---|
| Static Web App (frontend) | Azure CDN — globally distributed | Effectively unlimited |
| Azure Functions (API) | Auto-scales up to 200 parallel instances | Handles thousands of concurrent requests |
| Cosmos DB (Serverless) | Elastic RU burst — no provisioned throughput | Scales on demand per request |
| Email (Microsoft Graph, M365 mailbox) | 30 msgs/min · 10,000 recipients/day per mailbox | ~400 emails/day expected — comfortable |
| ACS Email (fallback only) | Azure-managed test domain | **Capped at 10 emails/hour — not viable as primary** |

### Expected peak load at IPELRA (160 attendees)

The two highest-traffic moments are opening day registration and the lunch sponsor fair:

| Scenario | Estimated concurrent requests | RU/s estimate | Headroom |
|---|---|---|---|
| Mass magic link send (opening) | 20–40 simultaneous | Minimal (read + write + email) | Very comfortable |
| Sponsor fair checkins (lunch) | 20–50 simultaneous | ~2,000–3,500 RU/s | Well under Cosmos Serverless burst |
| Leaderboard / progress views | 40–80 simultaneous | ~500–1,000 RU/s (read-heavy) | No concern |

### Cold start management

The warmup timer (`warmup.js`) fires every 10 minutes from **6 AM–6 PM CT on Oct 5–7** to keep a function instance warm. This eliminates the 2–3 second cold-start delay during all conference hours.

**Recommended:** Have a staff member open the app once ~10–15 minutes before doors open on October 5. This pre-warms the instance before the first attendee wave arrives.

### In short

For 160 attendees, this architecture is significantly over-provisioned. The app would handle 5–10× the expected load without any configuration changes. The Consumption + Serverless model means Azure automatically absorbs any traffic spike — you pay only for what is used, and capacity is never a bottleneck at this event size.

---

## Cost Reference

| Period | Cost |
|---|---|
| Apr 28 → Oct 4 (dev/idle, ~5 months) | ~$0.10 |
| Conference week (Oct 5–10) | ~$1–2 |
| Dev/test magic link emails (~50 emails) | ~$0.01 |
| **Total through Oct 10, 2026** | **~$2.00** |
| Idle after conference | ~$0.01/month |

All compute is consumption/serverless. No cost when idle.

---

## Open Items (Must Resolve Before Go-Live)

| # | Item | Owner | Status |
|---|---|---|---|
| G1 | ACS verified sender domain — add SPF, DKIM, DMARC DNS records | MGP | ⬜ Open |
| G2 | Final sponsor count + tier mix → set `COMPLETION_THRESHOLD_POINTS` | IPELRA / Angie | ⬜ Open |
| G3 | Exact admin email addresses for `ADMIN_EMAILS` env var | Angie Miller | ⬜ Open |
| G4 | Help page Wi-Fi network name — confirm with venue | IPELRA | ⬜ Open |

---

*README last updated: 2026-04-28*
