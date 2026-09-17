# Email Sending — How It Works and How to Change the Sender

_Last updated: 2026-09-16_

The passport app sends three kinds of email: attendee login links, completion
confirmations, and admin login links. **All of them go through one place:**
[`api/src/lib/email.js`](../api/src/lib/email.js). Nothing else in the codebase
knows or cares which mailbox is used.

---

## Current setup (as deployed)

| Setting | Value |
|---|---|
| Provider | **Microsoft Graph** — sends as a real Microsoft 365 mailbox |
| Sending mailbox | `jeubanks@Community-Essentials.com` (temporary — see [Switching to the IPELRA mailbox](#switching-to-the-ipelra-staff-mailbox)) |
| Display name attendees see | **IPELRA Conference Passport** |
| Fallback | Azure Communication Services (the original setup) — used automatically only if Graph fails |
| Capacity | 30 emails/minute · 10,000 recipients/day per mailbox — comfortably covers 160 attendees plus retries |

### Why this changed

The original setup sent through Azure Communication Services on a Microsoft
*test* domain (`…azurecomm.net`). Microsoft caps those at **5 emails/minute and
10 per hour**, and that cap cannot be raised. On conference morning, ~150 of 160
attendees would never have received a login email. Sending from a real M365
mailbox has no such cap.

### What the app does on each send

1. Reads `EMAIL_PROVIDER` (`graph` or `acs`) to pick the primary provider.
2. Sends. If the primary throws (network, 429, bad credentials…) and the other
   provider is configured, it retries **once** via the fallback.
3. The login endpoint **waits for the send to succeed** before telling the
   attendee "check your inbox". If every provider fails, the attendee sees
   _"We couldn't send your login email just now. Please try again — or ask at the
   registration desk."_ instead of a false success.
4. The IPELRA logo is **embedded in the email** (inline attachment, `cid:`) so it
   renders in Outlook and corporate clients that block remote images.

---

## Azure resources involved

| Resource | Where | Purpose |
|---|---|---|
| App registration **IPELRA Passport Mailer** | Entra ID, tenant `Community-Essentials.com` (`ce08ca1a-3a87-472b-affa-217b4d4793ce`) | Identity the Function App uses to call Graph |
| Its permission | `Mail.Send` (**Application**, admin-consented) | Lets the app send mail via Graph |
| Its client secret | Expires **~2027-09** (1 year from creation) | Stored only in Function App settings |
| Function App `func-ipelra-xokxr7c5kfc64` | Resource group `conferenceapp` | Holds the settings below |

### Function App settings

| Setting | Meaning |
|---|---|
| `EMAIL_PROVIDER` | `graph` (current) or `acs` |
| `GRAPH_TENANT_ID` | Entra tenant ID of the **mailbox's** organisation |
| `GRAPH_CLIENT_ID` | App registration's Application (client) ID |
| `GRAPH_CLIENT_SECRET` | App registration's client secret |
| `GRAPH_SENDER_ADDRESS` | Mailbox to send **as** — must exist in that tenant and be licensed |
| `EMAIL_FROM_NAME` | Display name shown in the inbox (default `IPELRA Conference Passport`) |
| `ACS_CONNECTION_STRING`, `ACS_SENDER_ADDRESS` | Left in place as the fallback |

---

## Switching to the IPELRA staff mailbox

There are two situations. Pick the one that matches.

### A. The IPELRA mailbox is in the **same** tenant (Community-Essentials.com)

e.g. you create `passport@community-essentials.com` or `ipelra@community-essentials.com`.

1. Create the mailbox (M365 admin center → Users → Add user, or a **shared
   mailbox** — shared mailboxes work and don't need a licence).
2. Change one setting:
   ```powershell
   az functionapp config appsettings set -n func-ipelra-xokxr7c5kfc64 -g conferenceapp `
     --settings "GRAPH_SENDER_ADDRESS=passport@community-essentials.com"
   ```
3. Optionally rename the display: `"EMAIL_FROM_NAME=IPELRA Conference Passport"`.
4. Done — takes effect on the next request, no redeploy. Send yourself a test
   link from the live login page to confirm.

If you set up the [mailbox restriction](#recommended-hardening-restrict-the-app-to-one-mailbox)
below, add the new mailbox to that group first.

### B. The IPELRA mailbox is in a **different** tenant (e.g. `@ipelra.org` on IPELRA's own M365)

The app registration lives in a tenant; it can only send as mailboxes in *that*
tenant. So a new registration is needed in IPELRA's tenant. **Someone who is a
Global Administrator of IPELRA's tenant** must do steps 1–4 (or grant you that
role). This is ~10 minutes.

1. **Create the app registration** in IPELRA's tenant:
   ```powershell
   az login --tenant <IPELRA-tenant-id-or-domain>
   $app = az ad app create --display-name "IPELRA Passport Mailer" --sign-in-audience AzureADMyOrg --query appId -o tsv
   az ad sp create --id $app | Out-Null
   ```
2. **Add the `Mail.Send` application permission and grant consent:**
   ```powershell
   az ad app permission add --id $app --api 00000003-0000-0000-c000-000000000000 `
     --api-permissions b633e1c5-b582-4048-a93e-9f11b44c7e96=Role
   # Grant admin consent (Global Admin required):
   $sp      = az ad sp show --id $app --query id -o tsv
   $graphSp = az ad sp list --filter "appId eq '00000003-0000-0000-c000-000000000000'" --query "[0].id" -o tsv
   @{ principalId=$sp; resourceId=$graphSp; appRoleId="b633e1c5-b582-4048-a93e-9f11b44c7e96" } |
     ConvertTo-Json -Compress | Set-Content "$env:TEMP\consent.json" -Encoding ascii
   az rest --method POST --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp/appRoleAssignments" `
     --headers "Content-Type=application/json" --body "@$env:TEMP\consent.json"
   Remove-Item "$env:TEMP\consent.json"
   ```
   (Or in the portal: Entra ID → App registrations → the app → API permissions →
   Add → Microsoft Graph → Application → `Mail.Send` → **Grant admin consent**.)
3. **Create a client secret** and put everything in the Function App in one go
   (the secret is never echoed):
   ```powershell
   $secret = az ad app credential reset --id $app --display-name "func-ipelra" --years 1 --query password -o tsv
   $tenant = az account show --query tenantId -o tsv
   az functionapp config appsettings set -n func-ipelra-xokxr7c5kfc64 -g conferenceapp --settings `
     "GRAPH_TENANT_ID=$tenant" "GRAPH_CLIENT_ID=$app" "GRAPH_CLIENT_SECRET=$secret" `
     "GRAPH_SENDER_ADDRESS=passport@ipelra.org" "EMAIL_PROVIDER=graph"
   ```
   (Run this with `az login` pointed at the subscription that owns the Function
   App — `Microsoft Azure Sponsorship`.)
4. **Test**: request a login link from the live site for your own address.
5. **Clean up** the old registration in Community-Essentials.com when you're
   confident: Entra ID → App registrations → IPELRA Passport Mailer → Delete.

> **Deliverability tip:** whichever mailbox sends, make sure its domain has SPF
> and DKIM set up in M365 (Microsoft 365 admin → Settings → Domains → DNS
> records). This is normal for any M365 domain that sends mail and is almost
> certainly already done; it's what keeps the links out of spam.

---

## Recommended hardening: restrict the app to one mailbox

`Mail.Send` (Application) technically lets the app send as **any** mailbox in the
tenant. Exchange lets you scope it to just the passport mailbox. This wasn't
done automatically because it needs an interactive Exchange sign-in. **Run once,
as a Global Admin, in a normal (interactive) PowerShell window:**

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
Connect-ExchangeOnline -UserPrincipalName jeubanks@Community-Essentials.com

# A mail-enabled security group holding the mailbox(es) the app may send as
New-DistributionGroup -Name "IPELRA Passport Senders" -Type Security `
  -Members "jeubanks@Community-Essentials.com"

New-ApplicationAccessPolicy -AppId dda92421-b667-4205-af2e-8fb0c9dae0b7 `
  -PolicyScopeGroupId "IPELRA Passport Senders" -AccessRight RestrictAccess `
  -Description "Passport app may only send as members of this group"

# Verify (Granted = allowed; try any other address to confirm Denied)
Test-ApplicationAccessPolicy -AppId dda92421-b667-4205-af2e-8fb0c9dae0b7 -Identity jeubanks@Community-Essentials.com
```

Policies take up to ~30 minutes to apply. When you switch sender mailbox later,
add it to the group: `Add-DistributionGroupMember "IPELRA Passport Senders" -Member passport@…`.

---

## Rotating the client secret

The secret expires one year after creation (**~September 2027**). To rotate:

```powershell
$secret = az ad app credential reset --id dda92421-b667-4205-af2e-8fb0c9dae0b7 --display-name "func-ipelra" --years 1 --query password -o tsv
az functionapp config appsettings set -n func-ipelra-xokxr7c5kfc64 -g conferenceapp --settings "GRAPH_CLIENT_SECRET=$secret"
```

No redeploy needed. `credential reset` replaces the old secret, so do both lines together.

---

## Reverting to ACS (emergency only)

```powershell
az functionapp config appsettings set -n func-ipelra-xokxr7c5kfc64 -g conferenceapp --settings "EMAIL_PROVIDER=acs"
```

Remember the 10/hour cap — this is a fallback for a handful of emails, not for
conference morning.

---

## Checking it's healthy

- **Admin portal → Export → System status** shows an **Email sending** line with
  the active provider and sender. Red if Graph is selected but misconfigured,
  or if ACS-on-a-test-domain is the primary.
- **Application Insights** (`appi-ipelra-passport`) — a failed primary send logs
  `[email] graph send failed for <address>: …`; a total failure logs
  `[sendMagicLink] email send failed for <address>`.
- **Local dev**: set the same `GRAPH_*` values plus `EMAIL_PROVIDER=graph` in
  `api/local.settings.json` (gitignored). `APP_URL` should be `http://localhost:5173`
  so test links open the Vite dev server.
