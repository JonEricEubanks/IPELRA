import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SponsorSheet from './SponsorSheet';

vi.mock('../api', () => ({ submitCheckin: vi.fn() }));
import { submitCheckin } from '../api';

const SPONSOR = {
  id: 'sp1', name: 'Acme Retirement', tier: 'partnership', points: 100,
  tagline: 'Plan ahead', description: 'We do retirement.', website: 'https://acme.example.com',
  question: 'What do we help you plan for?', logoUrl: null,
};

function renderSheet(props = {}) {
  const onClose   = vi.fn();
  const onSuccess = vi.fn();
  render(
    <MemoryRouter>
      <SponsorSheet sponsor={SPONSOR} onClose={onClose} onSuccess={onSuccess} {...props} />
    </MemoryRouter>
  );
  return { onClose, onSuccess };
}

async function goToQuestion() {
  fireEvent.click(screen.getByRole('button', { name: /get your passport stamped/i }));
  await screen.findByText(SPONSOR.question);
}

beforeEach(() => vi.clearAllMocks());

describe('SponsorSheet', () => {
  it('starts on the profile phase and moves to the question on CTA click', async () => {
    renderSheet();
    expect(screen.getByText('Acme Retirement')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type your answer/i)).not.toBeInTheDocument();

    await goToQuestion();
    expect(screen.getByPlaceholderText(/type your answer/i)).toBeInTheDocument();
  });

  it('disables submit until an answer is typed', async () => {
    renderSheet();
    await goToQuestion();
    const submit = screen.getByRole('button', { name: /submit answer/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), { target: { value: 'retirement' } });
    expect(submit).toBeEnabled();
  });

  it('submits the trimmed answer and calls onSuccess with the result', async () => {
    const result = { correct: true, pointsAwarded: 100, totalPoints: 100, isComplete: false };
    submitCheckin.mockResolvedValue(result);
    const { onSuccess } = renderSheet();
    await goToQuestion();

    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), { target: { value: '  retirement  ' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(result));
    expect(submitCheckin).toHaveBeenCalledWith('sp1', { answer: 'retirement' });
  });

  it('shows the server message on a 422 and the hint once provided', async () => {
    submitCheckin.mockRejectedValueOnce(Object.assign(new Error('Not quite. 2 more tries before we show a hint — or just ask at the Acme Retirement table.'), { status: 422, hint: null }));
    const { onSuccess } = renderSheet();
    await goToQuestion();
    const input = screen.getByPlaceholderText(/type your answer/i);

    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('2 more tries before we show a hint');
    expect(onSuccess).not.toHaveBeenCalled();

    submitCheckin.mockRejectedValueOnce(Object.assign(new Error('Still not it.'), { status: 422, hint: 'r_t_r_m_n_' }));
    fireEvent.change(input, { target: { value: 'still wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    await screen.findByText('r_t_r_m_n_');
    expect(screen.getByText('Hint')).toBeInTheDocument();
  });

  it('escalates the "go to the table" nudge with each miss and never says attempts are used up', async () => {
    submitCheckin.mockRejectedValue(Object.assign(new Error('Not quite.'), { status: 422, hint: null }));
    renderSheet();
    await goToQuestion();
    const input = screen.getByPlaceholderText(/type your answer/i);
    const submit = () => fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    fireEvent.change(input, { target: { value: 'a' } }); submit();
    await screen.findByText(/rep at their table knows the answer/i);

    fireEvent.change(input, { target: { value: 'b' } }); submit();
    await screen.findByText(/one more try before a hint/i);

    fireEvent.change(input, { target: { value: 'c' } }); submit();
    await screen.findByText(/skip the guessing/i);

    // Input still usable after 3 misses — no lockout
    expect(input).not.toBeDisabled();
    expect(screen.queryByText(/no attempts (left|remaining)/i)).not.toBeInTheDocument();
  });

  it('does not offer the sponsor website from the question phase (no cheat path, no leaving the app)', async () => {
    renderSheet();
    // Profile phase: website is offered and clearly labelled as leaving the app
    expect(screen.getByText('Visit Website')).toBeInTheDocument();
    expect(screen.getByText(/opens in a new tab/i)).toBeInTheDocument();

    await goToQuestion();
    fireEvent.click(screen.getByRole('button', { name: /about acme retirement/i }));
    expect(screen.getByText('We do retirement.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /acme.example.com/i })).not.toBeInTheDocument();
  });

  it('shows a generic error on an unexpected failure', async () => {
    submitCheckin.mockRejectedValue(new Error('boom'));
    renderSheet();
    await goToQuestion();
    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
  });

  it('jumps straight to the question phase when initialPhase="question" (e.g. arriving via a QR scan)', async () => {
    renderSheet({ initialPhase: 'question' });
    expect(screen.getByPlaceholderText(/type your answer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get your passport stamped/i })).not.toBeInTheDocument();
  });

  it('calls onClose after the dismiss animation when Escape is pressed', async () => {
    vi.useFakeTimers();
    try {
      const { onClose } = renderSheet();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
