// ============================================================
// Azure Function App — Windows Consumption Plan (Y1)
// Project: IPELRA Conference Passport
// Runtime: Node.js 20 / Azure Functions v4
// ============================================================

@description('Azure region for all resources')
param location string

@description('Resource tags')
param tags object

@description('Unique suffix derived from resource group ID for globally unique names')
param uniqueSuffix string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Application Insights instrumentation key')
param appInsightsInstrumentationKey string

@description('Cosmos DB primary connection string')
@secure()
param cosmosConnectionString string

@description('JWT secret for signing attendee session tokens (min 32 chars)')
@secure()
param jwtSecret string

@description('ACS primary connection string')
@secure()
param acsConnectionString string

@description('ACS sender email address (e.g. DoNotReply@<domain>.azurecomm.net)')
param acsSenderAddress string

@description('Comma-separated admin Google email addresses authorized for the admin portal')
@secure()
param adminEmails string

@description('Points required for passport completion (tunable without redeploy)')
param completionThresholdPoints string

@description('"true" = passport live, "false" = Coming Soon screen')
param passportLive string

@description('Passport lock datetime in UTC ISO 8601 (2026-10-11T00:00:00Z = 7pm CT Oct 10)')
param passportLockUtc string

@description('Long random token for the emergency export endpoint')
@secure()
param exportSecret string

@description('Conference year for data partitioning and year-to-year archive')
param conferenceYear string

// ── Resource Names ────────────────────────────────────────────
// Storage name: 3-24 chars, lowercase alphanumeric only
// uniqueString() returns 13 lowercase hex chars — safe here
var storageAccountName = 'stipelra${uniqueSuffix}'
var functionAppName = 'func-ipelra-${uniqueSuffix}'
var appServicePlanName = 'asp-ipelra-passport'

// Build storage connection string inline (standard pattern)
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// ── Storage Account (required backing store for Functions) ───
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// ── App Service Plan — Consumption (Y1 Dynamic) ──────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: false // Windows host
  }
}

// ── Function App ──────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      // CORS: allows local dev origins.
      // ⚠️ POST-DEPLOY: add the SWA production URL.
      // Run: az functionapp cors add --resource-group conferenceapp
      //   --name <functionAppName> --allowed-origins <swa-url>
      cors: {
        allowedOrigins: [
          'http://localhost:5173'  // Vite dev server
          'http://localhost:4280'  // SWA CLI local emulator
          'https://portal.azure.com'
        ]
        supportCredentials: false
      }
      appSettings: [
        // ── Functions infrastructure ─────────────────────────
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: storageConnectionString
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        // ── Monitoring ───────────────────────────────────────
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsightsInstrumentationKey
        }
        // ── Data / Auth ──────────────────────────────────────
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: cosmosConnectionString
        }
        {
          name: 'JWT_SECRET'
          value: jwtSecret
        }
        // ── Email ─────────────────────────────────────────────
        {
          name: 'ACS_CONNECTION_STRING'
          value: acsConnectionString
        }
        {
          name: 'ACS_SENDER_ADDRESS'
          value: acsSenderAddress
        }
        // ── Admin access ─────────────────────────────────────
        {
          name: 'ADMIN_EMAILS'
          value: adminEmails
        }
        {
          name: 'EXPORT_SECRET'
          value: exportSecret
        }
        // ── Conference configuration ──────────────────────────
        {
          name: 'COMPLETION_THRESHOLD_POINTS'
          value: completionThresholdPoints
        }
        {
          name: 'PASSPORT_LIVE'
          value: passportLive
        }
        {
          name: 'PASSPORT_LOCK_UTC'
          value: passportLockUtc
        }
        {
          name: 'CONFERENCE_YEAR'
          value: conferenceYear
        }
      ]
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────
output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output functionAppDefaultHostname string = functionApp.properties.defaultHostName
output storageAccountName string = storageAccount.name
