import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clubService from '../services/clubService';
import type { ClubWithMemberInfo, Club } from '../types';

export const ClubPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'my' | 'public'>('my');
  const [myClubs, setMyClubs] = useState<ClubWithMemberInfo[]>([]);
  const [publicClubs, setPublicClubs] = useState<Club[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClubs();
  }, [view]);

  const loadClubs = async () => {
    setLoading(true);
    try {
      if (view === 'my') {
        const clubs = await clubService.getMyClubs();
        setMyClubs(clubs);
      } else {
        const clubs = await clubService.searchPublicClubs(searchQuery);
        setPublicClubs(clubs);
      }
    } catch (error) {
      console.error('클럽 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (view === 'public') {
      await loadClubs();
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return '👑 소유자';
      case 'admin':
        return '⭐ 관리자';
      default:
        return '👤 멤버';
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>클럽</h1>
        <button className="add-button" onClick={() => navigate('/club/create')}>
          + 만들기
        </button>
      </div>

      {/* Tab Selector */}
      <div className="mode-selector">
        <button
          className={`mode-button ${view === 'my' ? 'active' : ''}`}
          onClick={() => setView('my')}
        >
          내 클럽
        </button>
        <button
          className={`mode-button ${view === 'public' ? 'active' : ''}`}
          onClick={() => setView('public')}
        >
          공개 클럽
        </button>
      </div>

      {/* Search (public clubs) */}
      {view === 'public' && (
        <div className="section" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="text-input-area"
              placeholder="클럽 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, minHeight: 'auto', padding: '12px' }}
            />
            <button className="primary-button" onClick={handleSearch}>
              검색
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="loading-screen">로딩 중...</div>
      ) : (
        <>
          {/* My Clubs */}
          {view === 'my' && (
            <>
              {myClubs.length === 0 ? (
                <div className="empty-state">
                  <p>아직 가입한 클럽이 없습니다.</p>
                  <button className="primary-button" onClick={() => navigate('/club/create')}>
                    첫 클럽 만들기
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myClubs.map((club) => (
                    <div
                      key={club.id}
                      className="log-item"
                      onClick={() => navigate(`/club/${club.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                          {club.name}
                        </h3>
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            borderRadius: '6px',
                          }}
                        >
                          {getRoleBadge(club.my_role)}
                        </span>
                      </div>
                      {club.description && (
                        <p
                          style={{
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                            marginBottom: '8px',
                          }}
                        >
                          {club.description}
                        </p>
                      )}
                      <div className="log-meta">
                        <span>{club.is_public ? '🌐 공개' : '🔒 비공개'}</span>
                        <span>가입일: {new Date(club.joined_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Public Clubs */}
          {view === 'public' && (
            <>
              {publicClubs.length === 0 ? (
                <div className="empty-state">
                  <p>검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {publicClubs.map((club) => (
                    <div
                      key={club.id}
                      className="log-item"
                      onClick={() => navigate(`/club/${club.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                        {club.name}
                      </h3>
                      {club.description && (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                          {club.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
