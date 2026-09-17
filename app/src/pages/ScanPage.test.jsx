import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ScanPage from './ScanPage';
import { readPendingScan, savePendingScan } from '../lib/pendingScan';

vi.mock('../api', () => ({ submitCheckin: vi.fn(), getSponsors: vi.fn(), getProgress: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

import { submitCheckin, getSponsors, getProgress } from '../api';
import { useAuth } from '../context/AuthContext';

const SPONSOR = {
  id: 'sponsor-1', name: 'MissionSquare', tier: 'leadership', logoUrl: null,
  question: 'What do we help you plan for?', points: 150,
};

function renderScan(path = '/scan/sponsor-1?c=secret123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/scan/:sponsorId" element={<ScanPage />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/" element={<div>HOME PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  getSponsors.mockResolvedValue({ sponsors: [SPONSOR], passportLive: true });
  getProgress.mockResolvedValue({ checkedInSponsorIds: [] });
});

describe('ScanPage', () => {
  it('remembers the scan in localStorage and redirects to login when logged out', async () => {
    useAuth.mockReturnValue({ attendee: null, loading: false });
    renderScan();

    await waitFor(() => expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument());
    expect(readPendingScan()).toMatchObject({ sponsorId: 'sponsor-1', c: 'secret123' });
    expect(submitCheckin).not.toHaveBeenCalled();
  });

  it('opens the sponsor question (not an auto-unlock) after a scan, clearing any pending scan', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    savePendingScan({ sponsorId: 'sponsor-1', c: 'secret123' });
    renderScan();

    await screen.findByText(SPONSOR.question);
    expect(screen.getByPlaceholderText(/type your answer/i)).toBeInTheDocument();
    expect(submitCheckin).not.toHaveBeenCalled();
    expect(readPendingScan()).toBeNull();
  });

  it('only awards points once the correct answer is submitted', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    submitCheckin.mockResolvedValue({ correct: true, pointsAwarded: 150, totalPoints: 400, isComplete: false });
    renderScan();

    await screen.findByText(SPONSOR.question);
    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), { target: { value: 'retirement' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() => expect(screen.getByText('Stop Unlocked!')).toBeInTheDocument());
    expect(submitCheckin).toHaveBeenCalledWith('sponsor-1', { answer: 'retirement' });
    expect(screen.getByText('+150 pts')).toBeInTheDocument();
    expect(screen.getByText('MissionSquare')).toBeInTheDocument();
  });

  it('shows the already-collected view without prompting a question when already completed', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    getProgress.mockResolvedValue({ checkedInSponsorIds: ['sponsor-1'] });
    renderScan();

    await waitFor(() => expect(screen.getByText('Already Collected')).toBeInTheDocument());
    expect(submitCheckin).not.toHaveBeenCalled();
  });

  it('shows the passport-not-open view when the passport is not live', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    getSponsors.mockResolvedValue({ sponsors: [SPONSOR], passportLive: false });
    renderScan();

    await waitFor(() => expect(screen.getByText('Passport Not Open')).toBeInTheDocument());
  });

  it('shows the invalid-code view when the scanned sponsor cannot be found', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    getSponsors.mockResolvedValue({ sponsors: [], passportLive: true });
    renderScan();

    await waitFor(() => expect(screen.getByText('Code Not Recognized')).toBeInTheDocument());
  });

  it('treats a missing ?c= as invalid without calling the API', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    renderScan('/scan/sponsor-1');

    await waitFor(() => expect(screen.getByText('Code Not Recognized')).toBeInTheDocument());
    expect(getSponsors).not.toHaveBeenCalled();
  });

  it('shows an error view (with retry) if the sponsor lookup fails', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    getSponsors.mockRejectedValue(new Error('offline'));
    renderScan();

    await waitFor(() => expect(screen.getByText('Something Went Wrong')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
