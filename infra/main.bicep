// ============================================================
// main.bicep — IPELRA Conference Passport Infrastructure
// Target scope: Resource Group (conferenceapp)
// Region: East US 2
// Cost target: ~$0.09/month (all free/consumption tiers)
// ============================================================

targetScope = 'resourceGroup'

// ── Parameters ───────────────────────────────────────────────

@description('Azure region for all resources')
param location string = 'eastus2'

@description('Project tag value applied to all resources')
param projectTag string = 'ipelra-passport'

@description('Environment tag value applied to all resources')
param envTag string = 'mvp'

@description('JWT secret for signing attendee session tokens (minimum 32 characters)')
@secure()
param jwtSecret string

@description('Comma-separated Google email addresses authorized for the admin portal (e.g. "admin@city.gov,staff@ipelra.org")')
@secure()
param adminEmails string

@description('Long random token for the emergency CSV export endpoint (no Google auth required)')
@secure()
param exportSecret string

@description('Points required to complete the passport. Default 1000 — adjust after final sponsor count is confirmed. Tunable without redeployment via Azure portal > Function App > Configuration.')
param completionThresholdPoints string = '1000'

@description('"true" = passport is live for attendees. "false" = Coming Soon screen is shown. Set to "true" the morning of Oct 5, 2026.')
param passportLive string = 'false'

@description('UTC datetime when the passport locks. 2026-10-11T00:00:00Z = midnight UTC = 7pm Central Oct 10. Checked server-side — cannot be manipulated by client clock.')
param passportLockUtc string = '2026-10-11T00:00:00Z'

@description('Conference year for data partitioning and year-to-year archive support')
param conferenceYear string = '2026'

// ── Variables ─────────────────────────────────────────────────

var tags = {
  project: projectTag
  env: envTag
}

// Deterministic 13-char lowercase hex string from resource group ID.
// Used to ensure globally unique names for Storage, Function App, Cosmos DB.
var uniqueSuffix = uniqueString(resourceGroup().id)

// ── Module: Application Insights ─────────────────────────────
module appInsights 'modules/appInsights.bicep' = {
  name: 'appInsightsDeploy'
  params: {
    location: location
    tags: tags
  }
}

// ── Module: Cosmos DB (Serverless) ───────────────────────────
module cosmosDb 'modules/cosmosDb.bicep' = {
  name: 'cosmosDbDeploy'
  params: {
    location: location
    tags: tags
    uniqueSuffix: uniqueSuffix
  }
}

// ── Module: Azure Communication Services ─────────────────────
module communicationServices 'modules/communicationServices.bicep' = {
  name: 'communicationServicesDeploy'
  params: {
    tags: tags
  }
}

// ── Module: Function App ──────────────────────────────────────
// Depends on: appInsights, cosmosDb, communicationServices
// (implicit via parameter references to their outputs)
module functionApp 'modules/functionApp.bicep' = {
  name: 'functionAppDeploy'
  params: {
    location: location
    tags: tags
    uniqueSuffix: uniqueSuffix
    appInsightsConnectionString: appInsights.outputs.appInsightsConnectionString
    appInsightsInstrumentationKey: appInsights.outputs.appInsightsInstrumentationKey
    cosmosConnectionString: cosmosDb.outputs.cosmosConnectionString
    jwtSecret: jwtSecret
    acsConnectionString: communicationServices.outputs.acsConnectionString
    // Auto-configure sender address from provisioned Azure-managed domain.
    // To use a custom domain, replace this with your verified sender address
    // in Azure Portal > Function App > Configuration after custom domain setup.
    acsSenderAddress: 'DoNotReply@${communicationServices.outputs.senderDomain}'
    adminEmails: adminEmails
    completionThresholdPoints: completionThresholdPoints
    passportLive: passportLive
    passportLockUtc: passportLockUtc
    exportSecret: exportSecret
    conferenceYear: conferenceYear
  }
}

// ── Module: Static Web App ────────────────────────────────────
// Deployed last — outputs the SWA URL needed for the post-deploy
// CORS configuration on the Function App.
module staticWebApp 'modules/staticWebApp.bicep' = {
  name: 'staticWebAppDeploy'
  params: {
    location: location
    tags: tags
  }
}

// ── Deployment Outputs ────────────────────────────────────────
// These values are needed for post-deploy configuration steps.
// See README > Post-Deploy Steps.

@description('Public URL of the React SPA (attendee + admin portal)')
output appUrl string = 'https://${staticWebApp.outputs.staticWebAppDefaultHostname}'

@description('Azure Functions API base URL (use as VITE_API_BASE_URL in React build)')
output apiUrl string = 'https://${functionApp.outputs.functionAppDefaultHostname}'

@description('Static Web App resource name (for az staticwebapp deploy command)')
output staticWebAppName string = staticWebApp.outputs.staticWebAppName

@description('Function App resource name (for CORS update and deployment commands)')
output functionAppName string = functionApp.outputs.functionAppName

@description('Cosmos DB account name')
output cosmosAccountName string = cosmosDb.outputs.cosmosAccountName

@description('Application Insights name')
output appInsightsName string = appInsights.outputs.appInsightsName

@description('ACS sender address configured in Function App settings')
output acsSenderAddress string = 'DoNotReply@${communicationServices.outputs.senderDomain}'

@description('IMPORTANT: After deploy, add the appUrl to Function App CORS. See README.')
output postDeployReminder string = 'Run: az functionapp cors add --resource-group conferenceapp --name ${functionApp.outputs.functionAppName} --allowed-origins https://${staticWebApp.outputs.staticWebAppDefaultHostname}'
