/**
 * CompletedPage.jsx — /completed
 * Shown when attendee has hit the points threshold. Confetti celebration.
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
        if (!p.completed) navigate('/', { replace: true });
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
    <div className="page" style={{ overflow: 'hidden' }}>
      {/* Confetti pieces */}
      <div aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="confetti-piece" style={{
            left: `${5 + (i * 4.5) % 90}%`,
            animationDelay: `${(i * 0.17) % 2}s`,
            background: [
              'var(--color-primary)',
              'var(--color-gold)',
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
          <Trophy size={80} color="var(--color-gold)" />
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 'var(--space-2)', lineHeight: 1.2 }}>
          Passport Complete!
        </h1>

        <p style={{ fontSize: 18, color: 'var(--color-text-2)', marginBottom: 'var(--space-5)', maxWidth: 320 }}>
          {attendee?.firstName ? `Congrats, ${attendee.firstName}!` : 'Congratulations!'} You&rsquo;ve been entered into the prize drawing.
        </p>

        {formatted && (
          <div style={{
            background: 'var(--color-success-bg)',
            color: 'var(--color-success-dark)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 'var(--space-5)',
          }}>
            <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Completed {formatted}
          </div>
        )}

        <div className="card" style={{ width: '100%', maxWidth: 360, marginBottom: 'var(--space-5)' }}>
          <p style={{ fontSize: 15, color: 'var(--color-text-2)', margin: 0, lineHeight: 1.6 }}>
            Look for the <strong>Prize Station</strong> near the conference registration desk to claim your entry ticket. A confirmation email is on its way to you!
          </p>
        </div>

        <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: 360 }} onClick={() => navigate('/')}>
          View My Passport
        </button>
      </div>
    </div>
  );
}
