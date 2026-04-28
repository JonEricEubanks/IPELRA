/**
 * AdminLayout.jsx — shared wrapper for all admin pages.
 * Renders the admin nav bar and page shell.
 */

import { NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  LayoutDashboard, CheckSquare, Building2, Users,
  Flag, Upload, Settings, RefreshCw,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/admin/readiness',  label: 'Readiness',  Icon: CheckSquare },
  { to: '/admin/sponsors',   label: 'Sponsors',   Icon: Building2 },
  { to: '/admin/attendees',  label: 'Attendees',  Icon: Users },
  { to: '/admin/flagged',    label: 'Flagged',    Icon: Flag },
  { to: '/admin/export',     label: 'Export',     Icon: Upload },
  { to: '/admin/settings',   label: 'Settings',   Icon: Settings },
  { to: '/admin/reset',      label: 'Reset',      Icon: RefreshCw },
];

export default function AdminLayout({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: 12, fontSize: 14, fontWeight: 600 },
          success: { iconTheme: { primary: '#1d3461', secondary: '#fff' } },
        }}
      />
      {/* Top bar */}
      <header style={{
        background: 'var(--color-primary)', color: '#fff',
        padding: '12px var(--space-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="IPELRA" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            Admin Portal
          </span>
        <a
          href="/.auth/logout"
          style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'none' }}
        >
          Sign out
        </a>
      </header>

      {/* Side nav (desktop) / Bottom nav (mobile) */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Desktop sidebar */}
        <nav style={{
          width: 200, flexShrink: 0, background: '#fff',
          borderRight: '1px solid var(--color-border)',
          display: 'none',
          /* shown via media query in index.css .admin-sidebar */
        }} className="admin-sidebar">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', textDecoration: 'none',
                fontSize: 14, fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                background: isActive ? 'var(--color-primary-light)' : 'transparent',
                borderRight: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
              })}
            >
              <item.Icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', paddingBottom: 80 }}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="admin-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid var(--color-border)',
        display: 'flex', zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '8px 4px', textDecoration: 'none', fontSize: 10,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-2)',
              fontWeight: isActive ? 700 : 400,
            })}
          >
            <item.Icon size={18} style={{ lineHeight: 1 }} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
