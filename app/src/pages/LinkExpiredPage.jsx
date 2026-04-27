/**
 * LinkExpiredPage.jsx — /link-expired
 * Shown when the magic link token is invalid or expired.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Link2Off } from 'lucide-react';

export default function LinkExpiredPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-content" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100dvh',
        padding: 'var(--space-6)', textAlign: 'center',
      }}>
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
          <Link2Off size={64} color="var(--color-text-2)" />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          Link Expired
        </h1>

        <p style={{ color: 'var(--color-text-2)', fontSize: 16, marginBottom: 'var(--space-6)', maxWidth: 320, lineHeight: 1.6 }}>
          Magic links expire after 15 minutes for security. Request a fresh one and you&rsquo;ll be right back in.
        </p>

        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ maxWidth: 360, marginBottom: 'var(--space-3)' }}
          onClick={() => navigate('/login')}
        >
          Get a New Link
        </button>

        <Link to="/help" style={{ color: 'var(--color-text-2)', fontSize: 14 }}>
          Need help?
        </Link>
      </div>
    </div>
  );
}
