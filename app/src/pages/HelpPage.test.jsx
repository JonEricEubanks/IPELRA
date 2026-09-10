import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HelpPage from './HelpPage';

function renderHelpPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HelpPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('HelpPage', () => {
  it('renders the FAQ list', () => {
    renderHelpPage();
    expect(screen.getByText('How do I earn points?')).toBeInTheDocument();
    expect(screen.getByText(/lost my magic link email/i)).toBeInTheDocument();
  });
});
