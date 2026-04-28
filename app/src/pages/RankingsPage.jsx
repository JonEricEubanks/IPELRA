/**
 * RankingsPage.jsx — Conference leaderboard
 * Shows top-50 attendees by points. Current user is always shown and highlighted.
 */

import { useEffect, useState } from 'react';
import { getLeaderboard } from '../api';
import { BottomNav } from './PassportHomePage';

const MEDAL = { 1: 'military_tech', 2: 'military_tech', 3: 'military_tech' };
const MEDAL_COLOR = { 1: '#5c8dd6', 2: '#8fafd4', 3: '#adc8f2' };

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

export default function RankingsPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const d = await getLeaderboard();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setError('Could not load rankings. Try refreshing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const rankings         = data?.rankings ?? [];
  const myRank           = data?.myRank ?? null;
  const totalParticipants = data?.totalParticipants ?? 0;
  const myEntry          = rankings.find(r => r.isCurrentUser);

  // Split at separator if user is appended outside top 50
  const mainList    = rankings.filter(r => !r.isSeparate);
  const separateRow = rankings.find(r => r.isSeparate);

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
        {!loading && myRank && myEntry && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Your Rank</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 32, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1 }}>
                #{myRank}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Your Points</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 32, color: '#adc8f2', letterSpacing: '-1px', lineHeight: 1 }}>
                {myEntry.points}
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

        {loading && (
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
            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#74777f', fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {mainList.length < totalParticipants ? `Top ${mainList.length}` : 'All Participants'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mainList.map(entry => {
                const isMe = entry.isCurrentUser;
                return (
                  <div
                    key={`${entry.rank}-${entry.firstName}`}
                    style={{
                      background: isMe ? 'linear-gradient(135deg, rgba(29,52,97,0.08) 0%, rgba(37,74,132,0.12) 100%)' : '#ffffff',
                      border: isMe ? '1.5px solid rgba(29,52,97,0.25)' : '1.5px solid #e7e8e9',
                      borderRadius: 18,
                      padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      boxShadow: isMe ? '0 4px 16px rgba(29,52,97,0.10)' : '0 1px 4px rgba(0,12,30,0.04)',
                    }}
                  >
                    <RankBadge rank={entry.rank} />
                    <Avatar name={entry.firstName} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: isMe ? '#1d3461' : '#191c1d', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {entry.firstName} {entry.lastInitial}
                        {isMe && <span style={{ fontSize: 9, fontWeight: 700, background: '#1d3461', color: '#ffffff', borderRadius: 6, padding: '1px 5px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>You</span>}
                      </div>
                      {entry.isComplete && (
                        <div style={{ fontSize: 11, color: '#1a7f5a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                          Passport Complete
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: isMe ? '#1d3461' : '#43474e', textAlign: 'right', flexShrink: 0 }}>
                      {entry.points}
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#74777f', marginLeft: 3 }}>pts</span>
                    </div>
                  </div>
                );
              })}

              {/* User outside top 50 */}
              {separateRow && (
                <>
                  <div style={{ textAlign: 'center', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 1, background: '#e7e8e9' }} />
                    <span style={{ fontSize: 11, color: '#c3c6cf', fontWeight: 600 }}>your position</span>
                    <div style={{ flex: 1, height: 1, background: '#e7e8e9' }} />
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(29,52,97,0.08) 0%, rgba(37,74,132,0.12) 100%)', border: '1.5px solid rgba(29,52,97,0.25)', borderRadius: 18, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 16px rgba(29,52,97,0.10)' }}>
                    <RankBadge rank={separateRow.rank} />
                    <Avatar name={separateRow.firstName} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: '#1d3461', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {separateRow.firstName} {separateRow.lastInitial}
                        <span style={{ fontSize: 9, fontWeight: 700, background: '#1d3461', color: '#ffffff', borderRadius: 6, padding: '1px 5px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>You</span>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: '#1d3461', textAlign: 'right', flexShrink: 0 }}>
                      {separateRow.points}
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#74777f', marginLeft: 3 }}>pts</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {rankings.length === 0 && (
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
