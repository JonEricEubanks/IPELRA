import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const timers = {};
const cosmos = { failWith: null };

mock.module('@azure/functions', {
  namedExports: { app: { timer(name, options) { timers[name] = options; } } },
});
mock.module(import.meta.resolve('../lib/cosmos.js'), {
  namedExports: {
    async getAllSponsors() {
      if (cosmos.failWith) throw cosmos.failWith;
      return [{ id: 's1' }, { id: 's2' }];
    },
  },
});

await import('./warmup.js');
const { schedule, handler } = timers.warmup;

function fakeContext() {
  const ctx = { logs: [], errors: [] };
  ctx.log   = (...args) => ctx.logs.push(args.join(' '));
  ctx.error = (...args) => ctx.errors.push(args.join(' '));
  return ctx;
}

test('warmup: runs every 10 minutes, 11:00-22:59 UTC, Oct 5-10 (whole conference)', () => {
  assert.equal(schedule, '0 */10 11-22 5-10 10 *');
});

test('warmup: logs the sponsor count on success', async () => {
  cosmos.failWith = null;
  const ctx = fakeContext();
  await handler({}, ctx);
  assert.match(ctx.logs[0], /2 sponsors/);
  assert.equal(ctx.errors.length, 0);
});

test('warmup: a Cosmos failure is logged via context.error instead of crashing', async () => {
  cosmos.failWith = new Error('Cosmos down');
  const ctx = fakeContext();
  await handler({}, ctx);
  assert.match(ctx.errors[0], /Cosmos down/);
});
