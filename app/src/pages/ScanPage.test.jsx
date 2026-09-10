import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ScanPage from './ScanPage';
import { readPendingScan, savePendingScan } from '../lib/pendingScan';

vi.mock('../api', () => ({ submitCheckin: vi.fn(), getSponsors: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

import { submitCheckin, getSponsors } from '../api';
import { useAuth } from '../context/AuthContext';

const SPONSOR = { id: 'sponsor-1', name: 'MissionSquare', tier: 'leadership', logoUrl: null };

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
  getSponsors.mockResolvedValue({ sponsors: [SPONSOR] });
});

describe('ScanPage', () => {
  it('remembers the scan in localStorage and redirects to login when logged out', async () => {
    useAuth.mockReturnValue({ attendee: null, loading: false });
    renderScan();

    await waitFor(() => expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument());
    expect(readPendingScan()).toMatchObject({ sponsorId: 'sponsor-1', c: 'secret123' });
    expect(submitCheckin).not.toHaveBeenCalled();
  });

  it('submits the QR code, shows the sponsor, and clears any pending scan on success', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    savePendingScan({ sponsorId: 'sponsor-1', c: 'secret123' });
    submitCheckin.mockResolvedValue({ correct: true, method: 'qr', pointsAwarded: 150, totalPoints: 400, isComplete: false });
    renderScan();

    await waitFor(() => expect(screen.getByText('Stop Unlocked!')).toBeInTheDocument());
    expect(submitCheckin).toHaveBeenCalledWith('sponsor-1', { qrCode: 'secret123' });
    expect(screen.getByText('+150 pts')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('MissionSquare')).toBeInTheDocument());
    expect(readPendingScan()).toBeNull();
  });

  it('shows the already-collected view on a 409', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    submitCheckin.mockRejectedValue(Object.assign(new Error('dup'), { status: 409 }));
    renderScan();

    await waitFor(() => expect(screen.getByText('Already Collected')).toBeInTheDocument());
  });

  it('shows the invalid-code view on a 422', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    submitCheckin.mockRejectedValue(Object.assign(new Error('bad code'), { status: 422 }));
    renderScan();

    await waitFor(() => expect(screen.getByText('Code Not Recognized')).toBeInTheDocument());
    expect(screen.getByText('bad code')).toBeInTheDocument();
  });

  it('treats a missing ?c= as invalid without calling the API', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    renderScan('/scan/sponsor-1');

    await waitFor(() => expect(screen.getByText('Code Not Recognized')).toBeInTheDocument());
    expect(submitCheckin).not.toHaveBeenCalled();
  });

  it('still unlocks even if the sponsor lookup fails', async () => {
    useAuth.mockReturnValue({ attendee: { id: 'a1' }, loading: false });
    getSponsors.mockRejectedValue(new Error('offline'));
    submitCheckin.mockResolvedValue({ correct: true, pointsAwarded: 100, totalPoints: 100 });
    renderScan();

    await waitFor(() => expect(screen.getByText('Stop Unlocked!')).toBeInTheDocument());
  });
});
