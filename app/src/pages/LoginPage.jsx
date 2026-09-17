/**
 * LoginPage.jsx — /login
 * Attendee enters email + optional name to receive a magic link.
 * M3 design: tonal layered background · Manrope headline · signature gradient CTA
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendMagicLink } from '../api.js';
import { readPendingScan, pendingScanPath } from '../lib/pendingScan.js';

const S = {
  page:    { minHeight: '100dvh', background: '#f3f4f5', position: 'relative', overflowX: 'hidden' },
  content: { position: 'relative', zIndex: 1, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top,24px) + 36px) 24px 40px', maxWidth: 440, margin: '0 auto' },

  logoWrap: { width: '100%', maxWidth: 200, marginBottom: 16, display: 'block', objectFit: 'contain' },
  h1:       { fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 32, color: '#1d3461', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 12, textAlign: 'center' },
  divider:  { width: 48, height: 4, background: '#1d3461', borderRadius: 9999, margin: '0 auto 14px' },
  desc:     { color: '#43474e', fontSize: 15, lineHeight: 1.65, maxWidth: 310, margin: '0 auto 32px', textAlign: 'center' },

  card: { width: '100%', background: '#ffffff', borderRadius: 24, padding: '28px 24px 24px', boxShadow: '0 4px 24px rgba(0,12,30,0.08)', border: '1px solid #e7e8e9', marginBottom: 20 },

  submitBtn: (loading) => ({
    width: '100%',
    background: loading ? '#c3c6cf' : 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 16,
    height: 56,
    fontSize: 17,
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 800,
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: loading ? 'none' : '0 4px 16px rgba(0,12,30,0.28)',
    transition: 'opacity 180ms, box-shadow 180ms',
    letterSpacing: '-0.2px',
    marginTop: 4,
  }),
};

export default function LoginPage() {
  const [email, setEmail]         = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState('');
  // Set when the attendee arrived here by scanning a sponsor QR while logged out
  const [pendingScan] = useState(() => readPendingScan());

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!firstName.trim()) { setError('Please enter your first name.'); return; }
    if (!lastName.trim()) { setError('Please enter your last name.'); return; }
    setLoading(true);
    try {
      const next = pendingScan ? pendingScanPath(pendingScan) : null;
      const res = await sendMagicLink(email.trim(), firstName.trim() || undefined, lastName.trim() || undefined, next);
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (res.status === 429
          ? 'The passport is not open yet. Check back at the conference!'
          : 'We couldn\u2019t send your login email just now. Please try again in a moment.'));
      }
    } catch {
      setError('Something went wrong. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Sent state ── */
  if (sent) {
    return (
      <div style={S.page}>
        <div style={{ ...S.content, justifyContent: 'center', gap: 0 }}>
          <img src="/logo.png" alt="IPELRA" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 20 }} />
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, color: '#1d3461', letterSpacing: '-0.5px', textAlign: 'center', marginBottom: 12 }}>
            Check your inbox!
          </h1>
          <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.65, maxWidth: 300, textAlign: 'center', marginBottom: 8 }}>
            We sent a magic link to <strong style={{ color: '#1d3461' }}>{email}</strong>. Tap it on this device to open your passport.
          </p>
          {pendingScan && (
            <p style={{ color: '#1a7f5a', fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
              Your scanned stop will unlock automatically once you tap the link.
            </p>
          )}
          <p style={{ color: '#74777f', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
            Link expires in 15 minutes · Check spam if it doesn't arrive
          </p>
          <button
            onClick={() => setSent(false)}
            style={{ background: 'none', border: '1.5px solid #c3c6cf', borderRadius: 12, padding: '10px 20px', color: '#43474e', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            ← Different email
          </button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div style={S.page}>
      {/* Tonal layer — white so the white-bg logo blends naturally */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320, background: '#ffffff', borderRadius: '0 0 3rem 3rem', zIndex: 0, boxShadow: '0 4px 24px rgba(29,52,97,0.08)' }} />

      <main style={S.content}>
        {/* Logo block */}
        <div style={{ textAlign: 'center', width: '100%', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src="/logo-text.png"
              alt="IPELRA logo"
              style={S.logoWrap}
            />
          </div>
          <h1 style={S.h1}>IPELRA Conference<br />Passport</h1>
          <div style={S.divider} />
          <p style={S.desc}>
            Complete sponsor stops to earn points and win prizes at the 2026 Annual Conference.
          </p>
        </div>

        {pendingScan && (
          <div role="status" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#f0faf5', border: '1.5px solid #b2dfcf', borderRadius: 18, padding: '12px 16px', marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ color: '#1a7f5a', fontSize: 24, fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>qr_code_scanner</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: '#1a7f5a' }}>Sponsor stop scanned!</div>
              <div style={{ fontSize: 13, color: '#2d8c6a', lineHeight: 1.4 }}>Log in once below and it will unlock automatically. Every stop after this is a single scan.</div>
            </div>
          </div>
        )}

        {/* Form card */}
        <div style={S.card}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="label" htmlFor="lp-email">Email address</label>
              <input
                id="lp-email"
                className={`input${error ? ' input-error' : ''}`}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoFocus
              />
              {error && <span className="error-msg">{error}</span>}
            </div>

            {/* Name fields — required */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                <div className="field">
                  <label className="label" htmlFor="lp-firstName">First name</label>
                  <input id="lp-firstName" className="input" type="text" autoComplete="given-name" placeholder="Jane" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="lp-lastName">Last name</label>
                  <input id="lp-lastName" className="input" type="text" autoComplete="family-name" placeholder="Smith" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
              <p className="hint-msg" style={{ marginTop: 0 }}>Your name appears on the leaderboard and prize drawing list.</p>
            </div>

            <button type="submit" disabled={loading} style={S.submitBtn(loading)}>
              {loading ? (
                <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }} /> Sending…</>
              ) : (
                <>Start Your Passport <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'wght' 600" }}>arrow_forward</span></>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 11, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', letterSpacing: '0.18em', textAlign: 'center', marginBottom: 8 }}>
          IL Public Employee Labor Relations Association
        </p>
        <p style={{ fontSize: 13, color: '#74777f', textAlign: 'center' }}>
          Need help?{' '}<Link to="/help" style={{ color: '#1d3461', fontWeight: 600 }}>View FAQ</Link>
        </p>
      </main>

      {/* Decorative watermark */}
      <div style={{ position: 'fixed', bottom: 32, right: -16, opacity: 0.05, pointerEvents: 'none', transform: 'rotate(15deg)', zIndex: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 140, color: '#1d3461', fontVariationSettings: "'wght' 100" }}>verified_user</span>
      </div>
    </div>
  );
}
