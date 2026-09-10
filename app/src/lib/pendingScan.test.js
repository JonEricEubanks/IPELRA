import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { savePendingScan, readPendingScan, clearPendingScan, pendingScanPath } from './pendingScan';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.useRealTimers());

describe('pendingScan', () => {
  it('round-trips a scan through localStorage (survives new tabs, unlike sessionStorage)', () => {
    savePendingScan({ sponsorId: 'sp-1', c: 'abc' });
    expect(localStorage.getItem('passport_pending_scan')).not.toBeNull();
    expect(sessionStorage.getItem('passport_pending_scan')).toBeNull();
    expect(readPendingScan()).toMatchObject({ sponsorId: 'sp-1', c: 'abc' });
  });

  it('expires after 30 minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    savePendingScan({ sponsorId: 'sp-1', c: 'abc' });

    vi.setSystemTime(new Date('2026-10-05T10:29:00Z'));
    expect(readPendingScan()).not.toBeNull();

    vi.setSystemTime(new Date('2026-10-05T10:31:00Z'));
    expect(readPendingScan()).toBeNull();
    expect(localStorage.getItem('passport_pending_scan')).toBeNull();
  });

  it('clears and ignores malformed data', () => {
    localStorage.setItem('passport_pending_scan', '{not json');
    expect(readPendingScan()).toBeNull();
    savePendingScan({ sponsorId: 'sp-1', c: 'abc' });
    clearPendingScan();
    expect(readPendingScan()).toBeNull();
  });

  it('builds the in-app resume path with encoding', () => {
    expect(pendingScanPath({ sponsorId: 'sp 1', c: 'a/b' })).toBe('/scan/sp%201?c=a%2Fb');
  });
});
