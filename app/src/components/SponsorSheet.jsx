/**
 * SponsorSheet.jsx — Immersive sponsor experience + inline check-in
 * v4: full sponsor profile page, collapsible context panel in question phase
 *
 * Props:
 *   sponsor   — sponsor object from getSponsors
 *   onClose   — called when user dismisses the sheet
 *   onSuccess — called with the checkin result when correct answer submitted
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitCheckin } from '../api';
import SponsorLogo from './SponsorLogo';
import QrScannerSheet from './QrScannerSheet';

// ── Tier colour config ──────────────────────────────────────────────────────
const TIER = {
  leadership: {
    heroGrad:    'linear-gradient(145deg, #1a0a4e 0%, #2d1b6e 45%, #3b2f8c 100%)',
    accentColor: '#a78bfa',
    accentLight: 'rgba(167,139,250,0.12)',
    accentBorder:'rgba(167,139,250,0.3)',
    badgeBg:     'rgba(167,139,250,0.15)',
    badgeText:   '#ddd6fe',
    orb1:        'rgba(124,58,237,0.35)',
    orb2:        'rgba(167,139,250,0.12)',
    pillBg:      'rgba(167,139,250,0.15)',
    pillBorder:  'rgba(167,139,250,0.3)',
    pointsBg:    'linear-gradient(135deg, #4c1d95, #7c3aed)',
    avatarBg:    'linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)',
    label:       '◆ Leadership',
  },
  partnership: {
    heroGrad:    'linear-gradient(145deg, #1d3461 0%, #254a84 100%)',
    accentColor: '#6ea8d8',
    accentLight: 'rgba(110,168,216,0.1)',
    accentBorder:'rgba(110,168,216,0.28)',
    badgeBg:     'rgba(110,168,216,0.14)',
    badgeText:   '#adc8f2',
    orb1:        'rgba(37,74,132,0.3)',
    orb2:        'rgba(110,168,216,0.1)',
    pillBg:      'rgba(110,168,216,0.15)',
    pillBorder:  'rgba(110,168,216,0.3)',
    pointsBg:    'linear-gradient(135deg, #1d3461, #254a84)',
    avatarBg:    'linear-gradient(135deg, #1d3461 0%, #254a84 100%)',
    label:       '★ Partnership',
  },
};
function getTier(tier) { return TIER[tier] ?? TIER.partnership; }

export default function SponsorSheet({ sponsor, onClose, onSuccess }) {
  const [phase,        setPhase]        = useState('profile');
  const [answer,       setAnswer]       = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [serverHint,   setServerHint]   = useState('');
  const [attempts,     setAttempts]     = useState(0);
  const [shaking,      setShaking]      = useState(false);
  const [closing,      setClosing]      = useState(false);
  const [contextOpen,  setContextOpen]  = useState(false);
  const [scanning,     setScanning]     = useState(false);
  const shakeRef  = useRef(null);
  const answerRef = useRef(null);
  const navigate  = useNavigate();

  // Auto-focus answer input when entering question phase
  useEffect(() => {
    if (phase === 'question') {
      const t = setTimeout(() => answerRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Escape closes sheet
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function dismiss() {
    setClosing(true);
    setTimeout(onClose, 300);
  }

  function goToQuestion() {
    setPhase('question');
    setAnswer('');
    setSubmitError('');
    setServerHint('');
  }

  function backToProfile() {
    setPhase('profile');
    setAnswer('');
    setSubmitError('');
    setServerHint('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    setServerHint('');
    try {
      const result = await submitCheckin(sponsor.id, { answer: answer.trim() });
      onSuccess(result);
    } catch (err) {
      setAttempts(a => a + 1);
      if (err?.hint) setServerHint(err.hint);
      if      (err?.status === 422) setSubmitError(err.message || 'Not quite right — give it another try!');
      else if (err?.status === 400) setSubmitError('Invalid submission. Please try again.');
      else if (err?.status === 423) setSubmitError(err.message || 'The passport is not open yet.');
      else                          setSubmitError('Something went wrong. Please try again.');
      setShaking(true);
      clearTimeout(shakeRef.current);
      shakeRef.current = setTimeout(() => setShaking(false), 500);
    } finally {
      setSubmitting(false);
    }
  }

  const tc      = getTier(sponsor.tier);
  const initial  = (sponsor.name ?? '?')[0].toUpperCase();
  const points   = sponsor.points ?? sponsor.pointValue;

  let websiteHost = sponsor.website ?? '';
  try { websiteHost = new URL(sponsor.website).hostname.replace('www.', ''); } catch { /* raw */ }

  return (
    <>
      {/* Backdrop */}
      <div
        className="sheet-backdrop"
        onClick={dismiss}
        style={{ opacity: closing ? 0 : 1, transition: 'opacity 0.28s ease' }}
      />

      {/* Sheet */}
      <div className={`bottom-sheet${closing ? ' closing' : ''}`}>
        {/* Drag handle */}
        <div className="bottom-sheet__handle" />

        <div className="bottom-sheet__scroll">

          {/* ══════════════════════════════════════════
              PHASE 1 — SPONSOR PROFILE
          ══════════════════════════════════════════ */}
          {phase === 'profile' && (
            <>
              {/* Full-bleed hero */}
              <div style={{
                background: tc.heroGrad,
                margin: '-16px -20px 0',
                padding: '22px 22px 28px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Decorative orbs */}
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: tc.orb1, filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -20, left: 20, width: 100, height: 100, borderRadius: '50%', background: tc.orb2, filter: 'blur(30px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Top bar: tier badge + close */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <span style={{
                      background: tc.badgeBg,
                      color: tc.badgeText,
                      border: `1px solid ${tc.accentBorder}`,
                      borderRadius: 9999, padding: '4px 14px',
                      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>
                      {tc.label} Sponsor
                    </span>
                    <button
                      onClick={dismiss}
                      aria-label="Close"
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </div>

                  {/* Logo + name */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
                    <SponsorLogo
                      sponsor={sponsor}
                      size={76}
                      radius={22}
                      imgPadding={8}
                      border={`2px solid ${tc.accentBorder}`}
                      boxShadow={`0 4px 24px rgba(0,0,0,0.3), 0 0 0 4px ${tc.accentLight}`}
                      fallbackBg="rgba(255,255,255,0.1)"
                      fallback={<span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 26, color: 'rgba(255,255,255,0.92)' }}>{initial}</span>}
                    />

                    <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                      <h2 style={{
                        fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 22,
                        color: '#ffffff', letterSpacing: '-0.4px', lineHeight: 1.15, marginBottom: 8,
                      }}>
                        {sponsor.name}
                      </h2>
                      {sponsor.tagline && (
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                          &ldquo;{sponsor.tagline}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reward pill */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: tc.pillBg,
                    border: `1px solid ${tc.pillBorder}`,
                    borderRadius: 9999, padding: '7px 16px',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#adc8f2', fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: '#adc8f2' }}>
                      Earn <strong style={{ fontSize: 16 }}>{points}</strong> passport points
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ paddingTop: 22 }}>

                {/* About section */}
                {sponsor.description && (
                  <div style={{
                    background: tc.accentLight,
                    border: `1.5px solid ${tc.accentBorder}`,
                    borderRadius: 18,
                    padding: '16px 18px',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 9, background: tc.pointsBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#fff', fontVariationSettings: "'FILL' 1" }}>apartment</span>
                      </div>
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 11, color: tc.accentColor, textTransform: 'uppercase', letterSpacing: '0.15em' }}>About this Sponsor</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#3c3f4a', lineHeight: 1.75, margin: 0 }}>
                      {sponsor.description}
                    </p>
                  </div>
                )}

                {/* Quick facts */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10, padding: '7px 12px' }}>
                    <span style={{ fontSize: 14 }}>{sponsor.tier === 'leadership' ? '◆' : '★'}</span>
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12, color: '#374151', textTransform: 'capitalize' }}>{sponsor.tier} Tier</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10, padding: '7px 12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#254a84', fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12, color: '#374151' }}>{points} pts reward</span>
                  </div>
                </div>

                {/* Website link */}
                {sponsor.website && (
                  <a
                    href={sponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#f8f9fc', border: '1.5px solid #e2e5ed',
                      borderRadius: 16, padding: '13px 16px', textDecoration: 'none', marginBottom: 20,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#254a84' }}>language</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1d3461' }}>Visit Website</div>
                        <div style={{ fontSize: 11, color: '#74777f' }}>{websiteHost}</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#9aa0aa' }}>open_in_new</span>
                  </a>
                )}

                {/* Stamp CTA */}
                <button
                  onClick={goToQuestion}
                  style={{
                    width: '100%', height: 58,
                    background: tc.heroGrad,
                    color: '#ffffff', border: 'none', borderRadius: 18,
                    fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                    letterSpacing: '-0.2px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.28)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>draw</span>
                  Get Your Passport Stamped
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              PHASE 2 — PASSPORT QUESTION
          ══════════════════════════════════════════ */}
          {phase === 'question' && (
            <>
              {/* Compact top bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '-16px -20px 0',
                padding: '14px 20px',
                borderBottom: '1px solid #e7e8e9',
                background: '#fafbff',
                position: 'sticky', top: 0, zIndex: 10,
              }}>
                <button
                  onClick={backToProfile}
                  aria-label="Back to sponsor profile"
                  style={{ width: 36, height: 36, borderRadius: 12, border: '1.5px solid #e2e5ed', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#43474e', flexShrink: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                </button>
                <SponsorLogo
                  sponsor={sponsor}
                  size={36}
                  radius={10}
                  imgPadding={4}
                  border={`1.5px solid ${tc.accentBorder}`}
                  fallbackBg={tc.avatarBg}
                  fallback={<span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 14, color: '#fff' }}>{initial}</span>}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: '#1d3461', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sponsor.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#74777f' }}>Answer correctly → earn {points} pts</div>
                </div>
                <button
                  onClick={dismiss}
                  aria-label="Close"
                  style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #e7e8e9', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#74777f', flexShrink: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>

              {/* Sponsor context card (collapsible) */}
              {(sponsor.description || sponsor.tagline) && (
                <div style={{ marginTop: 16, marginBottom: 4 }}>
                  <button
                    onClick={() => setContextOpen(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', background: tc.accentLight, border: `1.5px solid ${tc.accentBorder}`,
                      borderRadius: contextOpen ? '14px 14px 0 0' : 14,
                      padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                      transition: 'border-radius 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: tc.accentColor, fontVariationSettings: "'FILL' 1" }}>info</span>
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12, color: tc.accentColor }}>About {sponsor.name}</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: tc.accentColor, transition: 'transform 200ms', transform: contextOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </button>
                  {contextOpen && (
                    <div style={{
                      background: '#fafbff', border: `1.5px solid ${tc.accentBorder}`,
                      borderTop: 'none', borderRadius: '0 0 14px 14px',
                      padding: '12px 14px',
                    }}>
                      {sponsor.tagline && (
                        <p style={{ fontSize: 13, fontStyle: 'italic', color: '#5c5f6e', marginBottom: sponsor.description ? 8 : 0, lineHeight: 1.5 }}>
                          &ldquo;{sponsor.tagline}&rdquo;
                        </p>
                      )}
                      {sponsor.description && (
                        <p style={{ fontSize: 13, color: '#5c5f6e', lineHeight: 1.7, margin: 0 }}>
                          {sponsor.description}
                        </p>
                      )}
                      {sponsor.website && (
                        <a
                          href={sponsor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: '#254a84', fontWeight: 600, textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>language</span>
                          {websiteHost}
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Question card */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f4ff 0%, #eef2ff 100%)',
                border: '1.5px solid #c7d2f0', borderRadius: 20,
                padding: '18px 20px', marginTop: 18, marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#254a84', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#ffffff', fontVariationSettings: "'FILL' 1" }}>quiz</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#254a84', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    Passport Question
                  </div>
                </div>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: '#1d3461', lineHeight: 1.55, margin: 0 }}>
                  {sponsor.question ?? sponsor.promptQuestion}
                </p>
              </div>

              {/* Hint — after server hint or 3 failed attempts */}
              {(serverHint || (attempts >= 3 && sponsor?.hint)) && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #6ea8d8', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ color: '#254a84', fontSize: 20, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1d3461', marginBottom: 2 }}>Hint</div>
                    <div style={{ fontSize: 14, color: '#254a84', lineHeight: 1.5 }}>{serverHint || sponsor?.hint}</div>
                  </div>
                </div>
              )}

              {/* Attempt nudge (1–2 wrong, before hint) */}
              {attempts > 0 && attempts < 3 && !serverHint && (
                <div style={{ fontSize: 13, color: '#74777f', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c3c6cf' }}>chat_bubble</span>
                  {attempts} attempt{attempts > 1 ? 's' : ''} — chat with their rep at the table for a clue!
                </div>
              )}

              {/* Answer form */}
              <form onSubmit={handleSubmit} className={shaking ? 'shake' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  ref={answerRef}
                  className="form-input"
                  type="text"
                  placeholder="Type your answer…"
                  value={answer}
                  onChange={e => { setAnswer(e.target.value); setSubmitError(''); setServerHint(''); }}
                  disabled={submitting}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  style={{ fontSize: 16, borderRadius: 16, height: 52 }}
                />

                {submitError && (
                  <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 17, flexShrink: 0, marginTop: 1 }}>error</span>
                    <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{submitError}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !answer.trim()}
                  style={{
                    width: '100%', height: 54,
                    background: answer.trim() && !submitting
                      ? tc.heroGrad
                      : '#e7e8e9',
                    color: answer.trim() && !submitting ? '#ffffff' : '#9aa0aa',
                    border: 'none', borderRadius: 16,
                    fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16,
                    cursor: submitting || !answer.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 200ms ease',
                    boxShadow: answer.trim() && !submitting ? '0 4px 16px rgba(0,0,0,0.22)' : 'none',
                  }}
                >
                  {submitting
                    ? <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Checking…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>send</span> Submit Answer</>
                  }
                </button>
              </form>

              <button
                type="button"
                onClick={() => setScanning(true)}
                style={{ marginTop: 14, width: '100%', background: 'none', border: '1.5px dashed #c3c6cf', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1d3461', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>qr_code_scanner</span>
                Or scan the QR code at this sponsor&rsquo;s table to unlock instantly
              </button>
            </>
          )}

        </div>
      </div>

      {scanning && (
        <QrScannerSheet
          onClose={() => setScanning(false)}
          onScan={(path) => { setScanning(false); navigate(path); }}
        />
      )}
    </>
  );
}
