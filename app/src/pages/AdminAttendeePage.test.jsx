import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAttendeePage from './AdminAttendeePage';

vi.mock('../api', () => ({
  adminListAttendees: vi.fn(), adminGetSponsors: vi.fn(), adminGetAttendee: vi.fn(), adminManualCredit: vi.fn(),
}));
import { adminListAttendees, adminGetSponsors, adminGetAttendee, adminManualCredit } from '../api';

const ROSTER = [
  { id: 'a1', email: 'ann@x.com', firstName: 'Ann', lastName: 'Lee', points: 350, completed: true,  completedAt: '2026-10-05T16:00:00Z', stampCount: 3, createdAt: '2026-10-05T13:00:00Z' },
  { id: 'a2', email: 'bob@x.com', firstName: 'Bob', lastName: 'Ray', points: 100, completed: false, completedAt: null, stampCount: 1, createdAt: '2026-10-05T13:10:00Z' },
  { id: 'a3', email: 'cat@x.com', firstName: 'Cat', lastName: 'Zed', points: 0,   completed: false, completedAt: null, stampCount: 0, createdAt: '2026-10-05T13:20:00Z' },
];
const SPONSORS = [
  { id: 'sp1', name: 'Acme',  pointValue: 100, isActive: true },
  { id: 'sp2', name: 'Bravo', pointValue: 150, isActive: true },
  { id: 'sp4', name: 'Old',   pointValue: 100, isActive: false },
];

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin/attendees']}><AdminAttendeePage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  adminListAttendees.mockResolvedValue({ attendees: ROSTER, total: ROSTER.length });
  adminGetSponsors.mockResolvedValue({ sponsors: SPONSORS });
  adminGetAttendee.mockResolvedValue({
    ...ROSTER[1], completedStamps: ['sp1'],
    checkins: [{ id: 'c1', sponsorId: 'sp1', sponsorName: 'Acme', pointsAwarded: 100, timestamp: '2026-10-05T14:00:00Z', failed: false }],
  });
});

describe('AdminAttendeePage', () => {
  it('loads the roster immediately (no Load button) and shows counts', async () => {
    renderPage();
    await screen.findByText('Ann Lee');
    expect(screen.getByText('Bob Ray')).toBeInTheDocument();
    expect(screen.getByText('3 registered · 1 completed')).toBeInTheDocument();
    expect(screen.queryByText(/click .*load/i)).not.toBeInTheDocument();
  });

  it('filters by search text and status chips', async () => {
    renderPage();
    await screen.findByText('Ann Lee');

    fireEvent.change(screen.getByLabelText('Search attendees'), { target: { value: 'bob' } });
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Ray')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search attendees'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /not started/i }));
    expect(screen.getByText('Cat Zed')).toBeInTheDocument();
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
  });

  it('opens a drawer on row click with history and credits via a sponsor dropdown (no IDs)', async () => {
    adminManualCredit.mockResolvedValue({ totalPoints: 250, isComplete: false });
    renderPage();
    await screen.findByText('Bob Ray');

    fireEvent.click(screen.getByText('Bob Ray'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('bob@x.com');
    expect(dialog).toHaveTextContent('Check-in history');
    expect(dialog).toHaveTextContent('Acme');

    // Only active sponsors the attendee hasn't already collected are offered
    const select = screen.getByLabelText('Sponsor');
    const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(options.some(o => o.startsWith('Bravo'))).toBe(true);
    expect(options.some(o => o.startsWith('Acme'))).toBe(false);
    expect(options.some(o => o.startsWith('Old'))).toBe(false);

    fireEvent.change(select, { target: { value: 'sp2' } });
    fireEvent.click(screen.getByRole('button', { name: /apply credit/i }));
    await waitFor(() => expect(adminManualCredit).toHaveBeenCalledWith('a2', 'bob@x.com', 'sp2', ''));
  });
});
