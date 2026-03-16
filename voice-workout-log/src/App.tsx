import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { History } from './pages/History';
import { Dashboard } from './pages/Dashboard';
import { TodoList } from './pages/TodoList';
import { Recommend } from './pages/Recommend';
import { ClubPage } from './pages/Club';
import { CreateClubPage } from './pages/CreateClub';
import { ClubDetailPage } from './pages/ClubDetail';
import { JoinClubPage } from './pages/JoinClub';
import { ChallengeDetailPage } from './pages/ChallengeDetail';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import KakaoCallback from './components/KakaoCallback';
import './App.css';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<History />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/todo" element={<TodoList />} />
        <Route path="/recommend" element={<Recommend />} />

        {/* Club routes */}
        <Route path="/club" element={<ClubPage />} />
        <Route path="/club/create" element={<CreateClubPage />} />
        <Route path="/club/:clubId" element={<ClubDetailPage />} />
        <Route path="/club/:clubId/challenge/:challengeId" element={<ChallengeDetailPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallback />} />

          {/* Club invite link (public) */}
          <Route path="/club/join/:inviteCode" element={<JoinClubPage />} />

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
