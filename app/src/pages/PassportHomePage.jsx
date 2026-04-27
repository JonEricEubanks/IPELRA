/**
 * PassportHomePage.jsx — / (main authenticated page)
 * M3 design: signature gradient header · tonal sponsor cards · glassmorphism bottom nav
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSponsors, getProgress } from '../api';
import { Flame } from 'lucide-react';

export default function PassportHomePage() {
  const { attendee } = useAuth();
  const navigate = useNavigate();

  const [sponsors, setSponsors]   = useState([]);
  const [progress, setProgress]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sData, pData] = await Promise.all([getSponsors(), getProgress()]);
        if (!cancelled) {
          setSponsors(sData.sponsors ?? []);
          setProgress(pData);
        }
      } catch {
        if (!cancelled) setError('Could not load your passport. Try refreshing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const points        = progress?.points ?? 0;
  const threshold     = progress?.threshold ?? 0;
  const completed     = progress?.completed ?? false;
  const checkedInIds  = new Set(progress?.checkedInSponsorIds ?? []);
  const firstName     = progress?.firstName ?? attendee?.firstName ?? '';
  const pct           = threshold > 0 ? Math.min((points / threshold) * 100, 100) : 0;
  const almostThere   = !completed && threshold > 0 && points >= threshold * 0.8 && points < threshold;

  if (completed) { navigate('/completed', { replace: true }); return null; }

  const activeSponsors = sponsors.filter(s => s.isActive);

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f5', paddingBottom: 96 }}>

      {/* ── Gradient header ─────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(135deg, #000c1e 0%, #002344 100%)',
        paddingTop:   `calc(env(safe-area-inset-top, 16px) + 20px)`,
        paddingBottom: 28,
        paddingLeft:   24,
        paddingRight:  24,
        borderRadius: '0 0 2rem 2rem',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 }}>
              Conference Passport
            </div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#ffffff', letterSpacing: '-0.4px' }}>
              {firstName ? `Hey, ${firstName}! 👋` : 'Your Passport'}
            </div>
          </div>
          {/* Points gold pill */}
          <div style={{ background: '#fed488', color: '#5d4201', borderRadius: 9999, padding: '8px 16px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, boxShadow: '0 2px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}>
            {points} pts
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
            <span>{points} / {threshold} pts to complete</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 9999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 9999,
              background: 'linear-gradient(90deg, #adc8f2, #ffdea5)',
              transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 0' }}>

        {almostThere && (
          <div className="almost-there-banner" style={{ marginBottom: 16 }}>
            <Flame size={17} />
            Almost there! Just a few more stops and you&rsquo;re in the drawing!
          </div>
        )}

        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 17, color: '#191c1d', letterSpacing: '-0.3px' }}>
            Sponsor Stops
          </h2>
          {!loading && activeSponsors.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#74777f' }}>
              {checkedInIds.size} / {activeSponsors.length} visited
            </span>
          )}
        </div>

        {/* Skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 86, borderRadius: 20 }} />
            ))}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {/* Sponsor stop cards */}
        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeSponsors.map(sponsor => {
              const done    = checkedInIds.has(sponsor.id);
              const initial = (sponsor.name ?? '?')[0].toUpperCase();
              return (
                <button
                  key={sponsor.id}
                  onClick={() => !done && navigate(`/sponsor/${sponsor.id}`)}
                  disabled={done}
                  onMouseEnter={e => { if (!done) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,12,30,0.10)'; e.currentTarget.style.borderColor = '#002344'; }}}
                  onMouseLeave={e => { if (!done) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,12,30,0.05)'; e.currentTarget.style.borderColor = '#e7e8e9'; }}}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: done ? '#d1fae5' : '#ffffff',
                    border: `1.5px solid ${done ? '#1a7f5a' : '#e7e8e9'}`,
                    borderRadius: 20,
                    padding: '16px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: done ? 'default' : 'pointer',
                    boxShadow: done ? 'none' : '0 2px 8px rgba(0,12,30,0.05)',
                    transition: 'all 200ms ease',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 52, height: 52, flexShrink: 0,
                    borderRadius: 16,
                    background: done ? '#d1fae5' : '#f3f4f5',
                    border: `1.5px solid ${done ? '#1a7f5a' : '#e7e8e9'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done
                      ? <span className="material-symbols-outlined" style={{ color: '#1a7f5a', fontSize: 26, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      : <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, color: '#43474e' }}>{initial}</span>
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: done ? '#1a7f5a' : '#000c1e', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sponsor.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#74777f', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {done ? (
                        <span style={{ color: '#1a7f5a', fontWeight: 700 }}>Stamped!</span>
                      ) : (
                        <>
                          {sponsor.tier && (
                            <span style={{
                              background: sponsor.tier === 'platinum' ? '#e7e8e9' : 'rgba(254,212,136,0.3)',
                              color:      sponsor.tier === 'platinum' ? '#43474e' : '#775a19',
                              border:     `1px solid ${sponsor.tier === 'platinum' ? '#c3c6cf' : 'rgba(254,212,136,0.6)'}`,
                              borderRadius: 9999, padding: '2px 8px',
                              fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px',
                            }}>
                              {sponsor.tier}
                            </span>
                          )}
                          <span style={{ color: '#c3c6cf' }}>·</span>
                          <span>{sponsor.points} pts</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  {!done && (
                    <span className="material-symbols-outlined" style={{ color: '#c3c6cf', fontSize: 22, flexShrink: 0 }}>chevron_right</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom nav — glassmorphism ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(248,249,250,0.88)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(195,198,207,0.4)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 100,
      }}>
        {[
          { icon: 'confirmation_number', label: 'Passport', path: '/' },
          { icon: 'help',                label: 'Help',     path: '/help' },
        ].map(item => {
          const active = window.location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1, padding: '14px 0 10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? '#000c1e' : '#74777f',
                transition: 'color 150ms',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

