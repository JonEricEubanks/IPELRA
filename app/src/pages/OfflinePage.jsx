/**
 * OfflinePage.jsx — /offline
 * Shows when navigator.onLine is false or a network request fails hard.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

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
    <div className="page">
      <div className="page-content" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100dvh',
        padding: 'var(--space-6)', textAlign: 'center',
      }}>
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
          <WifiOff size={64} color="var(--color-text-2)" />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          No Connection
        </h1>

        <p style={{ color: 'var(--color-text-2)', fontSize: 16, marginBottom: 'var(--space-6)', maxWidth: 320, lineHeight: 1.6 }}>
          {online
            ? 'You\'re back online! Redirecting…'
            : 'Check the conference Wi-Fi. Eagle Ridge Resort network is "IPELRA2026".'}
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
