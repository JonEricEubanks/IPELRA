/**
 * OfflinePage.jsx — /offline
 * Shows when navigator.onLine is false or a network request fails hard.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflinePage() {
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      navigate('/', { replace: true });
    }
    function handleOffline() { setOnline(false); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [navigate]);

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f5', position: 'relative', overflowX: 'hidden' }}>
      {/* White hero band */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: '#ffffff', borderRadius: '0 0 3rem 3rem', zIndex: 0, boxShadow: '0 4px 24px rgba(29,52,97,0.08)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px 24px 40px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        {/* Logo */}
        <img src="/logo-text.png" alt="IPELRA" style={{ width: '100%', maxWidth: 180, marginBottom: 32, display: 'block', objectFit: 'contain' }} />

        {/* Icon tile */}
        <div style={{ width: 72, height: 72, borderRadius: 20, background: online ? 'linear-gradient(135deg, #1a7f5a 0%, #059669 100%)' : 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(29,52,97,0.25)', transition: 'background 0.4s ease' }}>
          {online ? <Wifi size={32} color="#ffffff" /> : <WifiOff size={32} color="#ffffff" />}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1d3461', marginBottom: 10, letterSpacing: '-0.5px' }}>
          {online ? 'Back Online!' : 'No Connection'}
        </h1>
        <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.6, maxWidth: 300, marginBottom: 32 }}>
          {online
            ? 'Redirecting you back to the passport…'
            : 'Check the conference Wi-Fi. The network name is "IPELRA2026".'}
        </p>

        {!online && (
          <button
            className="btn btn-primary btn-full btn-lg"
            style={{ maxWidth: 360 }}
            onClick={() => { if (navigator.onLine) navigate('/', { replace: true }); }}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
