import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Attendee screens
import LoginPage        from './pages/LoginPage.jsx';
import VerifyPage       from './pages/VerifyPage.jsx';
import OnboardingPage   from './pages/OnboardingPage.jsx';
import PassportHomePage from './pages/PassportHomePage.jsx';
import SponsorStopPage  from './pages/SponsorStopPage.jsx';
import CompletedPage    from './pages/CompletedPage.jsx';
import HelpPage         from './pages/HelpPage.jsx';
import RankingsPage     from './pages/RankingsPage.jsx';
import OfflinePage      from './pages/OfflinePage.jsx';
import LinkExpiredPage  from './pages/LinkExpiredPage.jsx';
import ScanPage         from './pages/ScanPage.jsx';

// Admin screens
import AdminLoginPage      from './pages/AdminLoginPage.jsx';
import AdminVerifyPage     from './pages/AdminVerifyPage.jsx';
import AdminDashboardPage  from './pages/AdminDashboardPage.jsx';
import AdminSponsorsPage   from './pages/AdminSponsorsPage.jsx';
import AdminSponsorEditPage from './pages/AdminSponsorEditPage.jsx';
import AdminAttendeePage   from './pages/AdminAttendeePage.jsx';
import AdminExportPage     from './pages/AdminExportPage.jsx';

// Guards
function RequireAuth({ children }) {
  const { attendee, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!attendee) return <Navigate to="/login" replace />;
  return children;
}

// Client-side gate only; every /api/mgmt/* call is still verified server-side.
function RequireAdminAuth({ children }) {
  const token = localStorage.getItem('admin_token') ?? sessionStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Attendee flow */}
            <Route path="/login"     element={<LoginPage />} />
            <Route path="/verify"    element={<VerifyPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/link-expired" element={<LinkExpiredPage />} />
            <Route path="/offline"   element={<OfflinePage />} />
            <Route path="/help"      element={<HelpPage />} />
            {/* QR deep link — handles its own auth so logged-out scanners get routed to login and back */}
            <Route path="/scan/:sponsorId" element={<ScanPage />} />

            <Route path="/" element={
              <RequireAuth><PassportHomePage /></RequireAuth>
            } />
            <Route path="/sponsor/:id" element={
              <RequireAuth><SponsorStopPage /></RequireAuth>
            } />
            <Route path="/completed" element={
              <RequireAuth><CompletedPage /></RequireAuth>
            } />
            <Route path="/rankings" element={
              <RequireAuth><RankingsPage /></RequireAuth>
            } />

            {/* Admin portal — email magic link auth. Four tabs: Dashboard · Attendees · Sponsors · Export */}
            <Route path="/admin/login"              element={<AdminLoginPage />} />
            <Route path="/admin/verify"             element={<AdminVerifyPage />} />
            <Route path="/admin"                    element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard"          element={<RequireAdminAuth><AdminDashboardPage /></RequireAdminAuth>} />
            <Route path="/admin/attendees"          element={<RequireAdminAuth><AdminAttendeePage /></RequireAdminAuth>} />
            <Route path="/admin/sponsors"           element={<RequireAdminAuth><AdminSponsorsPage /></RequireAdminAuth>} />
            <Route path="/admin/sponsors/new"       element={<RequireAdminAuth><AdminSponsorEditPage /></RequireAdminAuth>} />
            <Route path="/admin/sponsors/:id"       element={<RequireAdminAuth><AdminSponsorEditPage /></RequireAdminAuth>} />
            <Route path="/admin/export"             element={<RequireAdminAuth><AdminExportPage /></RequireAdminAuth>} />
            {/* Retired pages — their content now lives elsewhere; keep old bookmarks working */}
            <Route path="/admin/flagged"            element={<Navigate to="/admin/sponsors" replace />} />
            <Route path="/admin/readiness"          element={<Navigate to="/admin/export" replace />} />
            <Route path="/admin/settings"           element={<Navigate to="/admin/export" replace />} />
            <Route path="/admin/reset"              element={<Navigate to="/admin/export" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
