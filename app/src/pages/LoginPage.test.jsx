import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { savePendingScan } from '../lib/pendingScan';

vi.mock('../api.js', () => ({ sendMagicLink: vi.fn() }));
import { sendMagicLink } from '../api.js';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('LoginPage', () => {
  it('shows no scan banner on a normal visit', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.queryByText('Sponsor stop scanned!')).toBeNull();
  });

  it('shows the scan banner and passes the scan path to the magic link when arriving from a QR scan', async () => {
    savePendingScan({ sponsorId: 'sp-1', c: 'abc' });
    sendMagicLink.mockResolvedValue({ status: 200 });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByText('Sponsor stop scanned!')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('First name'),    { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Last name'),     { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /start your passport/i }));

    await waitFor(() => expect(sendMagicLink).toHaveBeenCalled());
    expect(sendMagicLink.mock.calls[0][3]).toBe('/scan/sp-1?c=abc');
    await waitFor(() => expect(screen.getByText(/unlock automatically once you tap the link/)).toBeInTheDocument());
  });
});
