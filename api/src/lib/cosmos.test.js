import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.COSMOS_CONNECTION_STRING = 'AccountEndpoint=https://x/;AccountKey=eA==;';

// Records what cosmos.js asks the SDK to do
const sdk = { itemArgs: null, patchOps: null, created: null };

mock.module('@azure/cosmos', {
  namedExports: {
    CosmosClient: class {
      database() {
        return {
          container: () => ({
            item: (id, pk) => {
              sdk.itemArgs = { id, pk };
              return { patch: async (ops) => { sdk.patchOps = ops; return { resource: { id } }; } };
            },
            items: { create: async (doc) => { sdk.created = doc; return { resource: doc }; } },
          }),
        };
      }
    },
  },
});

const cosmos = await import('./cosmos.js');

beforeEach(() => { sdk.itemArgs = null; sdk.patchOps = null; sdk.created = null; });

test('patchAttendee: sends one "set" op per field, addressed by id + normalised email partition key', async () => {
  await cosmos.patchAttendee('a1', '  Ann@Example.com ', { firstName: 'Ann', magicLinkTokens: [] });
  assert.deepEqual(sdk.itemArgs, { id: 'a1', pk: 'ann@example.com' });
  assert.deepEqual(sdk.patchOps, [
    { op: 'set', path: '/firstName', value: 'Ann' },
    { op: 'set', path: '/magicLinkTokens', value: [] },
  ]);
});

test('patchAttendee: never touches points or stamps unless asked to', async () => {
  await cosmos.patchAttendee('a1', 'ann@example.com', { lastName: 'Lee' });
  assert.ok(sdk.patchOps.every(op => !['/totalPoints', '/completedStamps'].includes(op.path)));
});

test('createAttendee: uses create (not upsert) so an existing id raises a conflict', async () => {
  const doc = { id: 'a1', email: 'ann@example.com' };
  await cosmos.createAttendee(doc);
  assert.deepEqual(sdk.created, doc);
});
