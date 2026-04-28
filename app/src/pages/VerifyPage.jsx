/**
 * VerifyPage.jsx — /verify?token=<rawToken>
 * Called when attendee clicks magic link. Exchanges token for JWT.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyToken } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AlertTriangle } from 'lucide-react';

export default function VerifyPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/link-expired', { replace: true });
      return;
    }

    async function verify() {
      try {
        const res = await verifyToken(token);
        if (!res) return; // api.js handles 401 redirect
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            navigate('/link-expired', { replace: true });
          } else {
            setErrorMsg(data.error ?? 'Verification failed.');
            setStatus('error');
          }
          return;
        }

        // Store session
        login(data.token, data.attendee);

        // First-time users → onboarding; returning users → home
        const hasOnboarded = localStorage.getItem('passport_onboarded');
        if (!hasOnboarded) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        setErrorMsg('Something went wrong. Please try again or request a new login link.');
        setStatus('error');
      }
    }

    verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'verifying') {
    return (
      <div style={{ minHeight: '100dvh', background: '#0d1e3c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: 24 }}>
        <img src="/logo-text.png" alt="IPELRA" style={{ width: 160, objectFit: 'contain', marginBottom: 8 }} />
        <div className="spinner" style={{ borderTopColor: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }} />
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>Opening your passport…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f5', position: 'relative', overflowX: 'hidden' }}>
      {/* White hero band */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: '#ffffff', borderRadius: '0 0 3rem 3rem', zIndex: 0, boxShadow: '0 4px 24px rgba(29,52,97,0.08)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px 24px 40px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <img src="/logo-text.png" alt="IPELRA" style={{ width: '100%', maxWidth: 180, marginBottom: 32, display: 'block', objectFit: 'contain' }} />

        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(185,28,28,0.3)' }}>
          <AlertTriangle size={32} color="#fff" />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1d3461', marginBottom: 10, letterSpacing: '-0.5px' }}>
          Verification Failed
        </h1>
        <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.6, maxWidth: 300, marginBottom: 32 }}>
          {errorMsg}
        </p>

        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ maxWidth: 360 }}
          onClick={() => navigate('/login', { replace: true })}
        >
          Request a New Link
        </button>
      </div>
    </div>
  );
}
