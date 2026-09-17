import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VerifyPage from './VerifyPage';
import { savePendingScan, readPendingScan } from '../lib/pendingScan';

vi.mock('../api.js', () => ({ verifyToken: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ login: vi.fn() }) }));
import { verifyToken } from '../api.js';

function okResponse() {
  return { ok: true, status: 200, json: async () => ({ token: 't', attendee: { id: 'a1' } }) };
}

function renderVerify(search) {
  // VerifyPage reads window.location.search directly
  window.history.pushState({}, '', `/verify${search}`);
  return render(
    <MemoryRouter initialEntries={[`/verify${search}`]}>
      <Routes>
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/scan/:sponsorId" element={<div>SCAN PAGE</div>} />
        <Route path="/onboarding" element={<div>ONBOARDING</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); verifyToken.mockResolvedValue(okResponse()); });

describe('VerifyPage resume after login', () => {
  it('returning users: follows a safe ?next= scan path from the magic link immediately', async () => {
    localStorage.setItem('passport_onboarded', '1');
    renderVerify('?token=abc&next=%2Fscan%2Fsp-1%3Fc%3Dxyz');
    await waitFor(() => expect(screen.getByText('SCAN PAGE')).toBeInTheDocument());
  });

  it('ignores an unsafe ?next= (open redirect) and falls back to normal routing', async () => {
    localStorage.setItem('passport_onboarded', '1');
    renderVerify('?token=abc&next=https%3A%2F%2Fevil.example.com%2Fscan%2Fx');
    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument());
  });

  it('returning users: falls back to the locally remembered scan when the link has no next=', async () => {
    localStorage.setItem('passport_onboarded', '1');
    savePendingScan({ sponsorId: 'sp-1', c: 'xyz' });
    renderVerify('?token=abc');
    await waitFor(() => expect(screen.getByText('SCAN PAGE')).toBeInTheDocument());
    expect(readPendingScan()).toBeNull();
  });

  it('sends first-time users to onboarding when there is nothing to resume', async () => {
    renderVerify('?token=abc');
    await waitFor(() => expect(screen.getByText('ONBOARDING')).toBeInTheDocument());
  });

  it('first-time scan-first users see onboarding first, with the scan re-saved to resume afterward', async () => {
    renderVerify('?token=abc&next=%2Fscan%2Fsp-1%3Fc%3Dxyz');
    await waitFor(() => expect(screen.getByText('ONBOARDING')).toBeInTheDocument());
    expect(readPendingScan()).toMatchObject({ sponsorId: 'sp-1', c: 'xyz' });
  });
});
