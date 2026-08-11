import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft } from 'lucide-react';
import clubService from '../services/clubService';
import workoutTypeService from '../services/workoutTypeService';
import { ClubExclusionRulesSection } from '../components/ClubExclusionRulesSection';

interface CategoryOption {
  key: string;
  label: string;
  emoji: string;
}

export const ClubMileageExclusionSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId) loadEnabledCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const loadEnabledCategories = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const [rows, types] = await Promise.all([
        clubService.getClubMileageConfigs(clubId),
        workoutTypeService.getActiveWorkoutTypes(),
      ]);
      const emojiByName = new Map(types.map((t) => [t.name, t.emoji]));
      const enabledOptions = rows
        .filter((r) => r.enabled)
        .map((r) => {
          const key = r.sub_type ? `${r.category}-${r.sub_type}` : r.category;
          const label = r.sub_type ? `${r.category} - ${r.sub_type}` : r.category;
          return { key, label, emoji: emojiByName.get(r.category) || '🏃' };
        });
      setCategories(enabledOptions);
    } catch (err: any) {
      console.error('활성화된 종목 불러오기 실패 상세:', JSON.stringify(err), err);
      alert(`종목 정보를 불러올 수 없습니다: ${err?.message || JSON.stringify(err)}`);
      navigate(-1);
    } finally {
      setLoading(false);
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

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>마일리지 제외 규칙</h1>
        </div>
      </div>

      <div className="settings-form">
        {clubId && <ClubExclusionRulesSection clubId={clubId} categories={categories} />}
      </div>
    </div>
  );
};
