// ============================================================
// Cosmos DB — Serverless NoSQL
// Project: IPELRA Conference Passport
// Containers: sponsors, attendees, checkins
// ============================================================

@description('Azure region for all resources')
param location string

@description('Resource tags')
param tags object

@description('Unique suffix derived from resource group ID for globally unique names')
param uniqueSuffix string

var cosmosAccountName = 'cosmos-ipelra-${uniqueSuffix}'
var databaseName = 'ipelra-passport'

// ── Cosmos DB Account (Serverless) ───────────────────────────
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    // Serverless mode — no provisioned RU/s, scales automatically
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    publicNetworkAccess: 'Enabled'
    // Serverless accounts use Periodic backup (default) — Continuous not supported
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
        backupStorageRedundancy: 'Local'
      }
    }
  }
}

// ── Database ─────────────────────────────────────────────────
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// ── Container: sponsors (partition key: /id) ─────────────────
// Holds all sponsor records. isActive defaults to false.
// Admin explicitly activates each sponsor before go-live.
resource sponsorsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'sponsors'
  properties: {
    resource: {
      id: 'sponsors'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}

// ── Container: attendees (partition key: /email) ─────────────
// One document per attendee email. Holds session token hash,
// points total, completed stop IDs, and completion status.
resource attendeesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'attendees'
  properties: {
    resource: {
      id: 'attendees'
      partitionKey: {
        paths: ['/email']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}

// ── Container: checkins (partition key: /attendeeId) ─────────
// One document per attendee+sponsor combination.
// Unique key on /sponsorId within each attendee partition
// prevents duplicate check-ins (idempotent write protection).
resource checkinsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'checkins'
  properties: {
    resource: {
      id: 'checkins'
      partitionKey: {
        paths: ['/attendeeId']
        kind: 'Hash'
        version: 2
      }
      // Within one attendee's partition, sponsorId must be unique.
      // This enforces: each attendee can check in to each sponsor at most once.
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: ['/sponsorId']
          }
        ]
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────
output cosmosAccountName string = cosmosAccount.name
output cosmosDatabaseName string = databaseName
// Connection string retrieved at deploy time and injected into Function App settings
output cosmosConnectionString string = cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
