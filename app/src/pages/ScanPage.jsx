/**
 * ScanPage.jsx — /scan/:sponsorId?c=<qrCode>
 *
 * Landing page for the printed sponsor QR codes. Attendees scan with their
 * phone's native camera (or the in-app scanner); this route identifies the
 * sponsor and opens their prompt question — exactly like tapping the
 * sponsor's card in-app. Scanning never awards points by itself; the
 * attendee still has to answer the question correctly to earn the stamp.
 *
 * - Not logged in → remember the scan (localStorage, 30 min), go to /login.
 *   LoginPage shows what was scanned and threads it through the magic link;
 *   VerifyPage brings the attendee back here after login.
 * - Logged in    → identify the sponsor from the scanned link, then render
 *   its prompt question via SponsorSheet (answering it calls POST /api/checkin).
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSponsors, getProgress } from '../api';
import { savePendingScan, clearPendingScan } from '../lib/pendingScan';
import SponsorSheet from '../components/SponsorSheet';
import SponsorLogo from '../components/SponsorLogo';

const STATUS = {
  WORKING:  'working',
  QUESTION: 'question',
  SUCCESS:  'success',
  ALREADY:  'already',
  INVALID:  'invalid',
  CLOSED:   'closed',
  ERROR:    'error',
};

// Long enough to read the result and show a sponsor rep the screen
const AUTO_RETURN_MS = 6000;

export default function ScanPage() {
  const { sponsorId } = useParams();
  const [params] = useSearchParams();
  const code = params.get('c') ?? '';
  const navigate = useNavigate();
  const { attendee, loading } = useAuth();

  const [status, setStatus]   = useState(STATUS.WORKING);
  const [result, setResult]   = useState(null);
  const [sponsor, setSponsor] = useState(null);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading) return;

    if (!sponsorId || !code) {
      setStatus(STATUS.INVALID);
      setMessage('This QR code is missing some information. Try answering the question at the table instead.');
      return;
    }

    if (!attendee) {
      savePendingScan({ sponsorId, c: code });
      navigate('/login', { replace: true });
      return;
    }

    clearPendingScan();

    let cancelled = false;
    (async () => {
      try {
        const [sponsorsData, progress] = await Promise.all([
          getSponsors(),
          getProgress().catch(() => null),
        ]);
        if (cancelled) return;

        if (sponsorsData.passportLive === false) {
          setStatus(STATUS.CLOSED);
          return;
        }

        const found = (sponsorsData.sponsors ?? []).find(s => s.id === sponsorId);
        if (!found) {
          setStatus(STATUS.INVALID);
          setMessage('This QR code isn\u2019t valid. Try answering the question at the table instead.');
          return;
        }
        setSponsor(found);

        if (progress?.checkedInSponsorIds?.includes(sponsorId)) {
          setStatus(STATUS.ALREADY);
          return;
        }

        setStatus(STATUS.QUESTION);
      } catch (err) {
        if (cancelled) return;
        // 401/403 already triggers a redirect to /login inside api.js
        if (err?.status === 401 || err?.status === 403) return;
        setStatus(STATUS.ERROR);
        setMessage(err?.message || 'Something went wrong. Please try again.');
      }
    })();

    return () => { cancelled = true; };
  }, [loading, attendee, sponsorId, code, navigate, attempt]);

  useEffect(() => {
    if (status !== STATUS.SUCCESS) return;
    const t = setTimeout(() => navigate('/', { replace: true }), AUTO_RETURN_MS);
    return () => clearTimeout(t);
  }, [status, navigate]);

  if (status === STATUS.WORKING) {
    return (
      <Shell dark>
        <img src="/logo-text.png" alt="IPELRA" style={{ width: 160, objectFit: 'contain', marginBottom: 8 }} />
        <div className="spinner" style={{ borderTopColor: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }} />
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>Finding your stop\u2026</p>
      </Shell>
    );
  }

  if (status === STATUS.QUESTION && sponsor) {
    return (
      <>
        {/* Branded backdrop so the sheet doesn't float over an empty grey page */}
        <Shell dark>
          <img src="/logo-text.png" alt="IPELRA" style={{ width: 160, objectFit: 'contain', marginBottom: 8, opacity: 0.9 }} />
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>Answer the question to collect this stop</p>
        </Shell>
        <SponsorSheet
          sponsor={sponsor}
          initialPhase="question"
          onClose={() => navigate('/', { replace: true })}
          onSuccess={(data) => { setResult(data); setStatus(STATUS.SUCCESS); }}
        />
      </>
    );
  }

  if (status === STATUS.SUCCESS) {
    return (
      <Shell>
        <Tile gradient="linear-gradient(135deg, #1a7f5a 0%, #2d8c6a 100%)" icon="check_circle" />
        <h1 style={h1}>Stop Unlocked!</h1>
        <SponsorChip sponsor={sponsor} />
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 44, color: '#1a7f5a', letterSpacing: '-1px', lineHeight: 1, margin: '6px 0' }}>
          +{result?.pointsAwarded ?? 0} pts
        </div>
        <p style={{ ...p, marginBottom: 8 }}>
          You now have <strong>{result?.totalPoints ?? 0} points</strong>.
          {result?.isComplete && ' Your passport is complete \u2014 head to the Prize Station!'}
        </p>
        <p style={{ fontSize: 13, color: '#74777f', marginBottom: 28 }}>Returning to your passport shortly\u2026</p>
        <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: 360 }} onClick={() => navigate('/', { replace: true })}>
          Back to Passport
        </button>
      </Shell>
    );
  }

  if (status === STATUS.ALREADY) {
    return (
      <Shell>
        <Tile gradient="linear-gradient(135deg, #1d3461 0%, #254a84 100%)" icon="verified" />
        <h1 style={h1}>Already Collected</h1>
        <SponsorChip sponsor={sponsor} />
        <p style={p}>You&rsquo;ve already unlocked this sponsor stop. Nice work &mdash; on to the next one!</p>
        <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: 360 }} onClick={() => navigate('/', { replace: true })}>
          Back to Passport
        </button>
      </Shell>
    );
  }

  if (status === STATUS.CLOSED) {
    return (
      <Shell>
        <Tile gradient="linear-gradient(135deg, #92400e 0%, #b45309 100%)" icon="schedule" />
        <h1 style={h1}>Passport Not Open</h1>
        <p style={p}>The conference passport is not yet open. Please check back soon.</p>
        <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: 360 }} onClick={() => navigate('/', { replace: true })}>
          Back to Passport
        </button>
      </Shell>
    );
  }

  // INVALID or ERROR
  return (
    <Shell>
      <Tile gradient="linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)" icon="qr_code_scanner" />
      <h1 style={h1}>{status === STATUS.INVALID ? 'Code Not Recognized' : 'Something Went Wrong'}</h1>
      <p style={p}>{message}</p>
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: 360, marginBottom: 12 }} onClick={() => navigate('/', { replace: true })}>
        Open My Passport
      </button>
      {status === STATUS.ERROR && (
        <button className="btn btn-ghost" onClick={() => { setStatus(STATUS.WORKING); setAttempt(a => a + 1); }}>
          Try Again
        </button>
      )}
    </Shell>
  );
}

// ── Layout helpers (match VerifyPage / LinkExpiredPage styling) ──────────────

const h1 = { fontSize: 26, fontWeight: 800, color: '#1d3461', marginBottom: 10, letterSpacing: '-0.5px' };
const p  = { color: '#43474e', fontSize: 15, lineHeight: 1.6, maxWidth: 300, marginBottom: 32 };

function SponsorChip({ sponsor }) {
  if (!sponsor) return null;
  const initial = (sponsor.name ?? '?')[0].toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ffffff', border: '1.5px solid #e7e8e9', borderRadius: 18, padding: '10px 16px 10px 10px', marginBottom: 14, maxWidth: 340 }}>
      <SponsorLogo
        sponsor={sponsor}
        size={44}
        radius={13}
        imgPadding={5}
        border="1.5px solid rgba(29,52,97,0.2)"
        fallbackBg="rgba(29,52,97,0.08)"
        fallback={<span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18, color: '#1d3461' }}>{initial}</span>}
      />
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: '#1d3461', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.name}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {sponsor.tier === 'leadership' ? '\u25c6 ' : ''}{sponsor.tier} sponsor
        </div>
      </div>
    </div>
  );
}

function Shell({ children, dark = false }) {
  if (dark) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0d1e3c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: 24 }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f5', position: 'relative', overflowX: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: '#ffffff', borderRadius: '0 0 3rem 3rem', zIndex: 0, boxShadow: '0 4px 24px rgba(29,52,97,0.08)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px 24px 40px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <img src="/logo-text.png" alt="IPELRA" style={{ width: '100%', maxWidth: 180, marginBottom: 32, display: 'block', objectFit: 'contain' }} />
        {children}
      </div>
    </div>
  );
}

function Tile({ gradient, icon }) {
  return (
    <div style={{ width: 72, height: 72, borderRadius: 20, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(29,52,97,0.25)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#ffffff', fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
  );
}
