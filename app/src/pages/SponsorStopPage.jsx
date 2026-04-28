/**
 * SponsorStopPage.jsx — /sponsor/:id
 * v2: dark bg · shake on wrong · stamp-slam overlay · float-up with real points
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSponsors, submitCheckin } from '../api';

export default function SponsorStopPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sponsor,     setSponsor]     = useState(null);
  const [loadError,   setLoadError]   = useState('');
  const [answer,      setAnswer]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [attempts,    setAttempts]    = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [serverHint,  setServerHint]  = useState(null);
  const [success,     setSuccess]     = useState(null);
  const [shaking,     setShaking]     = useState(false);
  const shakeRef                      = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const data  = await getSponsors();
        const found = (data.sponsors ?? []).find(s => s.id === id);
        if (!found) setLoadError('Sponsor not found.');
        else        setSponsor(found);
      } catch {
        setLoadError('Could not load sponsor info. Try again.');
      }
    }
    load();
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitCheckin(id, answer.trim());
      setSuccess(result);
    } catch (err) {
      if (err?.status === 409) {
        // Already stamped (e.g. prior session) — treat as earned and go home
        navigate('/', { replace: true });
        return;
      }
      setAttempts(a => a + 1);
      if (err?.hint) setServerHint(err.hint);
      if      (err?.status === 422) setSubmitError(err.message || 'Not quite right — give it another try!');
      else if (err?.status === 400) setSubmitError('Invalid submission. Please try again.');
      else                          setSubmitError('Something went wrong. Please try again.');
      // Shake the form on wrong answer
      setShaking(true);
      clearTimeout(shakeRef.current);
      shakeRef.current = setTimeout(() => setShaking(false), 500);
    } finally {
      setSubmitting(false);
    }
  }

  const showHint = serverHint || (attempts >= 3 && sponsor?.hint);
  const hintText  = serverHint || sponsor?.hint;

  /* ── Loading skeleton ── */
  if (!sponsor && !loadError) {
    return (
      <div className="dark-page">
        <div style={{ height: 180, background: 'linear-gradient(135deg,#1d3461,#254a84)', borderRadius: '0 0 2rem 2rem' }} />
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 20, marginBottom: 12 }} />)}
        </div>
      </div>
    );
  }

  /* ── Load error ── */
  if (loadError) {
    return (
      <div className="dark-page" style={{ padding: '24px 16px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: '1.5px solid #c3c6cf', borderRadius: 12, padding: '8px 16px', color: '#43474e', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
          ← Back
        </button>
        <div className="form-error">{loadError}</div>
      </div>
    );
  }

  const initial = (sponsor.name ?? '?')[0].toUpperCase();
  const canSubmit = !submitting && answer.trim().length > 0;

  return (
    <div className="dark-page" style={{ paddingBottom: 40 }}>

      {/* ── Gradient header ── */}
      <header style={{
        background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)',
        paddingTop:   `calc(env(safe-area-inset-top, 16px) + 16px)`,
        paddingBottom: 24,
        paddingLeft:   20,
        paddingRight:  20,
        borderRadius: '0 0 2rem 2rem',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back to Passport
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 }}>
          Sponsor Stop
        </div>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#ffffff', letterSpacing: '-0.4px' }}>
          {sponsor.name}
        </div>
        {sponsor.tier && (
          <span style={{ display: 'inline-block', marginTop: 8, background: 'rgba(173,200,242,0.15)', color: '#adc8f2', border: '1px solid rgba(173,200,242,0.3)', borderRadius: 9999, padding: '3px 12px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {sponsor.tier} · {sponsor.points} pts
          </span>
        )}
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 0' }}>

        {/* ── Sponsor info card ── */}
        <div style={{ background: '#ffffff', borderRadius: 24, border: '1.5px solid #e7e8e9', padding: '20px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,12,30,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: sponsor.description ? 14 : 0 }}>
            <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 16, background: '#f3f4f5', border: '1.5px solid #e7e8e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#43474e' }}>{initial}</span>
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#1d3461', marginBottom: 2 }}>{sponsor.name}</div>
              <div style={{ fontSize: 12, color: '#74777f' }}>
                {sponsor.tier === 'platinum' ? '⭐ Platinum' : '🏅 Gold'} Sponsor · {sponsor.points} points
              </div>
            </div>
          </div>
          {sponsor.description && (
            <p style={{ fontSize: 14, lineHeight: 1.65, color: '#43474e', margin: 0 }}>{sponsor.description}</p>
          )}
        </div>

        {/* ── Question + answer card ── */}
        <div style={{ background: '#ffffff', borderRadius: 24, border: '1.5px solid #e7e8e9', padding: '20px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,12,30,0.06)' }}>

          {sponsor.question && (
            <div style={{ background: '#f3f4f5', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#254a84', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
                Their Question
              </div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: '#1d3461', lineHeight: 1.5, margin: 0 }}>
                {sponsor.question}
              </p>
            </div>
          )}

          {/* Hint box — appears after 3 failed attempts */}
          {showHint && (
            <div style={{ background: '#eff6ff', border: '1.5px solid #6ea8d8', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span className="material-symbols-outlined" style={{ color: '#254a84', fontSize: 20, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1d3461', marginBottom: 2 }}>Hint</div>
                <div style={{ fontSize: 14, color: '#254a84', lineHeight: 1.5 }}>{hintText}</div>
              </div>
            </div>
          )}

          {/* Attempt counter (after 1st wrong, before hint) */}
          {attempts > 0 && attempts < 3 && (
            <div style={{ fontSize: 13, color: '#74777f', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c3c6cf' }}>chat_bubble</span>
              {attempts} attempt{attempts > 1 ? 's' : ''} · Chat with the sponsor for a clue!
            </div>
          )}

          <form onSubmit={handleSubmit} className={shaking ? 'shake' : ''}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#43474e', marginBottom: 8, display: 'block' }}>Your Answer</label>
              <input
                className="form-input"
                type="text"
                placeholder="Type your answer here…"
                value={answer}
                onChange={e => { setAnswer(e.target.value); setSubmitError(''); }}
                disabled={submitting}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ borderRadius: 14 }}
              />
            </div>

            {submitError && (
              <div style={{ background: '#ffdad6', color: '#ba1a1a', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>error</span>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                background: canSubmit ? 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)' : '#e7e8e9',
                color:  canSubmit ? '#ffffff' : '#74777f',
                border: 'none', borderRadius: 16,
                height: 54, fontSize: 16,
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: canSubmit ? '0 4px 16px rgba(0,12,30,0.25)' : 'none',
                transition: 'all 200ms ease',
              }}
            >
              {submitting ? (
                <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }} /> Checking…</>
              ) : (
                <>Submit Answer <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span></>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── Success overlay ── */}
      {success && (
        <>
          {/* Float-up points badge */}
          <div className="points-flash">
            +{success.pointsAwarded ?? success.points} pts
          </div>
          <div className="overlay" onClick={() => navigate('/')}>
            <div className="overlay-card" onClick={e => e.stopPropagation()} style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Stamp seal */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div className="stamp-seal">
                  <span className="material-symbols-outlined" style={{ color: '#1a7f5a', fontSize: 36, fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
              </div>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, color: '#1d3461', marginBottom: 10, letterSpacing: '-0.5px' }}>
                Stamped!
              </h2>
              {(success.pointsAwarded ?? success.points) && (
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 42, color: '#1d3461', letterSpacing: '-1px', marginBottom: 10, lineHeight: 1 }}>
                  +{success.pointsAwarded ?? success.points} pts
                </div>
              )}
              <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                {success.message ?? 'Nice work! Keep visiting sponsor stops to earn more points.'}
              </p>
              <button
                onClick={() => navigate('/')}
                style={{ width: '100%', background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)', color: '#ffffff', border: 'none', borderRadius: 16, height: 54, fontSize: 17, fontFamily: 'Manrope, sans-serif', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 16px rgba(0,12,30,0.25)' }}
              >
                Back to Passport
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

