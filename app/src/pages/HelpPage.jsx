/**
 * HelpPage.jsx — /help
 * FAQ accordion for attendees.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HelpCircle, Star, Users, MessageSquare, Mail, Trophy, ShieldAlert } from 'lucide-react';
import { BottomNav } from './PassportHomePage';

const FAQ = [
  {
    icon: Star,
    q: 'How do I earn points?',
    a: 'Visit each sponsor table, listen to their pitch, then answer their question in the app. Each correct answer earns points toward your passport completion.',
  },
  {
    icon: Users,
    q: 'Do I have to visit every sponsor?',
    a: 'No. There is a points threshold to complete your passport and enter the prize drawing. Once you hit it, you\'re in — keep going to earn bonus entries!',
  },
  {
    icon: MessageSquare,
    q: 'My answer seems right but won\'t accept. What\'s wrong?',
    a: 'The system matches close answers, but try rephrasing. After 3 attempts a hint will appear. Ask the sponsor for help — that\'s the whole point!',
  },
  {
    icon: Mail,
    q: 'I lost my magic link email. Can I get a new one?',
    a: 'Yes! Go to the login page and enter your email again. A fresh link will arrive in about a minute. Check your spam folder if you don\'t see it.',
  },
  {
    icon: Trophy,
    q: 'Where do I go when my passport is complete?',
    a: 'Look for the Prize Station near the registration desk. Show the completion screen to staff to receive your entry ticket.',
  },
  {
    icon: ShieldAlert,
    q: 'I already visited a sponsor but it didn\'t record.',
    a: 'Find any IPELRA staff member — they can manually credit your account. Have your email address ready.',
  },
];

function Accordion({ icon: Icon, q, a, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: '#ffffff',
        border: `1.5px solid ${open ? '#1d3461' : '#e7e8e9'}`,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 10,
        boxShadow: open ? '0 4px 20px rgba(29,52,97,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <button
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '16px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div style={{
          width: 38, height: 38, flexShrink: 0,
          borderRadius: 12,
          background: open ? '#1d3461' : '#f0f4fa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}>
          <Icon size={18} color={open ? '#ffffff' : '#1d3461'} strokeWidth={2} />
        </div>
        <span style={{
          flex: 1,
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
          fontSize: 15,
          color: open ? '#1d3461' : '#191c1d',
          lineHeight: 1.4,
          textAlign: 'left',
        }}>{q}</span>
        <ChevronDown
          size={18}
          color={open ? '#1d3461' : '#74777f'}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
        />
      </button>
      <div style={{
        maxHeight: open ? 300 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          padding: '0 18px 18px 70px',
          color: '#43474e',
          fontSize: 14,
          lineHeight: 1.75,
        }}>
          {a}
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100dvh', background: '#f0f4fa', position: 'relative' }}>

      {/* Hero header */}
      <header style={{
        background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)',
        paddingTop:    'calc(env(safe-area-inset-top, 16px) + 16px)',
        paddingBottom: 32,
        paddingLeft:   20,
        paddingRight:  20,
        borderRadius:  '0 0 2rem 2rem',
        position:      'relative',
        overflow:      'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,222,165,0.06)', pointerEvents: 'none' }} />

        <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 14px', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HelpCircle size={24} color="#ffffff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Support</div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24, color: '#ffffff', letterSpacing: '-0.4px', lineHeight: 1.1, margin: 0 }}>Help &amp; FAQ</h1>
          </div>
        </div>
      </header>

      {/* FAQ list */}
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 0' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>
          {FAQ.length} questions
        </p>

        {FAQ.map((item, i) => (
          <Accordion key={i} index={i} icon={item.icon} q={item.q} a={item.a} />
        ))}

        {/* Still stuck */}
        <div style={{
          marginTop: 8,
          marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
          background: 'linear-gradient(135deg, #1d3461 0%, #254a84 100%)',
          borderRadius: 20,
          padding: '22px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: '#ffffff', marginBottom: 4 }}>Still stuck?</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
              Find an IPELRA staff member — they wear <span style={{ color: '#adc8f2', fontWeight: 700 }}>blue lanyards</span>.
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="/help" />
    </div>
  );
}
