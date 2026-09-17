import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminSponsorEditPage from './AdminSponsorEditPage';

vi.mock('../api', () => ({
  adminGetSponsors: vi.fn(), adminUpdateSponsor: vi.fn(), adminCreateSponsor: vi.fn(), adminGetSponsorWrongAnswers: vi.fn(),
}));
import { adminGetSponsors, adminGetSponsorWrongAnswers } from '../api';

const WORKDAY = {
  id: 'wd', name: 'Workday', tier: 'partnership', pointValue: 100, isActive: true, displayOrder: 99,
  promptQuestion: 'What is the main benefit [Company Name] provides to help HR teams streamline their operations from hire to retire? ',
  promptAnswerKeyword: 'Workday HCM', tagline: '', description: null, website: null, logoUrl: null,
};

function renderEdit(path = '/admin/sponsors/wd?from=attention') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/sponsors/:id" element={<AdminSponsorEditPage />} />
        <Route path="/admin/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/admin/sponsors" element={<div>SPONSORS LIST</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  adminGetSponsors.mockResolvedValue({ sponsors: [WORKDAY] });
  adminGetSponsorWrongAnswers.mockResolvedValue([
    { email: 'a@x.com', rejectedAnswers: ['workday', 'HCM', 'human capital'], attemptCount: 3, stuck: true, lastTried: '2026-10-05T15:00:00Z' },
    { email: 'b@x.com', rejectedAnswers: ['workday'], attemptCount: 1, stuck: false, lastTried: '2026-10-05T15:10:00Z' },
  ]);
});

describe('AdminSponsorEditPage (arriving from Dashboard "Fix" / "Review")', () => {
  it('explains why you are here and highlights the placeholder in the question', async () => {
    renderEdit();
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/bracketed placeholder text like "\[Company Name\]"/);
    expect(status).toHaveTextContent(/1 attendee used all 3 answer attempts/);

    const question = screen.getByLabelText(/question shown to attendees/i);
    expect(question).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the warning as soon as the placeholder is fixed', async () => {
    renderEdit();
    const question = await screen.findByLabelText(/question shown to attendees/i);
    fireEvent.change(question, { target: { value: 'What does Workday call its unified hire-to-retire platform?' } });
    expect(question).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/bracketed placeholder/)).not.toBeInTheDocument();
  });

  it('lists what attendees typed, tallied, and re-colours them as the keyword changes', async () => {
    renderEdit();
    await screen.findByText(/wrong answers attendees typed here/i);
    // With keyword "Workday HCM" the 30% edit tolerance already lets bare "workday" through
    // (drop " hcm" = 4 edits = ceil(11 × 0.3)). "human capital" does not.
    expect(screen.getByRole('button', { name: /“workday” ×2/ })).toHaveAttribute('data-pass', 'true');
    expect(screen.getByRole('button', { name: /“human capital”/ })).toHaveAttribute('data-pass', 'false');

    fireEvent.change(screen.getByLabelText(/answer keyword/i), { target: { value: 'HCM' } });
    // Keyword "HCM": "HCM" passes (contains), bare "workday" now fails
    expect(screen.getByRole('button', { name: /“HCM”/ })).toHaveAttribute('data-pass', 'true');
    expect(screen.getByRole('button', { name: /“workday” ×2/ })).toHaveAttribute('data-pass', 'false');

    // Tapping a chip runs it through the tester
    fireEvent.click(screen.getByRole('button', { name: /“HCM”/ }));
    expect(screen.getByText(/would accept/i)).toBeInTheDocument();
  });

  it('back button returns to the Dashboard when arriving from there, otherwise to the list', async () => {
    renderEdit();
    fireEvent.click(await screen.findByRole('button', { name: /dashboard/i }));
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});
