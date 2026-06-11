import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { History } from './pages/History';
import { AddWorkout } from './pages/AddWorkout';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { Club } from './pages/Club';
import { ClubSettings } from './pages/ClubSettings';
import { ClubGeneralSettings } from './pages/ClubGeneralSettings';
import { ClubMileageHub } from './pages/ClubMileageHub';
import { ClubMileageSettings } from './pages/ClubMileageSettings';
import { ClubMileageHideSettings } from './pages/ClubMileageHideSettings';
import { ClubMileageRetroactive } from './pages/ClubMileageRetroactive';
import { ClubStatsHub } from './pages/ClubStatsHub';
import { ClubSocialSettings } from './pages/ClubSocialSettings';
import { ClubRookieLeagueSettings } from './pages/ClubRookieLeagueSettings';
import { ClubStatsPage } from './pages/ClubStatsPage';
import { ClubGrowthDashboard } from './components/ClubGrowthDashboard';
import { ClubMySettings } from './pages/ClubMySettings';
import { ClubTransferOwnership } from './pages/ClubTransferOwnership';
import { ClubMembers } from './pages/ClubMembers';
import { ProtectedClubRoute } from './components/ProtectedClubRoute';
import { More } from './pages/More';
import { BlockedMembers } from './pages/BlockedMembers';
import { AdminPage } from './pages/AdminPage';
import { AdminClubApproval } from './pages/AdminClubApproval';
import { AdminUserManagement } from './pages/AdminUserManagement';
import { AdminWorkoutTypes } from './pages/AdminWorkoutTypes';
import { AdminImageSettings } from './pages/AdminImageSettings';
import { AdminStravaIntegrations } from './pages/AdminStravaIntegrations';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { JoinClub } from './pages/JoinClub';
import { AppGuide } from './pages/AppGuide';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import KakaoCallback from './components/KakaoCallback';
import './App.css';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Header />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<History />} />
          <Route path="/add-workout" element={<AddWorkout />} />
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/club" element={<Club />} />
          <Route path="/club/settings/:clubId" element={
            <ProtectedClubRoute>
              <ClubSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/general" element={
            <ProtectedClubRoute requireAdmin>
              <ClubGeneralSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/mileage" element={
            <ProtectedClubRoute requireAdmin>
              <ClubMileageHub />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/mileage-config" element={
            <ProtectedClubRoute requireAdmin>
              <ClubMileageSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/mileage-retroactive" element={
            <ProtectedClubRoute requireAdmin>
              <ClubMileageRetroactive />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/rookie-league" element={
            <ProtectedClubRoute requireAdmin>
              <ClubRookieLeagueSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/mileage-hide" element={
            <ProtectedClubRoute requireAdmin>
              <ClubMileageHideSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/transfer" element={
            <ProtectedClubRoute requireAdmin>
              <ClubTransferOwnership />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/stats" element={
            <ProtectedClubRoute requireAdmin>
              <ClubStatsHub />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/stats-chart" element={
            <ProtectedClubRoute requireAdmin>
              <ClubStatsPage />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/growth" element={
            <ProtectedClubRoute requireAdmin>
              <ClubGrowthDashboard />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/social" element={
            <ProtectedClubRoute requireAdmin>
              <ClubSocialSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/my-settings/:clubId" element={
            <ProtectedClubRoute>
              <ClubMySettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/members/:clubId" element={
            <ProtectedClubRoute>
              <ClubMembers />
            </ProtectedClubRoute>
          } />
          <Route path="/join" element={<JoinClub />} />
          <Route path="/join/:code" element={<JoinClub />} />
          <Route path="/more" element={<More />} />
          <Route path="/blocked-members" element={<BlockedMembers />} />
          <Route path="/guide" element={<AppGuide />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/club-approval" element={<AdminClubApproval />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
          <Route path="/admin/workout-types" element={<AdminWorkoutTypes />} />
          <Route path="/admin/image-settings" element={<AdminImageSettings />} />
          <Route path="/admin/strava" element={<AdminStravaIntegrations />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Supabase Auth 콜백 (Kakao OAuth 완료 후 여기로 리다이렉트) */}
          <Route path="/auth/callback" element={<KakaoCallback />} />
          {/* 기존 URL 하위 호환 */}
          <Route path="/auth/kakao/callback" element={<KakaoCallback />} />

          {/* Protected routes */}
          <Route path="/*" element={
            <div className="app-container">
              <ProtectedRoutes />
            </div>
          } />
        </Routes>
      </HashRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
