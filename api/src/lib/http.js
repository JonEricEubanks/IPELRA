/**
 * http.js — shared JSON response helper for HTTP-triggered functions
 */

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
