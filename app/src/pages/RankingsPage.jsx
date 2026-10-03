/**
 * RankingsPage.jsx — Conference leaderboard
 * Paged list of ranks. Attendees tied on points share one row ("Ann L. + 11"),
 * which expands to show everyone in the tie.
 */

import { useEffect, useState } from 'react';
import { getLeaderboard } from '../api';
import { BottomNav } from './PassportHomePage';

const MEDAL_COLOR = { 1: '#5c8dd6', 2: '#8fafd4', 3: '#adc8f2' };

const youChip = { fontSize: 9, fontWeight: 700, background: '#1d3461', color: '#ffffff', borderRadius: 6, padding: '1px 5px', letterSpacing: '0.08em', textTransform: 'uppercase' };

function RankBadge({ rank }) {
  if (rank <= 3) {
    return (
      <div style={{
        width: 36, height: 36, flexShrink: 0,
        borderRadius: 12,
        background: rank === 1 ? 'rgba(92,141,214,0.18)' : 'rgba(173,200,242,0.12)',
        border: `1.5px solid ${MEDAL_COLOR[rank]}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: MEDAL_COLOR[rank], fontVariationSettings: "'FILL' 1" }}>
          military_tech
        </span>
      </div>
    );
  }
  return (
    <div style={{
      width: 36, height: 36, flexShrink: 0,
      borderRadius: 12,
      background: 'rgba(116,119,127,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#74777f', fontFamily: 'Manrope, sans-serif' }}>{rank}</span>
    </div>
  );
}

function Avatar({ name }) {
  const initial = (name ?? '?')[0].toUpperCase();
  return (
    <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 13, background: 'rgba(29,52,97,0.10)', border: '1.5px solid rgba(29,52,97,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#1d3461', lineHeight: 1 }}>{initial}</span>
    </div>
  );
}

/** First person's avatar with a filled "+N" tile tucked behind it. */
function TieAvatar({ name, others }) {
  return (
    <div style={{ position: 'relative', width: 58, height: 40, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: 18, top: 0, width: 40, height: 40, borderRadius: 13, background: '#1d3461', border: '2px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: others > 99 ? 11 : 13, color: '#ffffff', lineHeight: 1 }}>+{others}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, background: '#ffffff', borderRadius: 13 }}>
        <Avatar name={name} />
      </div>
    </div>
  );
}

function Points({ value, highlight }) {
  return (
    <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: highlight ? '#1d3461' : '#43474e', textAlign: 'right', flexShrink: 0 }}>
      {value}
      <span style={{ fontSize: 11, fontWeight: 600, color: '#74777f', marginLeft: 3 }}>pts</span>
    </div>
  );
}

function CompleteTag() {
  return (
    <div style={{ fontSize: 11, color: '#1a7f5a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
      Passport Complete
    </div>
  );
}

function rowStyle(isMe) {
  return {
    background: isMe ? 'linear-gradient(135deg, rgba(29,52,97,0.08) 0%, rgba(37,74,132,0.12) 100%)' : '#ffffff',
    border: isMe ? '1.5px solid rgba(29,52,97,0.25)' : '1.5px solid #e7e8e9',
    borderRadius: 18,
    padding: '12px 14px',
    boxShadow: isMe ? '0 4px 16px rgba(29,52,97,0.10)' : '0 1px 4px rgba(0,12,30,0.04)',
  };
}

function SingleRow({ group }) {
  const m  = group.members[0];
  const isMe = m.isCurrentUser;
  return (
    <div style={{ ...rowStyle(isMe), display: 'flex', alignItems: 'center', gap: 10 }}>
      <RankBadge rank={group.rank} />
      <Avatar name={m.firstName} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: isMe ? '#1d3461' : '#191c1d', display: 'flex', alignItems: 'center', gap: 6 }}>
          {m.firstName} {m.lastInitial}
          {isMe && <span style={youChip}>You</span>}
        </div>
        {group.isComplete && <CompleteTag />}
      </div>
      <Points value={group.points} highlight={isMe} />
    </div>
  );
}

function TieRow({ group, expanded, onToggle }) {
  const lead   = group.members[0];
  const others = group.count - 1;
  const isMe   = group.includesCurrentUser;
  const hidden = group.count - group.members.length;
  return (
    <div style={rowStyle(isMe)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{ all: 'unset', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <RankBadge rank={group.rank} />
        <TieAvatar name={lead.firstName} others={others} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: isMe ? '#1d3461' : '#191c1d', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isMe ? <span style={youChip}>You</span> : `${lead.firstName} ${lead.lastInitial}`}
            <span style={{ fontWeight: 700, color: '#74777f' }}>+ {others} {others === 1 ? 'other' : 'others'}</span>
          </div>
          <div style={{ fontSize: 11, color: '#74777f', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>group</span>
            {group.count}-way tie
            {group.isComplete && <span style={{ color: '#1a7f5a' }}> · Passports Complete</span>}
            <span className="material-symbols-outlined" style={{ fontSize: 16, marginLeft: 'auto' }}>{expanded ? 'expand_less' : 'expand_more'}</span>
          </div>
        </div>
        <Points value={group.points} highlight={isMe} />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e7e8e9' }}>
          {group.members.map((m, i) => (
            <span
              key={`${m.firstName}-${m.lastInitial}-${i}`}
              style={{
                fontSize: 12, fontWeight: 700, borderRadius: 10, padding: '4px 10px',
                background: m.isCurrentUser ? '#1d3461' : 'rgba(29,52,97,0.08)',
                color: m.isCurrentUser ? '#ffffff' : '#1d3461',
              }}
            >
              {m.isCurrentUser ? 'You' : `${m.firstName} ${m.lastInitial}`}
            </span>
          ))}
          {hidden > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: '4px 10px', color: '#74777f' }}>+{hidden} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function PagerButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 44, height: 44, borderRadius: 14, border: '1.5px solid #e7e8e9',
        background: disabled ? 'transparent' : '#ffffff',
        color: disabled ? '#c3c6cf' : '#1d3461',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{icon}</span>
    </button>
  );
}

export default function RankingsPage() {
  const [page, setPage]         = useState(1);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const d = await getLeaderboard(page);
        if (!cancelled) {
          setData(d);
          setExpanded(new Set());
        }
      } catch {
        if (!cancelled) setError('Could not load rankings. Try refreshing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page]);

  const groups            = data?.groups ?? [];
  const myRank            = data?.myRank ?? null;
  const totalParticipants = data?.totalParticipants ?? 0;
  const currentPage       = data?.page ?? 1;
  const totalPages        = data?.totalPages ?? 1;
  const myPage            = data?.myPage ?? null;

  function goTo(p) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggle(rank) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank); else next.add(rank);
      return next;
    });
  }

  const firstLoad = loading && !data;

  return (
    <div style={{ background: '#f0f2f8', minHeight: '100dvh', paddingBottom: 100 }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(145deg, #0d1e3c 0%, #1d3461 55%, #254a84 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 16px) + 20px)',
        paddingBottom: 28,
        paddingLeft: 24,
        paddingRight: 24,
        borderRadius: '0 0 2rem 2rem',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 }}>
          Conference Passport
        </div>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#ffffff', letterSpacing: '-0.4px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
          Rankings
        </div>

        {/* Your rank card */}
        {!firstLoad && myRank && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Your Rank</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 32, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1 }}>
                #{myRank}
              </div>
              {data.myTiedWith > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  tied with {data.myTiedWith}
                </div>
              )}
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Your Points</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 32, color: '#adc8f2', letterSpacing: '-1px', lineHeight: 1 }}>
                {data.myPoints}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Total</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 32, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1 }}>
                {totalParticipants}
              </div>
            </div>
          </div>
        )}

        {firstLoad && (
          <div style={{ display: 'flex', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: 74, borderRadius: 18, background: 'rgba(255,255,255,0.08)', animation: 'skeleton-wave 1.4s ease infinite' }} />
            ))}
          </div>
        )}
      </header>

      {/* ── List ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 0' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ height: 64, borderRadius: 18, background: '#e2e5ed', animation: 'skeleton-wave 1.4s ease infinite' }} />
            ))}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {!loading && !error && (
          <>
            {/* Section label + jump to my rank */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#74777f', fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {totalPages > 1 ? `Page ${currentPage} of ${totalPages}` : 'All Participants'}
              </span>
              {myPage && myPage !== currentPage && (
                <button
                  type="button"
                  onClick={() => goTo('me')}
                  style={{ marginLeft: 'auto', border: 'none', borderRadius: 10, padding: '5px 10px', background: '#1d3461', color: '#ffffff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>my_location</span>
                  Find me
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups.map(g => (
                g.count > 1
                  ? <TieRow key={g.rank} group={g} expanded={expanded.has(g.rank)} onToggle={() => toggle(g.rank)} />
                  : <SingleRow key={g.rank} group={g} />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
                <PagerButton icon="chevron_left" label="Previous page" disabled={currentPage <= 1} onClick={() => goTo(currentPage - 1)} />
                <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 800, color: '#43474e' }}>
                  {currentPage} / {totalPages}
                </span>
                <PagerButton icon="chevron_right" label="Next page" disabled={currentPage >= totalPages} onClick={() => goTo(currentPage + 1)} />
              </div>
            )}

            {groups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#74777f' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, color: '#c3c6cf' }}>leaderboard</span>
                No rankings yet — check back after visiting some sponsors!
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="/rankings" />
    </div>
  );
}
