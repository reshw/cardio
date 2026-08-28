import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PageHeaderProvider } from './contexts/PageHeaderContext';
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
import { ClubMileageFilterSettings } from './pages/ClubMileageFilterSettings';
import { ClubMileageExclusionSettings } from './pages/ClubMileageExclusionSettings';
import { ClubMileageRetroactive } from './pages/ClubMileageRetroactive';
import { ClubStatsHub } from './pages/ClubStatsHub';
import { ClubSocialSettings } from './pages/ClubSocialSettings';
import { ClubPermissions } from './pages/ClubPermissions';
import { ClubRookieLeagueSettings } from './pages/ClubRookieLeagueSettings';
import { ClubStatsPage } from './pages/ClubStatsPage';
import { ClubGrowthDashboard } from './components/ClubGrowthDashboard';
import { ClubMySettings } from './pages/ClubMySettings';
import { ClubTransferOwnership } from './pages/ClubTransferOwnership';
import { ClubMembers } from './pages/ClubMembers';
import { ClubGallery } from './pages/ClubGallery';
import { ProtectedClubRoute } from './components/ProtectedClubRoute';
import { More } from './pages/More';
import { BlockedMembers } from './pages/BlockedMembers';
import { DebugMergeRequests } from './pages/DebugMergeRequests';
import { AdminPage } from './pages/AdminPage';
import { AdminClubApproval } from './pages/AdminClubApproval';
import { AdminUserManagement } from './pages/AdminUserManagement';
import { AdminWorkoutTypes } from './pages/AdminWorkoutTypes';
import { AdminImageSettings } from './pages/AdminImageSettings';
import { AdminEntryLimitSettings } from './pages/AdminEntryLimitSettings';
import { AdminStravaIntegrations } from './pages/AdminStravaIntegrations';
import { AdminDemoUsers } from './pages/AdminDemoUsers';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { PrivacyPolicyIOS } from './pages/PrivacyPolicyIOS';
import { TermsOfService } from './pages/TermsOfService';
import { Download } from './pages/Download';
import { Support } from './pages/Support';
import { JoinClub } from './pages/JoinClub';
import { InviteLanding } from './pages/InviteLanding';
import { AppGuide } from './pages/AppGuide';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import KakaoCallback from './components/KakaoCallback';
import PhotoUpload from './pages/PhotoUpload';
import { AppAuthBridge } from './pages/AppAuthBridge';
import { useIsNativeApp } from './hooks/useIsNativeApp';
import { useTheme } from './hooks/useTheme';
import { DiagOverlay } from './components/DiagOverlay';
import './App.css';

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const isNativeApp = useIsNativeApp();

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
    <PageHeaderProvider>
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
          <Route path="/club/settings/:clubId/mileage-filter" element={
            <ProtectedClubRoute requireAdmin>
              <ClubMileageFilterSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/mileage-exclusion" element={
            <ProtectedClubRoute requireAdmin>
              <ClubMileageExclusionSettings />
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
          <Route path="/club/settings/:clubId/permissions" element={
            <ProtectedClubRoute requireAdmin>
              <ClubPermissions />
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
          <Route path="/club/gallery/:clubId" element={
            <ProtectedClubRoute>
              <ClubGallery />
            </ProtectedClubRoute>
          } />
          <Route path="/join" element={<JoinClub />} />
          <Route path="/join/:code" element={<JoinClub />} />
          <Route path="/more" element={<More />} />
          <Route path="/blocked-members" element={<BlockedMembers />} />
          <Route path="/debug/merge-requests" element={<DebugMergeRequests />} />
          <Route path="/guide" element={<AppGuide />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/club-approval" element={<AdminClubApproval />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
          <Route path="/admin/workout-types" element={<AdminWorkoutTypes />} />
          <Route path="/admin/image-settings" element={<AdminImageSettings />} />
          <Route path="/admin/entry-limit" element={<AdminEntryLimitSettings />} />
          <Route path="/admin/strava" element={<AdminStravaIntegrations />} />
          <Route path="/admin/demo-users" element={<AdminDemoUsers />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isNativeApp && <BottomNav />}
    </PageHeaderProvider>
  );
}

function App() {
  // 어느 경로로 진입하든 테마 스토어가 마운트되도록 최상위에서 1회 호출한다.
  // (네이티브에 부팅 테마를 알리고, CardioWeb.setTheme 인바운드를 살려두는 역할)
  useTheme();

  return (
    <ErrorBoundary>
    <AuthProvider>
      <DiagOverlay />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy-ios" element={<PrivacyPolicyIOS />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* App Store Connect 지원 URL — 심사자는 비로그인이라 반드시 public 이어야 한다 */}
          <Route path="/support" element={<Support />} />
          <Route path="/download" element={<Download />} />
          {/* 클럽 초대 게이트웨이 — 카카오 공유 링크의 착지점. 비로그인 외부인이 보므로 public */}
          <Route path="/i/:code" element={<InviteLanding />} />
          <Route path="/photo-upload" element={<PhotoUpload />} />

          {/* Android 앱 세션 브릿지 */}
          <Route path="/app-auth" element={<AppAuthBridge />} />

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
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
