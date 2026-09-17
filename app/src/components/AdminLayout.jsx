/**
 * AdminLayout.jsx — shared shell for the staff portal.
 *
 * Four tabs only: Dashboard · Attendees · Sponsors · Export.
 * Desktop (≥ 900px): dark left sidebar. Mobile: bottom tab bar.
 * Everything technical (system status, conference reset) lives inside Export.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Users, Building2, Download, LogOut } from 'lucide-react';

export const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/admin/attendees', label: 'Attendees', Icon: Users },
  { to: '/admin/sponsors',  label: 'Sponsors',  Icon: Building2 },
  { to: '/admin/export',    label: 'Export',    Icon: Download },
];

export default function AdminLayout({ children, title, subtitle, actions, wide = false }) {
  const navigate = useNavigate();

  function signOut() {
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin-shell">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: 12, fontSize: 14, fontWeight: 600 },
          success: { iconTheme: { primary: '#1d3461', secondary: '#fff' } },
        }}
      />

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <img src="/logo.png" alt="" />
          <div>
            <div className="admin-sidebar__brand-title">IPELRA</div>
            <div className="admin-sidebar__brand-sub">Staff Portal · 2026</div>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {ADMIN_NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `admin-sidebar__link${isActive ? ' is-active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className="admin-sidebar__signout" onClick={signOut}>
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="admin-main">
        {/* Mobile top bar */}
        <header className="admin-topbar">
          <span className="admin-topbar__brand">
            <img src="/logo.png" alt="" />
            Staff Portal
          </span>
          <button type="button" onClick={signOut} className="admin-topbar__signout">Sign out</button>
        </header>

        <main className={`admin-content${wide ? ' admin-content--wide' : ''}`}>
          {(title || actions) && (
            <div className="admin-page-header">
              <div>
                {title && <h1 className="admin-page-title">{title}</h1>}
                {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
              </div>
              {actions && <div className="admin-page-actions">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tabs ──────────────────────────────────────── */}
      <nav className="admin-tabbar">
        {ADMIN_NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `admin-tabbar__link${isActive ? ' is-active' : ''}`}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
