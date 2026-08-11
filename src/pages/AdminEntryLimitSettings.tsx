import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Save } from 'lucide-react';
import { getWorkoutEntryLimitDays, setWorkoutEntryLimitDays, DEFAULT_ENTRY_LIMIT_DAYS } from '../services/settingsService';

const PRESETS: { label: string; days: number | null }[] = [
  { label: '3일 (기본)', days: DEFAULT_ENTRY_LIMIT_DAYS },
  { label: '7일', days: 7 },
  { label: '한 달 (31일)', days: 31 },
  { label: '제한 없음', days: null },
];

export const AdminEntryLimitSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState<number | null>(DEFAULT_ENTRY_LIMIT_DAYS);
  const [customDays, setCustomDays] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWorkoutEntryLimitDays()
      .then(setDays)
      .finally(() => setLoading(false));
  }, []);

  const isPreset = PRESETS.some(p => p.days === days);

  const handleCustomApply = () => {
    const n = parseInt(customDays, 10);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      alert('1~365 사이의 일수를 입력해주세요.');
      return;
    }
    setDays(n);
  };

  const handleSave = async () => {
    if (!user?.is_super_admin) {
      alert('슈퍼관리자만 설정을 변경할 수 있습니다.');
      return;
    }

    setSaving(true);
    try {
      await setWorkoutEntryLimitDays(days, user.id);
      alert('✅ 설정이 저장되었습니다!\n\n기록 입력 화면에 즉시 적용됩니다.');
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert('❌ 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!user?.is_super_admin) {
    return (
      <div className="container">
        <div className="error-message">슈퍼관리자만 접근할 수 있습니다.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>설정 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <ChevronLeft size={24} />
        </button>
        <h1>기록 입력 제한 설정</h1>
      </div>

      <div className="section">
        <div className="info-box">
          <p>📅 수기 기록 입력 허용 기간</p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            사용자가 과거 몇 일까지의 운동 기록을 입력할 수 있는지 설정합니다.
            당일 포함 일수 기준이며, Strava·Health Connect 자동 기록에는 적용되지 않습니다.
          </p>
        </div>
      </div>

      <div className="section">
        <h3>현재 설정</h3>
        <p className="entry-limit-current">
          {days === null ? '제한 없음' : `당일 포함 ${days}일 (${days - 1}일 전까지 입력 가능)`}
        </p>
      </div>

      <div className="section">
        <h3>허용 기간 선택</h3>
        <div className="entry-limit-presets">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              className={`entry-limit-preset-btn${days === preset.days ? ' active' : ''}`}
              onClick={() => setDays(preset.days)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="entry-limit-custom">
          <input
            type="number"
            min={1}
            max={365}
            placeholder="직접 입력 (일수)"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
          />
          <button type="button" onClick={handleCustomApply}>적용</button>
        </div>
        {!isPreset && days !== null && (
          <p style={{ fontSize: '13px', color: 'var(--primary-color)', marginTop: '8px' }}>
            직접 입력값 선택됨: {days}일
          </p>
        )}
      </div>

      <button
        className="primary-button"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: '24px' }}
      >
        <Save size={20} />
        {saving ? '저장 중...' : '설정 저장'}
      </button>

      <div className="section" style={{ marginTop: '24px' }}>
        <div className="info-box" style={{ background: '#FFF3E0', borderColor: '#FF9800' }}>
          <p style={{ fontSize: '14px' }}>
            ⚠️ <strong>일시 개방 시 주의:</strong> 소급 입력을 위해 기간을 늘린 뒤에는 다시 기본값(3일)으로 되돌리는 것을 잊지 마세요.
          </p>
        </div>
      </div>

      <style>{`
        .entry-limit-current {
          font-size: 16px;
          font-weight: 600;
          color: var(--primary-color);
        }

        .entry-limit-presets {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }

        .entry-limit-preset-btn {
          padding: 12px 0;
          border-radius: 12px;
          border: 1.5px solid var(--border-color);
          background: var(--input-bg);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .entry-limit-preset-btn.active {
          border-color: var(--primary-color);
          background: rgba(79, 195, 247, 0.1);
          color: var(--primary-color);
        }

        .entry-limit-custom {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .entry-limit-custom input {
          flex: 1;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1.5px solid var(--border-color);
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
        }

        .entry-limit-custom button {
          padding: 10px 20px;
          border-radius: 12px;
          border: none;
          background: var(--primary-color);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }

        .info-box {
          background: #E3F2FD;
          border: 1px solid #2196F3;
          padding: 16px;
          border-radius: 8px;
        }

        .info-box p {
          margin: 0;
        }
      `}</style>
    </div>
  );
};
