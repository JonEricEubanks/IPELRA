/**
 * leaderboard.js — groups attendees into tied ranks and pages through them.
 *
 * Ranking is "competition" style: everyone on the same points shares a rank,
 * and the next rank skips ahead (1, 2, 2, 4). Each page holds whole tie groups
 * so a tie is never split across pages.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE     = 50;
// Names listed inside one tie group; the rest are only counted
export const MAX_GROUP_MEMBERS = 50;

function toMember(a, meId) {
  return {
    firstName:     a.firstName,
    lastInitial:   a.lastName ? a.lastName[0].toUpperCase() + '.' : '',
    isCurrentUser: a.id === meId,
  };
}

/**
 * @param {Array<{id, firstName, lastName, totalPoints, isComplete}>} attendees
 * @param {string} meId          the caller's attendee id
 * @param {number|'me'} page     1-based page, or 'me' for the page holding the caller
 * @param {number} pageSize      tie groups per page
 */
export function buildLeaderboard(attendees, meId, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const size = Math.min(Math.max(1, Math.floor(Number(pageSize)) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const ranked = attendees
    .filter(a => a.firstName)
    .map(a => ({ ...a, totalPoints: Number(a.totalPoints) || 0 }))
    .sort((a, b) =>
      b.totalPoints - a.totalPoints
      || (a.firstName ?? '').localeCompare(b.firstName ?? '')
      || (a.lastName ?? '').localeCompare(b.lastName ?? ''));

  const groups = [];
  ranked.forEach((a, i) => {
    const last = groups[groups.length - 1];
    if (last && last.points === a.totalPoints) {
      last.all.push(a);
    } else {
      groups.push({ rank: i + 1, points: a.totalPoints, all: [a] });
    }
  });

  const myGroupIndex = groups.findIndex(g => g.all.some(a => a.id === meId));
  const myGroup      = myGroupIndex >= 0 ? groups[myGroupIndex] : null;
  const totalPages   = Math.max(1, Math.ceil(groups.length / size));

  let current = page === 'me'
    ? (myGroupIndex >= 0 ? Math.floor(myGroupIndex / size) + 1 : 1)
    : Math.floor(Number(page)) || 1;
  current = Math.min(Math.max(1, current), totalPages);

  const pageGroups = groups.slice((current - 1) * size, current * size).map(g => {
    // Caller first, so "You + N others" always names them
    const ordered = [...g.all.filter(a => a.id === meId), ...g.all.filter(a => a.id !== meId)];
    return {
      rank:               g.rank,
      points:             g.points,
      count:              g.all.length,
      isComplete:         g.all.every(a => a.isComplete),
      includesCurrentUser: g.all.some(a => a.id === meId),
      members:            ordered.slice(0, MAX_GROUP_MEMBERS).map(a => toMember(a, meId)),
    };
  });

  return {
    groups:            pageGroups,
    page:              current,
    pageSize:          size,
    totalPages,
    totalParticipants: ranked.length,
    myRank:            myGroup?.rank ?? null,
    myPoints:          myGroup?.points ?? null,
    myTiedWith:        myGroup ? myGroup.all.length - 1 : 0,
    myPage:            myGroupIndex >= 0 ? Math.floor(myGroupIndex / size) + 1 : null,
  };
}
