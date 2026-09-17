/**
 * CompletedPage.jsx — /completed
 * v2: dark bg · confetti celebration · email confirmation · passport seal
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { getProgress } from '../api';
import { Trophy, CheckCircle2 } from 'lucide-react';

export default function CompletedPage() {
  const { attendee } = useAuth();
  const navigate = useNavigate();
  const [completedAt, setCompletedAt] = useState(null);

  useEffect(() => {
    getProgress()
      .then(p => {
        if (!p.completed) { navigate('/', { replace: true }); return; }
        // Mark the celebration as seen so "View My Passport" below shows the
        // real dashboard instead of bouncing back to this screen.
        try { localStorage.setItem('ipelra_completion_seen', 'true'); } catch { /* ignore */ }
        setCompletedAt(p.completedAt);
      })
      .catch(() => {});
  }, [navigate]);

  const formatted = completedAt
    ? new Date(completedAt).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <div className="dark-page" style={{ overflow: 'hidden' }}>
      {/* Confetti pieces */}
      <div aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="confetti-piece" style={{
            left: `${5 + (i * 4.5) % 90}%`,
            animationDelay: `${(i * 0.17) % 2}s`,
            background: [
              'var(--color-primary)',
              '#6ea8d8',
              'var(--color-success)',
              '#f43f5e',
              '#8b5cf6',
            ][i % 5],
          }} />
        ))}
      </div>

      <div className="page-content" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100dvh',
        padding: 'var(--space-6)', textAlign: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
          <Trophy size={80} color="#6ea8d8" />
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 'var(--space-2)', lineHeight: 1.2, color: '#ffffff' }}>
          Passport Complete!
        </h1>

        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', marginBottom: 'var(--space-3)', maxWidth: 320 }}>
          {attendee?.firstName ? `Congrats, ${attendee.firstName}!` : 'Congratulations!'} You&rsquo;ve been entered into the prize drawing.
        </p>

        {/* Email confirmation — makes raffle entry feel real */}
        {attendee?.email && (
          <div style={{
            background: 'rgba(29,52,97,0.18)',
            border: '1.5px solid rgba(110,168,216,0.4)',
            borderRadius: 16,
            padding: '12px 20px',
            marginBottom: 'var(--space-3)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="material-symbols-outlined" style={{ color: '#adc8f2', fontSize: 20, fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>confirmation_number</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(173,200,242,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>YOU'RE IN THE DRAWING</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#adc8f2' }}>{attendee.email}</div>
            </div>
          </div>
        )}

        {formatted && (
          <div style={{
            background: 'rgba(26,127,90,0.2)',
            color: '#6ee7b7',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 'var(--space-5)',
          }}>
            <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Completed {formatted}
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: '100%', maxWidth: 360, marginBottom: 'var(--space-5)' }}>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>
            Look for the <strong style={{ color: '#adc8f2' }}>Prize Station</strong> near the conference registration desk to claim your entry ticket. A confirmation email is on its way to you!
          </p>
        </div>

        <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: 360, background: 'linear-gradient(135deg, #1d3461, #254a84)', color: '#ffffff' }} onClick={() => navigate('/')}>
          View My Passport
        </button>
      </div>
    </div>
  );
}
