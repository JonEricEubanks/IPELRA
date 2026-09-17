import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PassportHomePage from './PassportHomePage';

vi.mock('../api', () => ({ getSponsors: vi.fn(), getProgress: vi.fn(), updateAttendeeName: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../components/ScanFab', () => ({ default: () => <div>SCAN FAB</div> }));
vi.mock('../components/SponsorSheet', () => ({
  default: ({ sponsor, onSuccess }) => (
    <div>
      <div>SHEET: {sponsor.name}</div>
      <button onClick={() => onSuccess({ correct: true, pointsAwarded: 100, totalPoints: 250 })}>FAKE SUCCESS</button>
    </div>
  ),
}));

import { getSponsors, getProgress, updateAttendeeName } from '../api';
import { useAuth } from '../context/AuthContext';

const SPONSORS = [
  { id: 'p1', name: 'Partner One',  tier: 'partnership', points: 100, isActive: true,  displayOrder: 10 },
  { id: 'l1', name: 'Leader One',   tier: 'leadership',  points: 150, isActive: true,  displayOrder: 20 },
  { id: 'p2', name: 'Partner Two',  tier: 'partnership', points: 100, isActive: true,  displayOrder: 30 },
  { id: 'x1', name: 'Inactive Co',  tier: 'partnership', points: 100, isActive: false, displayOrder: 5  },
];

function progressWith(overrides = {}) {
  return {
    points: 150, threshold: 1000, completed: false, checkedInSponsorIds: ['l1'],
    passportLockUtc: '2026-10-11T00:00:00Z', firstName: 'Ann', completedAt: null, ...overrides,
  };
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PassportHomePage />} />
        <Route path="/completed" element={<div>COMPLETED PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuth.mockReturnValue({ attendee: { id: 'a1', firstName: 'Ann' }, updateAttendee: vi.fn() });
  getSponsors.mockResolvedValue({ sponsors: SPONSORS });
  getProgress.mockResolvedValue(progressWith());
});

describe('PassportHomePage', () => {
  it('loads sponsors + progress, greets by name, and orders leadership first among remaining stops', async () => {
    renderHome();
    await screen.findByText('Next Stop');

    expect(screen.getByText(/Hey, Ann!/)).toBeInTheDocument();
    // l1 is collected, so Next Stop is the first remaining partnership sponsor
    expect(screen.getByText('Partner One')).toBeInTheDocument();
    expect(screen.getByText('Partner Two')).toBeInTheDocument();
    expect(screen.queryByText('Inactive Co')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3 stops collected')).toBeInTheDocument();
    expect(screen.getByText('SCAN FAB')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    getProgress.mockRejectedValue(new Error('down'));
    renderHome();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load your passport/i);
  });

  it('redirects to /completed once the passport is complete', async () => {
    getProgress.mockResolvedValue(progressWith({ completed: true, points: 1000 }));
    renderHome();
    await screen.findByText('COMPLETED PAGE');
  });

  it('shows the dashboard instead of redirecting once the completion celebration has been seen', async () => {
    localStorage.setItem('ipelra_completion_seen', 'true');
    getProgress.mockResolvedValue(progressWith({ completed: true, points: 1000, checkedInSponsorIds: ['p1', 'l1', 'p2'] }));
    renderHome();
    await screen.findByText('3 of 3 stops collected');
    expect(screen.queryByText('COMPLETED PAGE')).not.toBeInTheDocument();
  });

  it('shows the name gate when the attendee has no first name and saves it', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, updateAttendee: vi.fn() });
    getProgress.mockResolvedValue(progressWith({ firstName: null }));
    updateAttendeeName.mockResolvedValue({});
    renderHome();

    const first = await screen.findByLabelText('First name');
    fireEvent.change(first, { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|save|let's go/i }));

    await waitFor(() => expect(updateAttendeeName).toHaveBeenCalledWith('Jane', 'Smith'));
    await waitFor(() => expect(screen.queryByLabelText('First name')).not.toBeInTheDocument());
    expect(screen.getByText(/Hey, Jane!/)).toBeInTheDocument();
  });

  it('opens the sponsor sheet on tap and refreshes progress after a successful stamp', async () => {
    renderHome();
    await screen.findByText('Next Stop');

    fireEvent.click(screen.getByText('Partner One'));
    expect(screen.getByText('SHEET: Partner One')).toBeInTheDocument();
    expect(screen.queryByText('SCAN FAB')).not.toBeInTheDocument();

    getProgress.mockResolvedValue(progressWith({ points: 250, checkedInSponsorIds: ['l1', 'p1'] }));
    await act(async () => { fireEvent.click(screen.getByText('FAKE SUCCESS')); });

    expect(screen.queryByText('SHEET: Partner One')).not.toBeInTheDocument();
    expect(screen.getByText('Stamped!')).toBeInTheDocument();
    await waitFor(() => expect(getProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('2 of 3 stops collected')).toBeInTheDocument());
  });
});
