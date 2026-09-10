/**
 * QrScannerSheet.jsx — in-app QR scanner.
 *
 * Opens the rear camera and decodes continuously with jsQR. The instant it sees
 * one of OUR /scan/... codes it calls onScan(path). Anything else is ignored
 * with a gentle hint. If the camera is unavailable or denied, falls back to a
 * "take a photo" picker (native OS camera UI, no permission prompt) and decodes
 * the still image.
 *
 * Scanning in-app guarantees the current session is used — important for
 * home-screen installs, where a native camera scan would open Safari logged out.
 */

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { parseScanUrl } from '../lib/scanUrl';

const SCAN_INTERVAL_MS = 120;

export default function QrScannerSheet({ onScan, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const streamRef = useRef(null);
  const timerRef  = useRef(null);
  const doneRef   = useRef(false);

  const [mode, setMode]   = useState('starting'); // starting | live | fallback
  const [hint, setHint]   = useState('');
  const [busy, setBusy]   = useState(false);

  // ── Start / stop camera ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setMode('fallback'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setMode('live');
        timerRef.current = setInterval(tick, SCAN_INTERVAL_MS);
      } catch {
        // Denied / no camera / insecure context — offer the photo fallback
        if (!cancelled) setMode('fallback');
      }
    }

    start();
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDecoded(text) {
    if (doneRef.current) return;
    const target = parseScanUrl(text);
    if (!target) {
      setHint('That\u2019s not a passport code \u2014 look for the IPELRA QR at the sponsor table.');
      return;
    }
    doneRef.current = true;
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onScan(target.path);
  }

  // ── Live frame decode ──────────────────────────────────────────────────────
  function tick() {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (code?.data) handleDecoded(code.data);
  }

  // ── Photo fallback decode ──────────────────────────────────────────────────
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setHint('');
    try {
      // 'from-image' applies the photo's EXIF rotation so it isn't decoded sideways
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const canvas = canvasRef.current;
      // Downscale very large photos so decoding stays fast
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // 'attemptBoth' tries inverted colors too — real photos vary more than live camera frames
      const code = jsQR(img.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) handleDecoded(code.data);
      else setHint('Couldn\u2019t read a code in that photo. Make sure the whole QR is in frame, well-lit, and not blurry, then try again.');
    } catch {
      setHint('Couldn\u2019t read that photo. Please try again.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan a sponsor QR code" style={S.overlay}>
      {/* Camera / fallback area */}
      <div style={S.stage}>
        <video ref={videoRef} playsInline muted style={{ ...S.video, display: mode === 'live' ? 'block' : 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {mode === 'live' && (
          <>
            <div style={S.dim} />
            <div style={S.frame} aria-hidden="true">
              <span style={{ ...S.corner, top: -2, left: -2, borderRight: 'none', borderBottom: 'none' }} />
              <span style={{ ...S.corner, top: -2, right: -2, borderLeft: 'none', borderBottom: 'none' }} />
              <span style={{ ...S.corner, bottom: -2, left: -2, borderRight: 'none', borderTop: 'none' }} />
              <span style={{ ...S.corner, bottom: -2, right: -2, borderLeft: 'none', borderTop: 'none' }} />
            </div>
          </>
        )}

        {mode === 'starting' && (
          <div style={S.center}>
            <div className="spinner" style={{ borderTopColor: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }} />
            <p style={S.msg}>Starting camera\u2026</p>
          </div>
        )}

        {mode === 'fallback' && (
          <div style={S.center}>
            <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'rgba(255,255,255,0.85)' }}>photo_camera</span>
            <p style={{ ...S.msg, maxWidth: 280 }}>
              Camera access isn&rsquo;t available here. Take a photo of the QR code instead.
            </p>
            <button className="btn btn-primary btn-lg" style={{ minWidth: 220 }} onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Reading\u2026' : 'Take a Photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} data-testid="qr-file-input" />
          </div>
        )}
      </div>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Scan sponsor QR</div>
          <div style={S.sub}>Point at the code on the table</div>
        </div>
        <button onClick={onClose} aria-label="Close scanner" style={S.close}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
        </button>
      </div>

      {/* Footer hint */}
      <div style={S.footer}>
        {hint
          ? <div role="status" style={S.hint}>{hint}</div>
          : mode === 'live' && (
            <button className="btn btn-ghost" style={{ color: 'rgba(255,255,255,0.75)' }} onClick={() => { clearInterval(timerRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); setMode('fallback'); }}>
              Camera not working? Take a photo instead
            </button>
          )}
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column', color: '#fff' },
  stage:   { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  video:   { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  dim:     { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' },
  frame:   { position: 'relative', width: 'min(72vw, 320px)', aspectRatio: '1 / 1', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', borderRadius: 24 },
  corner:  { position: 'absolute', width: 34, height: 34, border: '4px solid #ffffff', borderRadius: 8 },
  center:  { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', padding: 24 },
  msg:     { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.5, margin: 0 },
  header:  { position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px', background: 'linear-gradient(180deg, rgba(0,0,0,0.65), transparent)' },
  title:   { fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18 },
  sub:     { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  close:   { width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  footer:  { position: 'relative', zIndex: 2, marginTop: 'auto', padding: '16px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)', display: 'flex', justifyContent: 'center', textAlign: 'center', background: 'linear-gradient(0deg, rgba(0,0,0,0.65), transparent)' },
  hint:    { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '10px 14px', fontSize: 14, color: '#fff', maxWidth: 360 },
};
