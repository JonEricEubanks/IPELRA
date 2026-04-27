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
      <div className="loading-screen" style={{ flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--color-text-2)', fontSize: 15 }}>Opening your passport…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', textAlign: 'center', gap: 'var(--space-4)' }}>
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
          <AlertTriangle size={56} color="var(--color-warning, #f59e0b)" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Verification failed</h2>
        <p style={{ color: 'var(--color-text-2)', fontSize: 15 }}>{errorMsg}</p>
        <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>
          Request a new link
        </button>
      </div>
    </div>
  );
}
