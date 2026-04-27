/**
 * HelpPage.jsx — /help
 * FAQ accordion for attendees.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Map, HelpCircle } from 'lucide-react';

const FAQ = [
  {
    q: 'How do I earn points?',
    a: 'Visit each sponsor table, listen to their pitch, then answer their question in the app. Each correct answer earns points.',
  },
  {
    q: 'Do I have to visit every sponsor?',
    a: 'No. There is a points threshold to complete your passport and enter the prize drawing. Once you hit it, you\'re in!',
  },
  {
    q: 'My answer seems right but won\'t accept. What\'s wrong?',
    a: 'The system matches close answers, but try rephrasing. After 3 attempts a hint will appear. Ask the sponsor for help — that\'s the whole point!',
  },
  {
    q: 'I lost my magic link email. Can I get a new one?',
    a: 'Yes! Go to the login page and enter your email again. A fresh link will arrive in about a minute. Check your spam folder if you don\'t see it.',
  },
  {
    q: 'Where do I go when my passport is complete?',
    a: 'Look for the Prize Station near the registration desk. Show the completion screen to staff to receive your entry ticket.',
  },
  {
    q: 'I already visited a sponsor but it didn\'t record.',
    a: 'Find any IPELRA staff member — they can manually credit your account. Have your email address ready.',
  },
  {
    q: 'Does the app work without Wi-Fi?',
    a: 'No, it needs a connection to record your stops. The conference Wi-Fi network is "IPELRA2026" — check with registration for the password.',
  },
];

function Accordion({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginBottom: 'var(--space-2)',
    }}>
      <button
        className="btn btn-ghost"
        style={{
          width: '100%', textAlign: 'left', padding: 'var(--space-4)',
          borderRadius: 0, fontWeight: 600, fontSize: 15,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)',
        }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <ChevronDown
          size={18}
          color="var(--color-text-2)"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
      {open && (
        <div style={{
          padding: '0 var(--space-4) var(--space-4)',
          color: 'var(--color-text-2)', fontSize: 15, lineHeight: 1.7,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="page-content" style={{
        padding: 'var(--space-4)',
        paddingTop: 'calc(env(safe-area-inset-top, 16px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 80px)',
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 'var(--space-5)' }}>Help & FAQ</h1>

        {FAQ.map((item, i) => <Accordion key={i} q={item.q} a={item.a} />)}

        <div className="card" style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-2)', fontSize: 15, marginBottom: 'var(--space-3)' }}>
            Still stuck? Find an IPELRA staff member — they wear <strong>blue lanyards</strong>.
          </p>
        </div>
      </div>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid var(--color-border)',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 100,
      }}>
        {[
          { Icon: Map, label: 'Passport', path: '/' },
          { Icon: HelpCircle, label: 'Help', path: '/help', active: true },
        ].map(item => (
          <button
            key={item.path}
            className="btn btn-ghost"
            style={{
              flex: 1, padding: '10px 0', borderRadius: 0,
              flexDirection: 'column', gap: 2, fontSize: 11,
              color: item.active ? 'var(--color-primary)' : undefined,
            }}
            onClick={() => navigate(item.path)}
          >
            <item.Icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
