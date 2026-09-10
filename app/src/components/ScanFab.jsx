/**
 * ScanFab.jsx — floating "Scan" button that opens the in-app QR scanner.
 *
 * On a successful scan it routes to /scan/<id>?c=<code> in-app, so the
 * existing ScanPage does the unlock using the current session.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScannerSheet from './QrScannerSheet';

export default function ScanFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Scan a sponsor QR code"
        style={{
          position: 'fixed',
          right: 18,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
          zIndex: 150,
          height: 56, padding: '0 20px 0 16px',
          borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)',
          color: '#ffffff',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '-0.2px',
          boxShadow: '0 8px 24px rgba(13,30,60,0.35), 0 0 0 3px rgba(255,255,255,0.9)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>qr_code_scanner</span>
        Scan
      </button>

      {open && (
        <QrScannerSheet
          onClose={() => setOpen(false)}
          onScan={(path) => { setOpen(false); navigate(path); }}
        />
      )}
    </>
  );
}
