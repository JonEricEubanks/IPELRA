import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ACS client double — records sends and can be told to fail
const acs = { sends: [], failNext: false };
mock.module('@azure/communication-email', {
  namedExports: {
    EmailClient: class {
      async beginSend(message) {
        if (acs.failNext) { acs.failNext = false; throw new Error('ACS down'); }
        acs.sends.push(message);
        return { pollUntilDone: async () => ({ status: 'Succeeded', id: 'acs-123' }) };
      }
    },
  },
});

const email = await import('./email.js');

const GRAPH_ENV = {
  GRAPH_TENANT_ID: 't', GRAPH_CLIENT_ID: 'c', GRAPH_CLIENT_SECRET: 's', GRAPH_SENDER_ADDRESS: 'passport@example.com',
};
const ACS_ENV = { ACS_CONNECTION_STRING: 'endpoint=x;accesskey=y', ACS_SENDER_ADDRESS: 'donotreply@abc.azurecomm.net' };

const realFetch = globalThis.fetch;
const graph = { calls: [], sendStatus: 202, tokenStatus: 200, failSenders: new Set() };

function fakeFetch(url, init) {
  const u = String(url);
  if (u.includes('/oauth2/v2.0/token')) {
    graph.calls.push({ kind: 'token' });
    return new Response(JSON.stringify(graph.tokenStatus === 200 ? { access_token: 'tok', expires_in: 3600 } : { error: 'invalid_client' }), { status: graph.tokenStatus });
  }
  if (u.includes('/sendMail')) {
    const body = JSON.parse(init.body);
    graph.calls.push({ kind: 'send', url: u, body, auth: init.headers.Authorization });
    const status = graph.failSenders.has(body.message.from.emailAddress.address) ? 429 : graph.sendStatus;
    return new Response(status === 202 ? null : '{"error":"boom"}', { status, headers: { 'request-id': 'req-1' } });
  }
  throw new Error('unexpected fetch ' + u);
}

function setEnv(vars) {
  for (const k of ['EMAIL_PROVIDER', 'EMAIL_FROM_NAME', ...Object.keys(GRAPH_ENV), ...Object.keys(ACS_ENV)]) delete process.env[k];
  Object.assign(process.env, vars);
}

beforeEach(() => {
  acs.sends = []; acs.failNext = false;
  graph.calls = []; graph.sendStatus = 202; graph.tokenStatus = 200; graph.failSenders = new Set();
  globalThis.fetch = fakeFetch;
  email._resetForTests();
});
afterEach(() => { globalThis.fetch = realFetch; });

test('resolveProviders: honours EMAIL_PROVIDER and lists the other as fallback', () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, ...ACS_ENV });
  assert.deepEqual(email.resolveProviders(), ['graph', 'acs']);
  setEnv({ EMAIL_PROVIDER: 'acs', ...GRAPH_ENV, ...ACS_ENV });
  assert.deepEqual(email.resolveProviders(), ['acs', 'graph']);
});

test('resolveProviders: unset provider prefers graph when configured, else acs; throws when nothing is', () => {
  setEnv({ ...GRAPH_ENV, ...ACS_ENV });
  assert.deepEqual(email.resolveProviders(), ['graph', 'acs']);
  setEnv({ ...ACS_ENV });
  assert.deepEqual(email.resolveProviders(), ['acs']);
  setEnv({});
  assert.throws(() => email.resolveProviders(), /No email provider configured/);
});

test('graph: sends as the configured mailbox with the display name, reusing the token', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', EMAIL_FROM_NAME: 'IPELRA Conference Passport', ...GRAPH_ENV });
  const id1 = await email.sendMagicLinkEmail('ann@x.com', 'raw-token', 'Ann', null);
  const id2 = await email.sendCompletionEmail('ann@x.com', 'Ann', '2026-10-05T16:00:00Z');
  assert.match(id1, /^graph:/);
  assert.match(id2, /^graph:/);

  const tokenCalls = graph.calls.filter(c => c.kind === 'token');
  const sendCalls  = graph.calls.filter(c => c.kind === 'send');
  assert.equal(tokenCalls.length, 1, 'token cached across sends');
  assert.equal(sendCalls.length, 2);
  assert.match(sendCalls[0].url, /\/users\/passport%40example\.com\/sendMail$/);
  assert.equal(sendCalls[0].auth, 'Bearer tok');
  const m = sendCalls[0].body.message;
  assert.equal(m.from.emailAddress.address, 'passport@example.com');
  assert.equal(m.from.emailAddress.name, 'IPELRA Conference Passport');
  assert.deepEqual(m.toRecipients, [{ emailAddress: { address: 'ann@x.com' } }]);
  assert.equal(m.body.contentType, 'HTML');
  assert.match(m.body.content, /verify\?token=raw-token/);
  assert.match(m.body.content, /<img src="https:\/\/res\.cloudinary\.com\/[^"]+\/f_png\/[^"]+IPELRA-Logo\.png" alt="IPELRA"/, 'hosted PNG logo');
  assert.match(m.body.content, /IPELRA Annual Conference 2026 &middot; Conference Passport/, 'text band shows even when images are blocked');
  assert.deepEqual(m.attachments, [], 'no attachments \u2014 they trigger ~5 min Safe Attachments holds');
  assert.equal(sendCalls[0].body.saveToSentItems, false);
  assert.equal(acs.sends.length, 0, 'ACS not touched');
});

test('graph -> acs fallback: when Graph rejects, the email still goes out via ACS', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, ...ACS_ENV });
  graph.sendStatus = 429;
  const id = await email.sendMagicLinkEmail('ann@x.com', 'raw', null, null);
  assert.match(id, /^acs:/);
  assert.equal(acs.sends.length, 1);
  assert.equal(acs.sends[0].senderAddress, ACS_ENV.ACS_SENDER_ADDRESS);
});

test('all providers failing throws the last error so the caller can tell the user', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, ...ACS_ENV });
  graph.tokenStatus = 401;
  acs.failNext = true;
  await assert.rejects(() => email.sendMagicLinkEmail('ann@x.com', 'raw', null, null), /ACS down/);
});

test('parseSenders: splits comma/semicolon/space lists and drops blanks + duplicates', () => {
  assert.deepEqual(email.parseSenders('a@x.com, b@x.com;c@x.com  a@x.com,'), ['a@x.com', 'b@x.com', 'c@x.com']);
  assert.deepEqual(email.parseSenders(''), []);
  assert.deepEqual(email.parseSenders(undefined), []);
});

test('graph multi-mailbox: rotates the sender across mailboxes', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, GRAPH_SENDER_ADDRESS: 'p0@x.com,p1@x.com,p2@x.com' });
  for (let i = 0; i < 4; i++) await email.sendMagicLinkEmail(`u${i}@x.com`, 'raw', null, null);
  const froms = graph.calls.filter(c => c.kind === 'send').map(c => c.body.message.from.emailAddress.address);
  assert.deepEqual(froms, ['p0@x.com', 'p1@x.com', 'p2@x.com', 'p0@x.com']);
});

test('graph multi-mailbox: a throttled mailbox fails over to the next before trying ACS', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, ...ACS_ENV, GRAPH_SENDER_ADDRESS: 'p0@x.com,p1@x.com' });
  graph.failSenders = new Set(['p0@x.com']);
  const id = await email.sendMagicLinkEmail('ann@x.com', 'raw', null, null);
  assert.match(id, /^graph:/);
  const sends = graph.calls.filter(c => c.kind === 'send');
  assert.equal(sends.length, 2);
  assert.equal(sends[1].body.message.from.emailAddress.address, 'p1@x.com');
  assert.equal(acs.sends.length, 0);
});

test('graph multi-mailbox: when every mailbox fails, ACS is the last resort', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, ...ACS_ENV, GRAPH_SENDER_ADDRESS: 'p0@x.com,p1@x.com,p2@x.com' });
  graph.failSenders = new Set(['p0@x.com', 'p1@x.com', 'p2@x.com']);
  const id = await email.sendMagicLinkEmail('ann@x.com', 'raw', null, null);
  assert.match(id, /^acs:/);
  assert.equal(graph.calls.filter(c => c.kind === 'send').length, 3, 'each mailbox tried once');
  assert.equal(graph.calls.filter(c => c.kind === 'token').length, 1, 'one token shared by all mailboxes');
});

test('graph multi-mailbox: rotation keeps going past a failed mailbox (load stays spread)', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, GRAPH_SENDER_ADDRESS: 'p0@x.com,p1@x.com,p2@x.com' });
  graph.failSenders = new Set(['p1@x.com']);
  const used = [];
  for (let i = 0; i < 3; i++) {
    graph.calls = [];
    await email.sendMagicLinkEmail(`u${i}@x.com`, 'raw', null, null);
    const ok = graph.calls.filter(c => c.kind === 'send').pop();
    used.push(ok.body.message.from.emailAddress.address);
  }
  assert.deepEqual(used, ['p0@x.com', 'p2@x.com', 'p2@x.com']);
});

test('acs only: sends via ACS and never calls Graph', async () => {
  setEnv({ EMAIL_PROVIDER: 'acs', ...ACS_ENV });
  const id = await email.sendAdminMagicLinkEmail('admin@x.com', 'https://app/admin/verify?token=t');
  assert.equal(id, 'acs:acs-123');
  assert.equal(graph.calls.length, 0);
  assert.equal(acs.sends[0].content.subject, 'IPELRA Admin Login Link');
  assert.deepEqual(acs.sends[0].attachments, [], 'ACS path sends no attachments either');
  assert.match(acs.sends[0].content.html, /IPELRA Annual Conference 2026 &middot; Admin Portal/);
});

test('EMAIL_LOGO_URL overrides the logo without a redeploy', async () => {
  setEnv({ EMAIL_PROVIDER: 'graph', ...GRAPH_ENV, EMAIL_LOGO_URL: 'https://example.org/logo.png' });
  await email.sendCompletionEmail('ann@x.com', 'Ann', '2026-10-05T16:00:00Z');
  const m = graph.calls.find(c => c.kind === 'send').body.message;
  assert.match(m.body.content, /<img src="https:\/\/example\.org\/logo\.png"/);
  delete process.env.EMAIL_LOGO_URL;
});
