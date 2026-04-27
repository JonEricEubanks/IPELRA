// ============================================================
// Azure Static Web App — Free Tier
// Project: IPELRA Conference Passport
// Hosts: React SPA (attendee UI + admin portal)
// NOTE: API (Azure Functions) is a separate resource.
//       See functionApp.bicep.
// ============================================================

@description('Azure region for all resources')
param location string

@description('Resource tags')
param tags object

// ── Static Web App (Free) ─────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: 'swa-ipelra-passport'
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
    // Build configuration is handled at deploy time via
    // 'az staticwebapp deploy' or GitHub Actions workflow.
    // staticwebapp.config.json in the app output handles routing.
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────
output staticWebAppName string = staticWebApp.name
// Auto-generated hostname (format: <random>.azurestaticapps.net)
// Known only after deployment — needed to:
//   1. Configure CORS on the Function App
//   2. Register the Google OAuth redirect URI
//   3. Set VITE_API_BASE_URL in the React build
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output staticWebAppId string = staticWebApp.id
