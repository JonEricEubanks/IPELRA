# IPELRA Conference Passport

**Client:** IPELRA  
**Developer:** MGP Technology Solutions  
**Conference:** October 5–7, 2026 — Eagle Ridge Resort, Galena IL  
**Attendees:** ~160

A mobile-friendly web app where conference attendees visit sponsor tables, answer a prompt question at each stop, earn points, and complete their passport for prize entry. Admins manage sponsors, monitor live metrics, and export a raffle list.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [Environment Variables](#environment-variables)
5. [Deployment](#deployment)
6. [Post-Deploy Steps](#post-deploy-steps)
7. [Pre-Conference Checklist](#pre-conference-checklist)
8. [Day-Of Runbook](#day-of-runbook)
9. [Troubleshooting](#troubleshooting)
10. [Cost Reference](#cost-reference)

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
  └─→ Same SWA  →  Google OAuth (SWA built-in)
        └─→ Same Functions (/api/admin/*)
```

| Azure Resource | Tier | ~Monthly Cost |
|---|---|---|
| Static Web App | Free | $0.00 |
| Functions | Consumption Y1 | ~$0.00 (under free grant) |
| Cosmos DB | Serverless | ~$0.01 |
| ACS Email | PAYG | ~$0.04 total (conference week) |
| Application Insights | Free 5GB | $0.00 |
| **Total (Apr 27 → Oct 10)** | | **~$0.31** |

---

## Prerequisites

- **Azure CLI** `az` — [install](https://docs.microsoft.com/cli/azure/install-azure-cli)
- **Azure Functions Core Tools v4** — `npm install -g azure-functions-core-tools@4`
- **Node.js 20+** — `node --version`
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
| `ACS_CONNECTION_STRING` | ✅ | Azure Communication Services connection string | `endpoint=https://...` |
| `ACS_SENDER_ADDRESS` | ✅ | Verified sender address | `passport@<domain>` |
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
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `VITE_API_BASE_URL` | ✅ | Full URL of deployed Function App (no trailing slash) |

---

## Deployment

### First Deploy

#### Step 1 — Prepare secrets

```powershell
$JWT_SECRET   = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
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

This creates and configures all Azure resources. Note the outputs:
- `staticWebAppUrl` — your SWA URL (e.g. `https://brave-ocean-abc.azurestaticapps.net`)
- `functionAppUrl` — your Functions URL (e.g. `https://func-ipelra-abc.azurewebsites.net`)

#### Step 3 — Deploy the API

```powershell
cd api
npm install
func azure functionapp publish func-ipelra-<suffix>
```

#### Step 4 — Build and deploy the React app

```powershell
cd app
npm install
# Set VITE_API_BASE_URL to your Function App URL for the build
$env:VITE_API_BASE_URL = "https://func-ipelra-<suffix>.azurewebsites.net"
npm run build
```

Deploy the `app/dist/` folder to SWA:
```powershell
az staticwebapp deploy `
  --name swa-ipelra-<suffix> `
  --resource-group conferenceapp `
  --source app/dist `
  --no-use-keyfile
```

Or use the [SWA CLI](https://azure.github.io/static-web-apps-cli/):
```powershell
npm install -g @azure/static-web-apps-cli
swa deploy app/dist --deployment-token <YOUR_SWA_DEPLOY_TOKEN>
```

---

## Post-Deploy Steps

Complete these **after the first successful deploy**. All are required before going live.

### 1 — Add VITE_API_BASE_URL to SWA environment settings

```powershell
az staticwebapp appsettings set `
  --name swa-ipelra-<suffix> `
  --resource-group conferenceapp `
  --setting-names "VITE_API_BASE_URL=https://func-ipelra-<suffix>.azurewebsites.net"
```

Then rebuild and redeploy the app (the env var is baked into the bundle at build time).

### 2 — Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application type)
3. Add authorized redirect URI: `https://<your-swa-url>/.auth/login/google/callback`
4. Copy the Client ID and Client Secret
5. Add to SWA application settings:
   ```powershell
   az staticwebapp appsettings set `
     --name swa-ipelra-<suffix> `
     --resource-group conferenceapp `
     --setting-names "GOOGLE_CLIENT_ID=<id>" "GOOGLE_CLIENT_SECRET=<secret>"
   ```

### 3 — Configure ACS Email sender domain

1. In Azure Portal → your ACS resource → Email → Domains
2. Add your custom domain (e.g. `mgpsolutions.com`)
3. Add the SPF, DKIM, and DMARC DNS records to your DNS registrar
4. Click **Verify** in the portal
5. Update `ACS_SENDER_ADDRESS` in Function App settings to use the verified domain
6. Send a test magic link via the app and confirm delivery + no spam folder

### 4 — Set CORS on Function App

Allow the SWA origin:
```powershell
az functionapp cors add `
  --name func-ipelra-<suffix> `
  --resource-group conferenceapp `
  --allowed-origins "https://<your-swa-url>"
```

### 5 — Verify admin login

1. Navigate to `https://<your-swa-url>/admin`
2. Should redirect to Google sign-in
3. Sign in with an email listed in `ADMIN_EMAILS`
4. Should land on the Admin Dashboard

### 6 — Test magic link flow

1. Go to `https://<your-swa-url>/login`
2. Enter a real email address
3. Confirm you receive the magic link email
4. Click the link — should land on onboarding

---

## Pre-Conference Checklist

Run this checklist **at least 48 hours before October 5, 2026**.

### Infrastructure

- [ ] All Bicep resources deployed and running
- [ ] Function App responding: `curl https://func-ipelra-<suffix>.azurewebsites.net/api/admin/readiness`
- [ ] Admin dashboard loads at `/admin`
- [ ] Magic link email arrives in under 2 minutes (test with personal email)
- [ ] Magic link email not in spam (check SPF/DKIM if so)

### Sponsors

- [ ] All sponsor records entered in admin portal (`/admin/sponsors`)
- [ ] All sponsor questions reviewed and finalized with IPELRA
- [ ] All sponsor records set `isActive = true`
- [ ] `COMPLETION_THRESHOLD_POINTS` set to final value (confirm with IPELRA: G3)
  - Reference: 13 sponsors × avg ~115 pts/stop × 80% = ~1,195 pts
- [ ] Test each sponsor question answer in admin edit form (fuzzy tester)

### Access

- [ ] Admin email addresses confirmed with Angie Miller (G4)
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

- [ ] Application Insights live metrics tab open in Azure Portal
- [ ] Admin dashboard auto-refresh verified (30s)

---

## Day-Of Runbook

### Morning of October 5

1. **Open the passport** (remove "coming soon" state):
   ```powershell
   az functionapp config appsettings set `
     --name func-ipelra-<suffix> `
     --resource-group conferenceapp `
     --settings "PASSPORT_LIVE=true"
   ```

2. **Announce to attendees** — share the app URL (QR code, printed signage, etc.)

3. **Monitor dashboard** — open `/admin` and leave the dashboard tab open

### During the Conference

- **Attendee can't check in:** Go to `/admin/attendees`, search by email, use **Manual Credit** button. Note the reason.
- **Sponsor question too hard / too easy:** Edit in `/admin/sponsors` and adjust the answer keyword. Re-test with the fuzzy tester.
- **Completion threshold wrong:** Update `COMPLETION_THRESHOLD_POINTS` env var. Takes effect immediately — no redeploy needed.
  ```powershell
  az functionapp config appsettings set `
    --name func-ipelra-<suffix> `
    --resource-group conferenceapp `
    --settings "COMPLETION_THRESHOLD_POINTS=900"
  ```
- **Suspicious activity / cheating:** Check `/admin/flagged` for repeated wrong answers.

### End of Conference (October 10)

1. **Export raffle list:**
   - Go to `/admin/export` → Download CSV
   - CSV includes: email, firstName, lastName, totalPoints, completedAt

2. **Close the passport** at 7pm CT (auto-locks at UTC midnight Oct 11 if `PASSPORT_LOCK_UTC` is set correctly — no action needed if configured)

3. **Backup confirmation:**
   - Download CSV one more time
   - Save to IPELRA shared drive

---

## Troubleshooting

### Magic link email not arriving

1. Check ACS email logs in Azure Portal → Communication Services → Email → Message Status
2. Verify `ACS_SENDER_ADDRESS` matches the verified domain exactly
3. Check attendee spam folder
4. Confirm SPF/DKIM records are published and verified in ACS portal

### Admin login not working (401 loop)

1. Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in SWA application settings
2. Confirm the redirect URI in Google Cloud Console matches: `https://<swa-url>/.auth/login/google/callback`
3. Confirm the signed-in email is in `ADMIN_EMAILS` on the Function App

### Check-in returns wrong answer even though answer is correct

1. Go to `/admin/sponsors` → edit the sponsor
2. Review the **Answer keyword** — the fuzzy matcher looks for this keyword as a substring or close match
3. Use the live fuzzy tester in the edit form to test the exact answer the attendee typed
4. Adjust keyword to be shorter/simpler if needed (e.g. `"municipal"` instead of `"municipal technology"`)

### Function App cold start causing slow first request

The warmup timer runs every 5 minutes on Oct 5–7, 6AM–6PM CT. If a cold start still occurs outside those hours, the first request will take ~3–5 seconds. Subsequent requests will be fast.

### Attendee lost their magic link

Go to `/login` and enter their email again — a fresh link will be sent. The previous link is automatically invalidated.

### Points not updating after check-in

1. Hard-refresh the Passport Home page (`Pull to refresh` on mobile)
2. If still wrong, check `/admin/attendees` for the attendee — their check-in history shows the actual stored points
3. If check-in is missing, use Manual Credit

---

## Cost Reference

| Period | Cost |
|---|---|
| Now → Oct 4 (dev, ~5 months) | ~$0.10 |
| Conference week (Oct 5–10) | ~$0.20 |
| Dev/test magic link emails (~50 emails) | ~$0.01 |
| **Total through Oct 10, 2026** | **~$0.31** |
| Idle after conference | ~$0.01/month |

All compute is consumption/serverless. No cost when idle.

---

## Open Items (Must Resolve Before Go-Live)

| # | Item | Owner | Status |
|---|---|---|---|
| G1 | ACS verified sender domain — add SPF, DKIM, DMARC DNS records | MGP | ⬜ Open |
| G2 | Google OAuth Client ID — create in Google Cloud Console after SWA URL is known | MGP | ⬜ Open |
| G3 | Final sponsor count + tier mix → set `COMPLETION_THRESHOLD_POINTS` | IPELRA / Angie | ⬜ Open |
| G4 | Exact admin Google email addresses for `ADMIN_EMAILS` | Angie Miller | ⬜ Open |

---

*README last updated: 2026-04-27*
