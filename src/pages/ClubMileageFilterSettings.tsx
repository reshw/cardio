import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft } from 'lucide-react';
import clubService from '../services/clubService';

// "달리기-트레드밀" → "달리기" (상위 카테고리만)
const parentCategoryOf = (key: string): string => {
  const dashIdx = key.indexOf('-');
  return dashIdx > -1 ? key.substring(0, dashIdx) : key;
};

export const ClubMileageFilterSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();

  const [allParents, setAllParents] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (clubId) loadClub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const loadClub = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const [rows, club] = await Promise.all([
        clubService.getClubMileageConfigs(clubId),
        clubService.getClubById(clubId),
      ]);
      const enabledKeys = rows
        .filter((r) => r.enabled)
        .map((r) => (r.sub_type ? `${r.category}-${r.sub_type}` : r.category));
      setAllParents([...new Set(enabledKeys.map(parentCategoryOf))].sort());
      setFilterCategories(club.mileage_filter_categories ?? null);
    } catch (err: any) {
      console.error('클럽 정보 불러오기 실패 상세:', JSON.stringify(err), err);
      alert(`클럽 정보를 불러올 수 없습니다: ${err?.message || JSON.stringify(err)}`);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clubId) return;
    setUpdating(true);
    try {
      await clubService.updateClub(clubId, { mileage_filter_categories: filterCategories });
      alert('저장되었습니다.');
      navigate(-1);
    } catch (err: any) {
      console.error('순위 필터 저장 실패 상세:', JSON.stringify(err), err);
      alert(`저장 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  const effective = filterCategories ?? allParents;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>순위 필터에 노출할 종목</h1>
        </div>
      </div>

      <div className="settings-form">
        <div className="settings-section">
          <h3>노출할 종목 선택</h3>
          <p className="form-hint">
            클럽 마일리지 탭 순위 화면의 종목별 필터 칩에 표시할 종목을 고르세요. 여기서 뺀 종목도
            마일리지 집계·계수에는 그대로 반영되며, 순위 화면의 필터 선택지에서만 숨겨집니다.
            (러닝·트레드밀처럼 하위분류가 있는 종목은 필터에서 하나로 합쳐서 표시됩니다.)
          </p>

          {allParents.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '16px 0' }}>
              활성화된 운동 종류가 없습니다. 마일리지 계수 설정에서 먼저 종목을 활성화해주세요.
            </p>
          ) : (
            <div className="category-checkboxes">
              {allParents.map((parent) => (
                <label key={parent} className="category-checkbox-item">
                  <input
                    type="checkbox"
                    checked={effective.includes(parent)}
                    onChange={(e) => {
                      const base = filterCategories ?? allParents;
                      setFilterCategories(
                        e.target.checked
                          ? [...base, parent]
                          : base.filter((c) => c !== parent)
                      );
                    }}
                  />
                  <span>{parent}</span>
                </label>
              ))}
              {filterCategories !== null && (
                <button
                  type="button"
                  onClick={() => setFilterCategories(null)}
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  전체 노출로 초기화
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="primary-button-full"
          onClick={handleSave}
          disabled={updating}
          style={{ marginTop: '32px' }}
        >
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
};
