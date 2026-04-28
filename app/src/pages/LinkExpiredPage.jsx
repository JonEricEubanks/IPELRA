/**
 * LinkExpiredPage.jsx — /link-expired
 * Shown when the magic link token is invalid or expired.
 */

import { useNavigate, Link } from 'react-router-dom';
import { Link2Off } from 'lucide-react';

export default function LinkExpiredPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f5', position: 'relative', overflowX: 'hidden' }}>
      {/* White hero band */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: '#ffffff', borderRadius: '0 0 3rem 3rem', zIndex: 0, boxShadow: '0 4px 24px rgba(29,52,97,0.08)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px 24px 40px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        {/* Logo */}
        <img src="/logo-text.png" alt="IPELRA" style={{ width: '100%', maxWidth: 180, marginBottom: 32, display: 'block', objectFit: 'contain' }} />

        {/* Icon tile */}
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(29,52,97,0.25)' }}>
          <Link2Off size={32} color="#ffffff" />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1d3461', marginBottom: 10, letterSpacing: '-0.5px' }}>
          Link Expired
        </h1>
        <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.6, maxWidth: 300, marginBottom: 32 }}>
          Magic links expire after 15 minutes for security. Request a fresh one and you&rsquo;ll be right back in.
        </p>

        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ maxWidth: 360, marginBottom: 16 }}
          onClick={() => navigate('/login')}
        >
          Get a New Link
        </button>

        <Link to="/help" style={{ color: '#1d3461', fontSize: 14, fontWeight: 500 }}>
          Need help?
        </Link>
      </div>
    </div>
  );
}
