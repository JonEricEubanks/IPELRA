import { describe, it, expect } from 'vitest';
import { parseScanUrl } from './scanUrl';

const ORIGIN = 'https://gentle-flower-01d10d50f.7.azurestaticapps.net';

describe('parseScanUrl', () => {
  it('accepts a full scan URL on our origin', () => {
    expect(parseScanUrl(`${ORIGIN}/scan/sponsor-abc?c=4CClcG7jfvNXEp2p`, ORIGIN)).toEqual({
      sponsorId: 'sponsor-abc',
      c: '4CClcG7jfvNXEp2p',
      path: '/scan/sponsor-abc?c=4CClcG7jfvNXEp2p',
    });
  });

  it('accepts a bare relative path', () => {
    expect(parseScanUrl('/scan/sp-1?c=xyz', ORIGIN)).toMatchObject({ sponsorId: 'sp-1', c: 'xyz' });
  });

  it('rejects the same path on a different origin (phishing lookalike)', () => {
    expect(parseScanUrl('https://gentle-flower.evil.com/scan/sp-1?c=xyz', ORIGIN)).toBeNull();
    expect(parseScanUrl('http://gentle-flower-01d10d50f.7.azurestaticapps.net/scan/sp-1?c=xyz', ORIGIN)).toBeNull(); // http vs https
  });

  it('rejects non-scan paths on our origin', () => {
    expect(parseScanUrl(`${ORIGIN}/login`, ORIGIN)).toBeNull();
    expect(parseScanUrl(`${ORIGIN}/admin/dashboard`, ORIGIN)).toBeNull();
    expect(parseScanUrl(`${ORIGIN}/scan/`, ORIGIN)).toBeNull();
  });

  it('rejects a scan URL with no code', () => {
    expect(parseScanUrl(`${ORIGIN}/scan/sp-1`, ORIGIN)).toBeNull();
  });

  it('rejects random QR payloads', () => {
    expect(parseScanUrl('https://www.linkedin.com/in/someone', ORIGIN)).toBeNull();
    expect(parseScanUrl('WIFI:S:Conference;T:WPA;P:secret;;', ORIGIN)).toBeNull();
    expect(parseScanUrl('just some text', ORIGIN)).toBeNull();
    expect(parseScanUrl('', ORIGIN)).toBeNull();
    expect(parseScanUrl(null, ORIGIN)).toBeNull();
  });

  it('rejects codes or ids with unexpected characters', () => {
    expect(parseScanUrl(`${ORIGIN}/scan/sp-1?c=<script>`, ORIGIN)).toBeNull();
    expect(parseScanUrl(`${ORIGIN}/scan/sp%201?c=abc`, ORIGIN)).toBeNull();
  });
});
