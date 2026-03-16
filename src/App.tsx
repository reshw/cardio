import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { History } from './pages/History';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { Club } from './pages/Club';
import { ClubMemberDetail } from './pages/ClubMemberDetail';
import { ClubSettings } from './pages/ClubSettings';
import { ClubGeneralSettings } from './pages/ClubGeneralSettings';
import { ClubMileageSettings } from './pages/ClubMileageSettings';
import { ClubMySettings } from './pages/ClubMySettings';
import { ClubTransferOwnership } from './pages/ClubTransferOwnership';
import { More } from './pages/More';
import { JoinClub } from './pages/JoinClub';
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
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/club" element={<Club />} />
          <Route path="/club/member/:clubId/:userId/:userName" element={<ClubMemberDetail />} />
          <Route path="/club/settings/:clubId/:clubName" element={<ClubSettings />} />
          <Route path="/club/settings/:clubId/:clubName/general" element={<ClubGeneralSettings />} />
          <Route path="/club/settings/:clubId/:clubName/mileage" element={<ClubMileageSettings />} />
          <Route path="/club/settings/:clubId/:clubName/transfer" element={<ClubTransferOwnership />} />
          <Route path="/club/my-settings/:clubId/:clubName" element={<ClubMySettings />} />
          <Route path="/join" element={<JoinClub />} />
          <Route path="/join/:code" element={<JoinClub />} />
          <Route path="/more" element={<More />} />
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
