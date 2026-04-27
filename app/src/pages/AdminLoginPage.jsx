/**
 * AdminLoginPage.jsx — /admin/login
 * Admin enters their email, receives a magic link, clicks it to sign in.
 */

import { useState } from 'react';
import { Settings, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { adminSendMagicLink } from '../api.js';

export default function AdminLoginPage() {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await adminSendMagicLink(trimmed);
      setStatus('sent');
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-6)', textAlign: 'center',
        background: 'var(--color-bg)',
      }}>
        <div className="card" style={{ maxWidth: 380, width: '100%' }}>
          <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
            <CheckCircle2 size={48} color="var(--color-success-dark)" />
          </div>
          <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>Check Your Email</h2>
          <p style={{ color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
            If <strong>{email}</strong> is an authorized admin address, a login link has been sent.
            The link expires in 15 minutes.
          </p>
          <button
            className="btn btn-secondary btn-full"
            onClick={() => { setStatus('idle'); setEmail(''); }}
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)', textAlign: 'center',
      background: 'var(--color-bg)',
    }}>
      <div className="card" style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
          <Settings size={48} color="var(--color-primary)" />
        </div>
        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>Admin Access</h2>
        <p style={{ color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
          Enter your authorized email to receive a login link.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-3)', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)', fontSize: 14 }}>
              Email
            </label>
            <input
              type="email"
              className="input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          {status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-error)', marginBottom: 'var(--space-3)', fontSize: 14 }}>
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={status === 'loading'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Mail size={18} />
            {status === 'loading' ? 'Sending…' : 'Send Login Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
