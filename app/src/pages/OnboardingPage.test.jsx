import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OnboardingPage from './OnboardingPage';
import { savePendingScan, readPendingScan } from '../lib/pendingScan';

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/scan/:sponsorId" element={<div>SCAN PAGE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('OnboardingPage', () => {
  it('goes home after completing all cards when there is no pending scan', async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /start my passport/i }));

    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument());
    expect(localStorage.getItem('passport_onboarded')).toBe('1');
  });

  it('resumes straight to the sponsor question if the attendee arrived via a QR scan', async () => {
    savePendingScan({ sponsorId: 'sp-1', c: 'xyz' });
    renderOnboarding();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /start my passport/i }));

    await waitFor(() => expect(screen.getByText('SCAN PAGE')).toBeInTheDocument());
    expect(readPendingScan()).toBeNull();
  });

  it('also resumes the pending scan when the intro is skipped', async () => {
    savePendingScan({ sponsorId: 'sp-1', c: 'xyz' });
    renderOnboarding();
    fireEvent.click(screen.getByRole('button', { name: /skip intro/i }));

    await waitFor(() => expect(screen.getByText('SCAN PAGE')).toBeInTheDocument());
  });
});
