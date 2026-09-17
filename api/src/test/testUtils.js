/**
 * testUtils.js — helpers for handler-level tests.
 *
 * Handlers register themselves via `app.http(name, { handler })`; tests mock
 * `@azure/functions` with `captureHandlers()` so the handler can be invoked
 * directly with a `fakeRequest()`.
 */

/**
 * Returns { namedExports, handlers } — pass `namedExports` to
 * `mock.module('@azure/functions', …)`, then read `handlers[name]` after
 * importing the function module.
 */
export function captureHandlers() {
  const handlers = {};
  const namedExports = {
    app: {
      http(name, options) { handlers[name] = options.handler; },
      timer(name, options) { handlers[name] = options.handler; },
    },
  };
  return { namedExports, handlers };
}

/**
 * Minimal stand-in for an Azure Functions v4 HttpRequest.
 */
export function fakeRequest({
  method = 'GET',
  url = 'http://localhost/api/test',
  headers = {},
  body,
  params = {},
} = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const parsed = new URL(url);
  return {
    method,
    url,
    params,
    headers: { get: (name) => headerMap.get(name.toLowerCase()) ?? null },
    query: { get: (name) => parsed.searchParams.get(name) },
    async json() {
      if (body === undefined) throw new SyntaxError('No body');
      return typeof body === 'string' ? JSON.parse(body) : body;
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body ?? '');
    },
  };
}

/**
 * Reads a Response's JSON body along with its status.
 */
export async function readJson(response) {
  return { status: response.status, body: await response.json() };
}

/**
 * Cosmos-style error with a numeric `code` (409 unique-key, 412 etag, …).
 */
export function cosmosError(code, message = `Cosmos error ${code}`) {
  const err = new Error(message);
  err.code = code;
  return err;
}
