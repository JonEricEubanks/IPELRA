/**
 * AdminVerifyPage.jsx — /admin/verify?token=
 * Handles admin magic link clicks. Exchanges token for session JWT, then redirects.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { adminVerifyToken } from '../api.js';

export default function AdminVerifyPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const [status, setStatus]   = useState('verifying'); // 'verifying' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setErrorMsg('No token found in this link. Please request a new login link.');
      setStatus('error');
      return;
    }

    adminVerifyToken(token)
      .then(data => {
        try {
          localStorage.setItem('admin_token', data.token);
        } catch {
          sessionStorage.setItem('admin_token', data.token);
        }
        navigate('/admin', { replace: true });
      })
      .catch(err => {
        setErrorMsg(err.message || 'Link expired or invalid. Please request a new one.');
        setStatus('error');
      });
  }, []);

  if (status === 'verifying') {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <div className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
            <Settings size={48} color="var(--color-primary)" />
          </div>
          <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>Signing you in…</h2>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)', background: 'var(--color-bg)',
    }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
          <AlertCircle size={48} color="var(--color-error)" />
        </div>
        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>Link Invalid</h2>
        <p style={{ color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
          {errorMsg}
        </p>
        <a href="/admin/login" className="btn btn-primary btn-full" style={{ textDecoration: 'none' }}>
          Back to Admin Login
        </a>
      </div>
    </div>
  );
}
