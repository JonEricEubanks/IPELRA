import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage from './AdminDashboardPage';

vi.mock('../api', () => ({ adminGetMetrics: vi.fn() }));
// recharts needs real layout; stub the responsive wrapper so charts render in jsdom
vi.mock('recharts', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, ResponsiveContainer: ({ children }) => <div style={{ width: 600, height: 220 }}>{children}</div> };
});
import { adminGetMetrics } from '../api';

function metricsWith(overrides = {}) {
  return {
    totalAttendees: 120, activeAttendees: 84, completedCount: 30, completionRate: 25,
    totalCheckins: 310, checkinsToday: 42, failedAttempts: 9, manualCredits: 2,
    activeSponsors: 3, totalSponsors: 4, almostThere: 7,
    passport: { live: true, closed: false, lockUtc: '2999-01-01T00:00:00Z', threshold: 300, conferenceYear: 2026 },
    hourly: [{ hour: '2026-10-05T14:00:00.000Z', count: 4 }, { hour: '2026-10-05T15:00:00.000Z', count: 0 }],
    sponsors: [
      { sponsorId: 'sp1', sponsorName: 'Acme',  tier: 'partnership', isActive: true,  pointValue: 100, checkinCount: 50, stuckAttendees: 0 },
      { sponsorId: 'sp3', sponsorName: 'Ghost', tier: 'partnership', isActive: true,  pointValue: 100, checkinCount: 0,  stuckAttendees: 0 },
      { sponsorId: 'sp2', sponsorName: 'Bravo', tier: 'leadership',  isActive: true,  pointValue: 150, checkinCount: 20, stuckAttendees: 3 },
      { sponsorId: 'sp4', sponsorName: 'Old',   tier: 'partnership', isActive: false, pointValue: 100, checkinCount: 0,  stuckAttendees: 0 },
    ],
    funnel: [{ stops: 0, count: 36 }, { stops: 1, count: 30 }, { stops: 2, count: 24 }, { stops: 3, count: 30 }],
    recentCheckins: [
      { attendeeName: 'Ann Lee', attendeeEmail: 'ann@x.com', sponsorName: 'Acme', pointsAwarded: 100, manualCredit: false, timestamp: new Date().toISOString() },
    ],
    recentCompletions: [
      { name: 'Ann Lee', email: 'ann@x.com', completedAt: new Date().toISOString(), totalPoints: 350 },
    ],
    needsAttention: [{ sponsorId: 'sp2', sponsorName: 'Bravo', stuckAttendees: 3 }],
    contentIssues: [],
    asOf: new Date().toISOString(),
    ...overrides,
  };
}

function renderDash() {
  return render(<MemoryRouter initialEntries={['/admin/dashboard']}><AdminDashboardPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  adminGetMetrics.mockResolvedValue(metricsWith());
});

describe('AdminDashboardPage', () => {
  it('shows the hero numbers with real active/registered split and the live pill', async () => {
    renderDash();
    await screen.findByText('120');
    expect(screen.getByText('84 have started')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('25% · in the prize drawing')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Passport live')).toBeInTheDocument();
  });

  it('ranks only active sponsors, flags dead tables and stuck attendees', async () => {
    renderDash();
    await screen.findByText('Sponsor tables');
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('No visits')).toBeInTheDocument();
    // "3 stuck" appears in the ranking row and again in the needs-attention card
    expect(screen.getAllByText('3 stuck').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Old')).not.toBeInTheDocument();
  });

  it('shows the needs-attention card only when there is something to fix', async () => {
    renderDash();
    await screen.findByText('Needs attention');
    expect(screen.getAllByText('Bravo').length).toBeGreaterThan(0);
    expect(screen.getByText(/3 attendees used all 3 answer attempts/)).toBeInTheDocument();
  });

  it('surfaces sponsor content problems (e.g. "[Company Name]") with a Fix link to that sponsor', async () => {
    adminGetMetrics.mockResolvedValue(metricsWith({
      needsAttention: [],
      contentIssues: [{ sponsorId: 'sp9', sponsorName: 'Workday', issue: 'Question has bracketed placeholder text like "[Company Name]"' }],
    }));
    renderDash();
    await screen.findByText('Needs attention');
    expect(screen.getByText(/bracketed placeholder/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '/admin/sponsors/sp9?from=attention');
  });

  it('hides needs-attention when nothing is stuck and shows "Not open yet" before launch', async () => {
    adminGetMetrics.mockResolvedValue(metricsWith({
      needsAttention: [],
      passport: { live: false, closed: false, lockUtc: '2999-01-01T00:00:00Z', threshold: 300, conferenceYear: 2026 },
    }));
    renderDash();
    await screen.findByText('Not open yet');
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
  });

  it('renders the live feed and recent completions', async () => {
    renderDash();
    await screen.findByText('Live feed');
    expect(screen.getByText(/→ Acme/)).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
    expect(screen.getByText('350 pts')).toBeInTheDocument();
  });

  it('keeps the last numbers and shows a warning when a refresh fails', async () => {
    adminGetMetrics.mockRejectedValueOnce(new Error('down'));
    renderDash();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not refresh/i));
  });
});
