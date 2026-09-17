/**
 * adminSettings.js — Sponsor CRUD for admin portal
 *
 * GET    /api/mgmt/sponsors          — list all sponsors (including inactive)
 * POST   /api/mgmt/sponsors          — create a new sponsor
 * PUT    /api/mgmt/sponsors/:id      — update a sponsor (full replace semantics)
 * PATCH  /api/mgmt/sponsors/:id      — partial update (e.g., toggle isActive)
 *
 * Auth: Admin JWT
 */

import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAdminAuth, forbiddenResponse } from '../lib/auth.js';
import { getAllSponsors, getSponsorById, upsertSponsor, deleteSponsor } from '../lib/cosmos.js';
import { jsonResponse as json } from '../lib/http.js';

const VALID_TIERS = ['partnership', 'leadership'];
const DEFAULT_POINT_VALUES = { partnership: 100, leadership: 150 };

/**
 * Validates a sponsor body. With `partial: true` only fields present in the
 * body are checked (PATCH semantics).
 */
function validateSponsorBody(body, { partial = false } = {}) {
  const has = (field) => !partial || Object.prototype.hasOwnProperty.call(body, field);
  const errors = [];
  if (has('name') && !body.name?.trim()) errors.push('name is required');
  if (has('tier') && !VALID_TIERS.includes(body.tier)) errors.push(`tier must be one of: ${VALID_TIERS.join(', ')}`);
  if (has('promptQuestion') && !body.promptQuestion?.trim()) errors.push('promptQuestion is required');
  if (has('promptAnswerKeyword') && !body.promptAnswerKeyword?.trim()) errors.push('promptAnswerKeyword is required');
  if (has('pointValue') && body.pointValue != null && (isNaN(Number(body.pointValue)) || Number(body.pointValue) < 0)) {
    errors.push('pointValue must be a non-negative number');
  }
  if (has('isActive') && body.isActive != null && typeof body.isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }
  if (has('displayOrder') && body.displayOrder != null && !Number.isFinite(Number(body.displayOrder))) {
    errors.push('displayOrder must be a number');
  }
  return errors;
}

// GET /api/mgmt/sponsors
app.http('adminGetSponsors', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/sponsors',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const sponsors = await getAllSponsors();
    return json(200, { sponsors });
  },
});

// POST /api/mgmt/sponsors
app.http('adminCreateSponsor', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/sponsors',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    let body;
    try { body = await request.json(); } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    const errors = validateSponsorBody(body);
    if (errors.length) {
      return json(400, { error: errors.join('; ') });
    }

    const pointValues = DEFAULT_POINT_VALUES;
    const now = new Date().toISOString();
    const allSponsors = await getAllSponsors();
    const maxOrder = allSponsors.reduce((m, s) => Math.max(m, s.displayOrder ?? 0), 0);

    const doc = {
      id:                   uuidv4(),
      name:                 body.name.trim(),
      logoUrl:              body.logoUrl?.trim() || null,
      tagline:              body.tagline?.trim() || '',
      description:          body.description?.trim() || null,
      website:              body.website?.trim() || null,
      tier:                 body.tier,
      pointValue:           body.pointValue != null ? Number(body.pointValue) : pointValues[body.tier],
      promptQuestion:       body.promptQuestion.trim(),
      promptAnswerKeyword:  body.promptAnswerKeyword.trim(),
      isActive:             body.isActive === true,
      displayOrder:         typeof body.displayOrder === 'number' ? body.displayOrder : maxOrder + 10,
      createdAt:            now,
    };

    const created = await upsertSponsor(doc);
    return json(201, { sponsor: created });
  },
});

// PUT /api/mgmt/sponsors/{id}
app.http('adminUpdateSponsor', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'mgmt/sponsors/{id}',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const id = request.params.id;
    const existing = await getSponsorById(id);
    if (!existing) {
      return json(404, { error: 'Sponsor not found' });
    }

    let body;
    try { body = await request.json(); } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    const errors = validateSponsorBody(body);
    if (errors.length) {
      return json(400, { error: errors.join('; ') });
    }

    const pointValues = DEFAULT_POINT_VALUES;
    const doc = {
      ...existing,
      name:                body.name.trim(),
      logoUrl:             body.logoUrl?.trim() || null,
      tagline:             body.tagline?.trim() || '',
      description:         body.description?.trim() || null,
      website:             body.website?.trim() || null,
      tier:                body.tier,
      pointValue:          body.pointValue != null ? Number(body.pointValue) : pointValues[body.tier],
      promptQuestion:      body.promptQuestion.trim(),
      promptAnswerKeyword: body.promptAnswerKeyword.trim(),
      isActive:            body.isActive === true,
      displayOrder:        typeof body.displayOrder === 'number' ? body.displayOrder : existing.displayOrder,
    };

    const updated = await upsertSponsor(doc);
    return json(200, { sponsor: updated });
  },
});

// PATCH /api/mgmt/sponsors/{id} — partial update (isActive, displayOrder, etc.)
app.http('adminPatchSponsor', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'mgmt/sponsors/{id}',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const id = request.params.id;
    const existing = await getSponsorById(id);
    if (!existing) {
      return json(404, { error: 'Sponsor not found' });
    }

    let patch;
    try { patch = await request.json(); } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    // Allow only safe patchable fields
    const allowedPatchFields = [
      'name', 'logoUrl', 'tagline', 'description', 'website', 'tier', 'pointValue',
      'promptQuestion', 'promptAnswerKeyword', 'isActive', 'displayOrder',
    ];
    const filtered = {};
    for (const field of allowedPatchFields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) filtered[field] = patch[field];
    }

    const errors = validateSponsorBody(filtered, { partial: true });
    if (errors.length) {
      return json(400, { error: errors.join('; ') });
    }

    // Coerce so Cosmos never stores numeric fields as strings
    if (filtered.pointValue != null)   filtered.pointValue   = Number(filtered.pointValue);
    if (filtered.displayOrder != null) filtered.displayOrder = Number(filtered.displayOrder);
    for (const field of ['name', 'promptQuestion', 'promptAnswerKeyword']) {
      if (typeof filtered[field] === 'string') filtered[field] = filtered[field].trim();
    }

    const doc = { ...existing, ...filtered };

    const updated = await upsertSponsor(doc);
    return json(200, { sponsor: updated });
  },
});

// DELETE /api/mgmt/sponsors/{id}
app.http('adminDeleteSponsor', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'mgmt/sponsors/{id}',
  handler: async (request) => {
    try { requireAdminAuth(request); } catch (err) { return forbiddenResponse(err.message); }

    const id = request.params.id;
    const existing = await getSponsorById(id);
    if (!existing) {
      return json(404, { error: 'Sponsor not found' });
    }

    await deleteSponsor(id);
    return new Response(null, { status: 204 });
  },
});
