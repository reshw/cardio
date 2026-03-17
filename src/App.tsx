import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { History } from './pages/History';
import { AddWorkout } from './pages/AddWorkout';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { Club } from './pages/Club';
import { ClubMemberDetail } from './pages/ClubMemberDetail';
import { ClubSettings } from './pages/ClubSettings';
import { ClubGeneralSettings } from './pages/ClubGeneralSettings';
import { ClubMileageSettings } from './pages/ClubMileageSettings';
import { ClubMySettings } from './pages/ClubMySettings';
import { ClubTransferOwnership } from './pages/ClubTransferOwnership';
import { ClubMembers } from './pages/ClubMembers';
import { ProtectedClubRoute } from './components/ProtectedClubRoute';
import { More } from './pages/More';
import { AdminPage } from './pages/AdminPage';
import { AdminClubApproval } from './pages/AdminClubApproval';
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
          <Route path="/club/member/:clubId/:userId/:userName" element={
            <ProtectedClubRoute>
              <ClubMemberDetail />
            </ProtectedClubRoute>
          } />
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
              <ClubMileageSettings />
            </ProtectedClubRoute>
          } />
          <Route path="/club/settings/:clubId/transfer" element={
            <ProtectedClubRoute requireAdmin>
              <ClubTransferOwnership />
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
          <Route path="/guide" element={<AppGuide />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/club-approval" element={<AdminClubApproval />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
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
  );
}

export default App;
