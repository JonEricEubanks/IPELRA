import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RankingsPage from './RankingsPage';

vi.mock('../api', () => ({ getLeaderboard: vi.fn() }));
vi.mock('./PassportHomePage', () => ({ BottomNav: () => null }));
import { getLeaderboard } from '../api';

const member = (firstName, isCurrentUser = false) => ({ firstName, lastInitial: 'L.', isCurrentUser });

function pageData(overrides = {}) {
  return {
    groups: [
      { rank: 1, points: 500, count: 1, isComplete: true,  includesCurrentUser: false, members: [member('Ann')] },
      { rank: 2, points: 300, count: 12, isComplete: false, includesCurrentUser: false,
        members: Array.from({ length: 12 }, (_, i) => member(`Tie${i}`)) },
    ],
    page: 1, pageSize: 20, totalPages: 3, totalParticipants: 55,
    myRank: 44, myPoints: 100, myTiedWith: 0, myPage: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  getLeaderboard.mockResolvedValue(pageData());
});

describe('RankingsPage', () => {
  it('shows the caller\'s rank, points and the true participant total', async () => {
    render(<RankingsPage />);
    expect(await screen.findByText('#44')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(getLeaderboard).toHaveBeenCalledWith(1);
  });

  it('collapses a tie into one row with a "+N" tile, and expands to list everyone', async () => {
    render(<RankingsPage />);
    expect(await screen.findByText('+11')).toBeInTheDocument();
    expect(screen.getByText('12-way tie')).toBeInTheDocument();
    expect(screen.getByText(/\+ 11 others/)).toBeInTheDocument();
    expect(screen.queryByText('Tie5 L.')).not.toBeInTheDocument();

    const row = screen.getByRole('button', { expanded: false });
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Tie5 L.')).toBeInTheDocument();
  });

  it('shows "+N more" when a huge tie lists only some names', async () => {
    getLeaderboard.mockResolvedValue(pageData({
      groups: [{ rank: 1, points: 0, count: 120, isComplete: false, includesCurrentUser: false,
        members: Array.from({ length: 50 }, (_, i) => member(`P${i}`)) }],
    }));
    render(<RankingsPage />);
    fireEvent.click(await screen.findByRole('button', { expanded: false }));
    expect(screen.getByText('+70 more')).toBeInTheDocument();
  });

  it('labels a tie that includes the caller as "You + N others" and shows "tied with"', async () => {
    getLeaderboard.mockResolvedValue(pageData({
      myRank: 2, myPoints: 300, myTiedWith: 3, myPage: 1,
      groups: [{ rank: 2, points: 300, count: 4, isComplete: false, includesCurrentUser: true,
        members: [member('Me', true), member('B'), member('C'), member('D')] }],
    }));
    render(<RankingsPage />);
    expect(await screen.findByText('tied with 3')).toBeInTheDocument();
    const row = screen.getByRole('button', { expanded: false });
    expect(within(row).getByText('You')).toBeInTheDocument();
    expect(within(row).getByText(/\+ 3 others/)).toBeInTheDocument();
  });

  it('pages forward/back and disables Previous on page 1', async () => {
    render(<RankingsPage />);
    const prev = await screen.findByRole('button', { name: 'Previous page' });
    expect(prev).toBeDisabled();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    getLeaderboard.mockResolvedValue(pageData({ page: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(getLeaderboard).toHaveBeenLastCalledWith(2));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('"Find me" jumps to the caller\'s page and hides once there', async () => {
    render(<RankingsPage />);
    const findMe = await screen.findByRole('button', { name: /find me/i });
    getLeaderboard.mockResolvedValue(pageData({ page: 3 }));
    fireEvent.click(findMe);
    await waitFor(() => expect(getLeaderboard).toHaveBeenLastCalledWith('me'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /find me/i })).not.toBeInTheDocument());
  });

  it('hides paging when everything fits on one page', async () => {
    getLeaderboard.mockResolvedValue(pageData({ totalPages: 1, myPage: 1 }));
    render(<RankingsPage />);
    expect(await screen.findByText('All Participants')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  });

  it('shows an error message if the leaderboard fails to load', async () => {
    getLeaderboard.mockRejectedValue(new Error('boom'));
    render(<RankingsPage />);
    expect(await screen.findByText(/could not load rankings/i)).toBeInTheDocument();
  });
});
