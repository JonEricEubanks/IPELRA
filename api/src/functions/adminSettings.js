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

const VALID_TIERS = ['partnership', 'leadership'];

function validateSponsorBody(body) {
  const errors = [];
  if (!body.name?.trim()) errors.push('name is required');
  if (!VALID_TIERS.includes(body.tier)) errors.push(`tier must be one of: ${VALID_TIERS.join(', ')}`);
  if (!body.promptQuestion?.trim()) errors.push('promptQuestion is required');
  if (!body.promptAnswerKeyword?.trim()) errors.push('promptAnswerKeyword is required');
  if (body.pointValue != null && (isNaN(Number(body.pointValue)) || Number(body.pointValue) < 0)) {
    errors.push('pointValue must be a non-negative number');
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
    return new Response(JSON.stringify({ sponsors }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const errors = validateSponsorBody(body);
    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join('; ') }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const pointValues = { partnership: 100, leadership: 150 };
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
    return new Response(JSON.stringify({ sponsor: created }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Sponsor not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    let body;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const errors = validateSponsorBody(body);
    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join('; ') }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const pointValues = { partnership: 100, leadership: 150 };
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
    return new Response(JSON.stringify({ sponsor: updated }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Sponsor not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    let patch;
    try { patch = await request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Allow only safe patchable fields
    const allowedPatchFields = [
      'name', 'logoUrl', 'tagline', 'description', 'website', 'tier', 'pointValue',
      'promptQuestion', 'promptAnswerKeyword', 'isActive', 'displayOrder',
    ];
    const doc = { ...existing };
    for (const field of allowedPatchFields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        doc[field] = patch[field];
      }
    }

    const updated = await upsertSponsor(doc);
    return new Response(JSON.stringify({ sponsor: updated }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Sponsor not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteSponsor(id);
    return new Response(null, { status: 204 });
  },
});
