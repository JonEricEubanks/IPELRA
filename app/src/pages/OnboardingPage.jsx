/**
 * OnboardingPage.jsx — /onboarding
 * 3-card swipe shown only on first login. Explains the passport experience.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, MessageCircle, Trophy } from 'lucide-react';

const CARDS = [
  {
    Icon: Map,
    title: 'Welcome to the Passport',
    body: 'Visit each sponsor table, answer their question, and collect stamps. Complete all stops to enter the prize drawing!',
    cta: 'Next',
  },
  {
    Icon: MessageCircle,
    title: 'Talk to Sponsors',
    body: 'Each sponsor has a unique prompt question. Chat with them to learn the answer — you can\'t just guess your way through!',
    cta: 'Next',
  },
  {
    Icon: Trophy,
    title: 'Win a Prize',
    body: 'Earn enough points to complete your passport, then you\'re entered to win. Look for the prize station at the conference.',
    cta: 'Start My Passport!',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  function advance() {
    if (step < CARDS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('passport_onboarded', '1');
      navigate('/', { replace: true });
    }
  }

  function skip() {
    localStorage.setItem('passport_onboarded', '1');
    navigate('/', { replace: true });
  }

  const card = CARDS[step];

  return (
    <div className="page" style={{ background: 'var(--color-primary)' }}>
      <div className="page-content" style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', minHeight: '100dvh', gap: 'var(--space-6)',
      }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', width: '100%' }}>
          <div style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'center' }}>
            <card.Icon size={80} color="var(--color-primary)" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 'var(--space-3)' }}>{card.title}</h2>
          <p style={{ color: 'var(--color-text-2)', fontSize: 16, lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
            {card.body}
          </p>

          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 'var(--space-6)' }}>
            {CARDS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 9999,
                background: i === step ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'width 0.3s ease',
              }} />
            ))}
          </div>

          <button className="btn btn-primary btn-full btn-lg" onClick={advance}>
            {card.cta}
          </button>
        </div>

        {step < CARDS.length - 1 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={skip}
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
