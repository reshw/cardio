import { useEffect, useState, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean; // true면 관리자만 접근 가능
}

export const ProtectedClubRoute = ({ children, requireAdmin = false }: Props) => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, [clubId, user]);

  const checkAccess = async () => {
    if (!clubId || !user) {
      alert('잘못된 접근입니다.');
      navigate('/club');
      return;
    }

    try {
      // 1. 클럽 멤버인지 확인
      const isMember = await clubService.isClubMember(clubId, user.id);

      if (!isMember) {
        alert('클럽 멤버만 접근할 수 있습니다.');
        navigate('/club');
        return;
      }

      // 2. 관리자 권한 필요한 경우 확인
      if (requireAdmin) {
        const isAdmin = await clubService.isClubAdmin(clubId, user.id);
        if (!isAdmin) {
          alert('관리자만 접근할 수 있습니다.');
          navigate('/club');
          return;
        }
      }

      setAuthorized(true);
    } catch (error) {
      console.error('권한 확인 실패:', error);
      alert('접근 권한을 확인할 수 없습니다.');
      navigate('/club');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
};
