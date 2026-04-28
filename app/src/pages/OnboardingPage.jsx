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
    color: '#1d3461',
  },
  {
    Icon: MessageCircle,
    title: 'Talk to Sponsors',
    body: 'Each sponsor has a unique prompt question. Chat with them to learn the answer — you can\'t just guess your way through!',
    cta: 'Next',
    color: '#254a84',
  },
  {
    Icon: Trophy,
    title: 'Win a Prize',
    body: 'Earn enough points to complete your passport, then you\'re entered to win. Look for the prize station at the conference.',
    cta: 'Start My Passport!',
    color: '#1d3461',
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
    <div style={{ minHeight: '100dvh', background: '#0d1e3c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 40px', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative background circles */}
      <div style={{ position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(37,74,132,0.25)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(29,52,97,0.4)', pointerEvents: 'none' }} />

      {/* Logo */}
      <img src="/logo-text.png" alt="IPELRA" style={{ width: 150, objectFit: 'contain', marginBottom: 32, position: 'relative', zIndex: 1 }} />

      {/* Card */}
      <div style={{ background: '#ffffff', borderRadius: 28, padding: '32px 28px', width: '100%', maxWidth: 380, textAlign: 'center', position: 'relative', zIndex: 1, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        {/* Icon tile */}
        <div style={{ width: 80, height: 80, borderRadius: 22, background: `linear-gradient(135deg, ${card.color} 0%, #254a84 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: `0 8px 24px rgba(29,52,97,0.3)`, transition: 'background 0.3s ease' }}>
          <card.Icon size={36} color="#ffffff" />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1d3461', marginBottom: 12, letterSpacing: '-0.3px' }}>
          {card.title}
        </h2>
        <p style={{ color: '#43474e', fontSize: 15, lineHeight: 1.65, marginBottom: 28 }}>
          {card.body}
        </p>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {CARDS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 28 : 8,
              height: 8,
              borderRadius: 9999,
              background: i === step ? '#1d3461' : '#c3c6cf',
              transition: 'width 0.3s ease, background 0.3s ease',
            }} />
          ))}
        </div>

        <button className="btn btn-primary btn-full btn-lg" onClick={advance}>
          {card.cta}
        </button>
      </div>

      {step < CARDS.length - 1 && (
        <button
          style={{ marginTop: 20, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.65)', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', position: 'relative', zIndex: 1, fontFamily: 'Manrope, sans-serif' }}
          onClick={skip}
        >
          Skip intro
        </button>
      )}
    </div>
  );
}
