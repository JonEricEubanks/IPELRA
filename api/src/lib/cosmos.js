/**
 * cosmos.js — Cosmos DB client + typed helpers
 *
 * All DB operations go through this module. Re-uses a single
 * CosmosClient instance per Function App warm instance.
 */

import { CosmosClient } from '@azure/cosmos';

// ── Client singleton ──────────────────────────────────────────────────────────
let _client = null;

function getClient() {
  if (!_client) {
    const connStr = process.env.COSMOS_CONNECTION_STRING;
    if (!connStr) throw new Error('COSMOS_CONNECTION_STRING is not set');
    _client = new CosmosClient(connStr);
  }
  return _client;
}

const DB_NAME = 'ipelra-passport';

function db() {
  return getClient().database(DB_NAME);
}

// ── Container handles ─────────────────────────────────────────────────────────
export const sponsors    = () => db().container('sponsors');
export const attendees   = () => db().container('attendees');
export const checkins    = () => db().container('checkins');

// ── Sponsors ──────────────────────────────────────────────────────────────────

/**
 * Returns all active sponsors sorted by displayOrder.
 */
export async function getActiveSponsors() {
  const { resources } = await sponsors().items
    .query({
      query: 'SELECT * FROM c WHERE c.isActive = true ORDER BY c.displayOrder',
    })
    .fetchAll();
  return resources;
}

/**
 * Returns a single sponsor by id (cross-partition read is fine for admin ops).
 */
export async function getSponsorById(id) {
  const { resource } = await sponsors().item(id, id).read();
  return resource ?? null;
}

/**
 * Upserts a sponsor document. Caller is responsible for supplying the full doc.
 */
export async function upsertSponsor(doc) {
  const { resource } = await sponsors().items.upsert(doc);
  return resource;
}

/**
 * Returns ALL sponsors (active and inactive), sorted by displayOrder.
 * Used by admin endpoints.
 */
export async function getAllSponsors() {
  const { resources } = await sponsors().items
    .query('SELECT * FROM c ORDER BY c.displayOrder')
    .fetchAll();
  return resources;
}

// ── Attendees ─────────────────────────────────────────────────────────────────

/**
 * Finds an attendee by email. Returns null if not found.
 * Partition key = /email so this is a single-partition query.
 */
export async function getAttendeeByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const { resources } = await attendees().items
    .query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: normalizedEmail }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

/**
 * Finds an attendee by their UUID id.
 * Requires email (partition key) OR uses cross-partition query.
 * Prefer passing email for efficiency; falls back to cross-partition query if email is unknown.
 */
export async function getAttendeeById(id, email = null) {
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const { resource } = await attendees().item(id, normalizedEmail).read();
    return resource ?? null;
  }
  // Cross-partition query (admin lookup by id only)
  const { resources } = await attendees().items
    .query({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

/**
 * Upserts an attendee document.
 */
export async function upsertAttendee(doc) {
  const { resource } = await attendees().items.upsert(doc);
  return resource;
}

/**
 * Returns ALL attendees for the current conference year.
 * Used by admin export and metrics.
 */
export async function getAllAttendees(conferenceYear) {
  const year = Number(conferenceYear);
  const { resources } = await attendees().items
    .query({
      query: 'SELECT * FROM c WHERE c.conferenceYear = @year',
      parameters: [{ name: '@year', value: year }],
    })
    .fetchAll();
  return resources;
}

// ── Check-ins ─────────────────────────────────────────────────────────────────

/**
 * Returns all check-ins for a given attendee (single partition).
 */
export async function getCheckinsByAttendee(attendeeId) {
  const { resources } = await checkins().items
    .query({
      query: 'SELECT * FROM c WHERE c.attendeeId = @attendeeId',
      parameters: [{ name: '@attendeeId', value: attendeeId }],
    })
    .fetchAll();
  return resources;
}

/**
 * Writes a new check-in document.
 * Cosmos unique key (/sponsorId within /attendeeId partition) prevents duplicates.
 * Throws a 409 CosmosDB error if a duplicate is attempted.
 */
export async function createCheckin(doc) {
  const { resource } = await checkins().items.create(doc);
  return resource;
}

/**
 * Returns all check-ins for the current conference year.
 * Cross-partition — used by admin metrics and export.
 */
export async function getAllCheckins(conferenceYear) {
  const year = Number(conferenceYear);
  const { resources } = await checkins().items
    .query({
      query: 'SELECT * FROM c WHERE c.conferenceYear = @year',
      parameters: [{ name: '@year', value: year }],
    })
    .fetchAll();
  return resources;
}

/**
 * Returns all flagged (rejected) answers grouped by sponsorId.
 * A "flagged" answer is a checkin with attemptCount > 1 or rejectedAnswers.length > 0.
 */
export async function getFlaggedAnswers(conferenceYear) {
  const year = Number(conferenceYear);
  const { resources } = await checkins().items
    .query({
      query: `SELECT * FROM c
              WHERE c.conferenceYear = @year
                AND (c.attemptCount > 1 OR ARRAY_LENGTH(c.rejectedAnswers) > 0)
              ORDER BY c.timestamp DESC`,
      parameters: [{ name: '@year', value: year }],
    })
    .fetchAll();
  return resources;
}
