/**
 * PassportHomePage.jsx — Gamified passport hub
 * v4: Next Stop hero, Up Next list, Collected section, Rankings nav tab
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSponsors, getProgress, updateAttendeeName } from '../api';
import { Flame } from 'lucide-react';
import useCountUp from '../hooks/useCountUp';
import SponsorSheet from '../components/SponsorSheet';
import SponsorLogo from '../components/SponsorLogo';
import ScanFab from '../components/ScanFab';

function getRank(pct) {
  if (pct >= 100) return { label: 'Passport Master', icon: 'emoji_events' };
  if (pct >= 75)  return { label: 'Connector',       icon: 'bolt' };
  if (pct >= 50)  return { label: 'Networker',       icon: 'handshake' };
  if (pct >= 25)  return { label: 'Trailblazer',     icon: 'hiking' };
  return           { label: 'Explorer',              icon: 'explore' };
}

const TIER_CFG = {
  leadership:  { avatarBg: 'rgba(29,52,97,0.10)', avatarColor: '#1d3461', borderColor: 'rgba(29,52,97,0.18)' },
  partnership: { avatarBg: 'rgba(37,74,132,0.08)', avatarColor: '#254a84', borderColor: 'rgba(37,74,132,0.15)' },
};
function tierCfg(tier) { return TIER_CFG[tier] ?? { avatarBg: '#f3f4f5', avatarColor: '#43474e', borderColor: '#e7e8e9' }; }

function SectionLabel({ icon, children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#74777f', fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{children}</span>
      </div>
      {right && <span style={{ fontSize: 11, fontWeight: 700, color: '#c3c6cf' }}>{right}</span>}
    </div>
  );
}

function HeroCard({ sponsor, onTap }) {
  const initial = (sponsor.name ?? '?')[0].toUpperCase();
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%', textAlign: 'left',
        background: 'linear-gradient(140deg, #0d1e3c 0%, #1d3461 55%, #254a84 100%)',
        border: 'none', borderRadius: 24,
        padding: '20px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer',
        boxShadow: '0 10px 36px rgba(13,30,60,0.28)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(13,30,60,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 10px 36px rgba(13,30,60,0.28)'; }}
    >
      <SponsorLogo
        sponsor={sponsor}
        size={60}
        radius={20}
        imgPadding={8}
        border="1.5px solid rgba(255,255,255,0.15)"
        fallbackBg="rgba(255,255,255,0.12)"
        fallback={<span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#ffffff', lineHeight: 1 }}>{initial}</span>}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(173,200,242,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 5 }}>Recommended next stop</div>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18, color: '#ffffff', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.name}</div>
        {sponsor.tagline && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.tagline}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 7px' }}>
            {sponsor.tier === 'leadership' ? '◆ ' : ''}{sponsor.tier}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{sponsor.points ?? sponsor.pointValue} pts</span>
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ color: 'rgba(173,200,242,0.8)', fontSize: 26, flexShrink: 0 }}>arrow_forward</span>
    </button>
  );
}

function SponsorCard({ sponsor, onTap }) {
  const cfg        = tierCfg(sponsor.tier);
  const initial    = (sponsor.name ?? '?')[0].toUpperCase();
  const isLeadership = sponsor.tier === 'leadership';
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onTap}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={isLeadership ? 'sponsor-card--leadership' : ''}
      style={{
        width: '100%', textAlign: 'left',
        background: '#ffffff',
        border: `1.5px solid ${hov ? 'rgba(29,52,97,0.25)' : '#e7e8e9'}`,
        borderRadius: 20, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer',
        boxShadow: hov ? '0 6px 20px rgba(0,12,30,0.12)' : '0 2px 8px rgba(0,12,30,0.05)',
        transform: hov ? 'translateY(-2px)' : '',
        transition: 'box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease',
      }}
    >
      <SponsorLogo
        sponsor={sponsor}
        size={48}
        radius={14}
        imgPadding={6}
        border={`1.5px solid ${sponsor.logoUrl ? 'rgba(29,52,97,0.3)' : cfg.borderColor}`}
        fallbackBg={cfg.avatarBg}
        fallback={<span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18, color: cfg.avatarColor, lineHeight: 1 }}>{initial}</span>}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: '#1d3461', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.name}</div>
        {sponsor.tagline && <div style={{ fontSize: 12, color: '#74777f', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.tagline}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`sponsor-badge sponsor-badge--${sponsor.tier}`}>{isLeadership ? '◆ ' : ''}{sponsor.tier}</span>
          <span style={{ fontSize: 12, color: '#74777f', fontWeight: 600 }}>{sponsor.points ?? sponsor.pointValue} pts</span>
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ color: '#c3c6cf', fontSize: 20, flexShrink: 0 }}>chevron_right</span>
    </button>
  );
}

function CollectedCard({ sponsor }) {
  const initial = (sponsor.name ?? '?')[0].toUpperCase();
  return (
    <div style={{ background: '#f0faf5', border: '1.5px solid #b2dfcf', borderRadius: 18, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <SponsorLogo
        sponsor={sponsor}
        size={42}
        radius={13}
        imgPadding={5}
        border="1.5px solid #b2dfcf"
        fallbackBg="rgba(26,127,90,0.12)"
        fallback={<span className="material-symbols-outlined" style={{ color: '#1a7f5a', fontSize: 22, fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: '#1a7f5a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.name}</div>
        <div style={{ fontSize: 12, color: '#2d8c6a', fontWeight: 600 }}>+{sponsor.points ?? sponsor.pointValue} pts collected</div>
      </div>
      <span className="material-symbols-outlined" style={{ color: '#1a7f5a', fontSize: 18, fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>workspace_premium</span>
    </div>
  );
}

export function BottomNav({ active }) {
  const navigate = useNavigate();
  const items = [
    { icon: 'confirmation_number', label: 'Passport', path: '/' },
    { icon: 'leaderboard',         label: 'Rankings', path: '/rankings' },
    { icon: 'help',                label: 'Help',     path: '/help' },
  ];
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(13,30,60,0.88)', WebkitBackdropFilter: 'blur(24px)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 100 }}>
      {items.map(item => {
        const isActive = active === item.path;
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{ flex: 1, padding: '14px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: isActive ? '#adc8f2' : 'rgba(255,255,255,0.45)', transition: 'color 150ms' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function PassportHomePage() {
  const { attendee, updateAttendee } = useAuth();
  const navigate = useNavigate();

  const [sponsors, setSponsors]           = useState([]);
  const [progress, setProgress]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [sheet, setSheet]                 = useState(null);
  const [stampResult, setStampResult]     = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const prevPctRef                        = useRef(0);
  const barRef                            = useRef(null);

  // Name gate state
  const [showNameGate, setShowNameGate]   = useState(false);
  const [nameFirst, setNameFirst]         = useState('');
  const [nameLast, setNameLast]           = useState('');
  const [nameSaving, setNameSaving]       = useState(false);
  const [nameError, setNameError]         = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sData, pData] = await Promise.all([getSponsors(), getProgress()]);
        if (!cancelled) {
          setSponsors(sData.sponsors ?? []);
          setProgress(pData);
          // Show name gate if attendee has no first name yet
          if (!pData?.firstName && !attendee?.firstName) {
            setShowNameGate(true);
          }
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

  const points       = progress?.points ?? 0;
  const threshold    = progress?.threshold ?? 0;
  const completed    = progress?.completed ?? false;
  const checkedInIds = new Set(progress?.checkedInSponsorIds ?? []);
  const firstName    = progress?.firstName ?? attendee?.firstName ?? '';
  const pct          = threshold > 0 ? Math.min((points / threshold) * 100, 100) : 0;
  const almostThere  = !completed && threshold > 0 && points >= threshold * 0.8 && points < threshold;
  const rank         = getRank(pct);

  // Animated points counter
  const displayPoints = useCountUp(points, 1000);

  // Refresh progress from server (called after a successful check-in)
  async function refreshProgress() {
    try {
      const pData = await getProgress();
      setProgress(pData);
    } catch { /* silent */ }
  }

  // Save name from gate modal
  async function handleSaveName(e) {
    e.preventDefault();
    setNameError('');
    if (!nameFirst.trim()) { setNameError('Please enter your first name.'); return; }
    if (!nameLast.trim())  { setNameError('Please enter your last name.');  return; }
    setNameSaving(true);
    try {
      await updateAttendeeName(nameFirst.trim(), nameLast.trim());
      // Update local auth context so the header greeting updates immediately
      updateAttendee({ firstName: nameFirst.trim(), lastName: nameLast.trim() });
      setProgress(prev => prev ? { ...prev, firstName: nameFirst.trim() } : prev);
      setShowNameGate(false);
    } catch (err) {
      setNameError(err.message ?? 'Could not save your name. Please try again.');
    } finally {
      setNameSaving(false);
    }
  }

  // Sheet success handler
  function handleCheckinSuccess(result) {
    setSheet(null);
    setStampResult(result);
    refreshProgress();
    setTimeout(() => setStampResult(null), 4000);
  }

  // Milestone pulse: fire when pct crosses 25/50/75/100%
  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    const prev = prevPctRef.current;
    const crossed = milestones.some(m => prev < m && pct >= m);
    if (crossed && barRef.current) {
      barRef.current.classList.remove('progress-milestone-pulse');
      void barRef.current.offsetWidth; // force reflow to restart animation
      barRef.current.classList.add('progress-milestone-pulse');
      const t = setTimeout(() => barRef.current?.classList.remove('progress-milestone-pulse'), 800);
      return () => clearTimeout(t);
    }
    prevPctRef.current = pct;
  }, [pct]);

  if (completed) { navigate('/completed', { replace: true }); return null; }

  const activeSponsors = sponsors
    .filter(s => s.isActive)
    .sort((a, b) => {
      if (a.tier === 'leadership' && b.tier !== 'leadership') return -1;
      if (a.tier !== 'leadership' && b.tier === 'leadership') return 1;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });

  const todoSponsors = activeSponsors.filter(s => !checkedInIds.has(s.id));
  const doneSponsors = activeSponsors.filter(s =>  checkedInIds.has(s.id));
  const nextStop     = todoSponsors[0] ?? null;
  const upNext       = todoSponsors.slice(1);

  return (
    <div style={{ background: '#f0f2f8', minHeight: '100dvh', paddingBottom: 100 }}>

      {/* ── Name gate overlay ────────────────────────────────── */}
      {showNameGate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,30,60,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#ffffff', borderRadius: 28, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 30, color: '#ffffff', fontVariationSettings: "'FILL' 1" }}>badge</span>
            </div>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#1d3461', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.3px' }}>
              One quick thing!
            </h2>
            <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
              Enter your name so you appear on the leaderboard and prize drawing list.
            </p>
            <form onSubmit={handleSaveName}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="field">
                  <label className="label" htmlFor="ng-firstName">First name</label>
                  <input
                    id="ng-firstName"
                    className="input"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Jane"
                    value={nameFirst}
                    onChange={e => { setNameFirst(e.target.value); setNameError(''); }}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="ng-lastName">Last name</label>
                  <input
                    id="ng-lastName"
                    className="input"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Smith"
                    value={nameLast}
                    onChange={e => { setNameLast(e.target.value); setNameError(''); }}
                  />
                </div>
              </div>
              {nameError && <p className="error-msg" style={{ marginBottom: 12 }}>{nameError}</p>}
              <button
                type="submit"
                disabled={nameSaving}
                style={{ width: '100%', background: nameSaving ? '#c3c6cf' : 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)', color: '#ffffff', border: 'none', borderRadius: 16, height: 52, fontSize: 16, fontFamily: 'Manrope, sans-serif', fontWeight: 800, cursor: nameSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: nameSaving ? 'none' : '0 4px 16px rgba(0,12,30,0.28)' }}
              >
                {nameSaving ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }} /> Saving…</>
                ) : (
                  <>Continue to Passport <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span></>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(145deg, #0d1e3c 0%, #1d3461 55%, #254a84 100%)',
        paddingTop:    'calc(env(safe-area-inset-top, 16px) + 20px)',
        paddingBottom: 28,
        paddingLeft:   24,
        paddingRight:  24,
        borderRadius: '0 0 2rem 2rem',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 }}>
              Conference Passport
            </div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#ffffff', letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {firstName ? (
                <>Hey, {firstName}!&nbsp;<span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>waving_hand</span></>
              ) : 'Your Passport'}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 9999, padding: '8px 16px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, boxShadow: '0 2px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12, minWidth: 72, textAlign: 'center' }}>
            {displayPoints} pts
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
            <span>{displayPoints} / {threshold} pts to complete</span>
            <span style={{ color: 'rgba(173,200,242,0.9)', fontWeight: 700 }}>{Math.round(pct)}%</span>
          </div>
          <div style={{ height: 12, borderRadius: 9999, background: 'rgba(255,255,255,0.12)', overflow: 'visible', position: 'relative' }}>
            <div
              ref={barRef}
              className="progress-fill"
              style={{
                height: '100%', width: `${pct}%`, borderRadius: 9999,
                background: 'linear-gradient(90deg, #6ea8d8, #adc8f2)',
                transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                position: 'relative',
              }}
            />
          </div>
          {/* Milestone ticks */}
          <div style={{ position: 'relative', marginTop: 6, height: 14 }}>
            {[25, 50, 75, 100].map(m => (
              <div key={m} style={{ position: 'absolute', left: `${m}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <div style={{ width: 1, height: 4, background: pct >= m ? 'rgba(173,200,242,0.7)' : 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: pct >= m ? 'rgba(173,200,242,0.8)' : 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
                  {m === 100 ? '✓' : `${m}%`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rank badge */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9999, padding: '5px 12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#adc8f2', fontVariationSettings: "'FILL' 1" }}>{rank.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#adc8f2' }}>{rank.label}</span>
          </div>
          {!loading && doneSponsors.length > 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              {doneSponsors.length} of {activeSponsors.length} stops collected
            </div>
          )}
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 0', position: 'relative', zIndex: 1 }}>

        {almostThere && (
          <div className="almost-there-banner" style={{ marginBottom: 16 }}>
            <Flame size={17} />
            Almost there! Just a few more stops and you&rsquo;re in the drawing!
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 86, borderRadius: 20, background: '#e2e5ed', animation: 'skeleton-wave 1.4s ease infinite', backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Next Stop ──────────────────────────────── */}
            {nextStop && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel icon="near_me">Next Stop</SectionLabel>
                <HeroCard sponsor={nextStop} onTap={() => setSheet(nextStop)} />
              </div>
            )}

            {/* ── Up Next ────────────────────────────────── */}
            {upNext.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel icon="list_alt" right={`${upNext.length} remaining`}>Up Next</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upNext.map(sponsor => (
                    <SponsorCard key={sponsor.id} sponsor={sponsor} onTap={() => setSheet(sponsor)} />
                  ))}
                </div>
              </div>
            )}

            {/* All stops done message */}
            {todoSponsors.length === 0 && doneSponsors.length > 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0 8px', marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#1a7f5a', fontVariationSettings: "'FILL' 1", display: 'block', marginBottom: 8 }}>task_alt</span>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 17, color: '#1a7f5a', marginBottom: 4 }}>All stops collected!</div>
                <div style={{ fontSize: 13, color: '#74777f' }}>You&rsquo;ve visited every sponsor — great work.</div>
              </div>
            )}

            {/* ── Collected ──────────────────────────────── */}
            {doneSponsors.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCompleted ? 10 : 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#1a7f5a', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a7f5a', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Collected</span>
                    <span style={{ background: '#1a7f5a', color: '#ffffff', borderRadius: 9999, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{doneSponsors.length}</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#74777f' }}>{showCompleted ? 'expand_less' : 'expand_more'}</span>
                </button>
                {showCompleted && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {doneSponsors.map(sponsor => (
                      <CollectedCard key={sponsor.id} sponsor={sponsor} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {sheet && <SponsorSheet sponsor={sheet} onClose={() => setSheet(null)} onSuccess={handleCheckinSuccess} />}

      {stampResult && (
        <>
          <div className="points-flash">+{stampResult.pointsAwarded ?? stampResult.points} pts</div>
          <div className="overlay" onClick={() => setStampResult(null)}>
            <div className="overlay-card" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div className="stamp-seal">
                  <span className="material-symbols-outlined" style={{ color: '#1a7f5a', fontSize: 36, fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
              </div>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, color: '#1d3461', marginBottom: 8, letterSpacing: '-0.5px' }}>Stamped!</h2>
              {(stampResult.pointsAwarded ?? stampResult.points) && (
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 44, color: '#1d3461', letterSpacing: '-1px', marginBottom: 10, lineHeight: 1 }}>
                  +{stampResult.pointsAwarded ?? stampResult.points} pts
                </div>
              )}
              <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                {stampResult.message ?? 'Keep visiting more sponsors to earn points!'}
              </p>
              <button onClick={() => setStampResult(null)} style={{ width: '100%', background: 'linear-gradient(135deg, #1d3461, #254a84)', color: '#ffffff', border: 'none', borderRadius: 16, height: 54, fontSize: 16, fontFamily: 'Manrope, sans-serif', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(29,52,97,0.25)' }}>
                Back to Passport
              </button>
            </div>
          </div>
        </>
      )}

      {!sheet && <ScanFab />}
      <BottomNav active="/" />
    </div>
  );
}