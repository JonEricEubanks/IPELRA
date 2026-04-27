// ============================================================
// Application Insights + Log Analytics Workspace
// Project: IPELRA Conference Passport
// ============================================================

@description('Azure region for all resources')
param location string

@description('Resource tags')
param tags object

// ── Log Analytics Workspace ──────────────────────────────────
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-ipelra-passport'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ── Application Insights (workspace-based) ──────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-ipelra-passport'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Outputs ──────────────────────────────────────────────────
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsName string = appInsights.name
