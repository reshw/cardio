import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImageSettings {
  max_width: number;
  quality: number;
  thumbnail_size: number;
}

export const AdminImageSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ImageSettings>({
    max_width: 1280,
    quality: 75,
    thumbnail_size: 300,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 설정 불러오기
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'image_upload')
        .single();

      if (error) {
        // 설정이 없으면 기본값 사용
        console.log('기본 설정 사용');
      } else if (data?.value) {
        setSettings(data.value as ImageSettings);
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.is_super_admin) {
      alert('슈퍼관리자만 설정을 변경할 수 있습니다.');
      return;
    }

    setSaving(true);
    try {
      // upsert: 있으면 업데이트, 없으면 삽입
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'image_upload',
          value: settings,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });

      if (error) throw error;

      alert('✅ 설정이 저장되었습니다!\n\n서버 재시작 후 적용됩니다.');
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
        <button className="back-button" onClick={() => navigate('/more')}>
          <ChevronLeft size={24} />
        </button>
        <h1>이미지 업로드 설정</h1>
      </div>

      <div className="section">
        <div className="info-box">
          <p>📸 이미지 업로드 최적화 설정</p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            모든 이미지는 WebP 포맷으로 자동 변환됩니다.
          </p>
        </div>
      </div>

      <div className="section">
        <h3>원본 이미지 최대 크기</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          업로드된 이미지의 최대 너비/높이를 설정합니다. 큰 이미지는 자동으로 축소됩니다.
        </p>

        <div className="slider-container">
          <div className="slider-header">
            <span>크기</span>
            <span className="slider-value">{settings.max_width}px</span>
          </div>
          <input
            type="range"
            min="800"
            max="1920"
            step="80"
            value={settings.max_width}
            onChange={(e) => setSettings({ ...settings, max_width: parseInt(e.target.value) })}
            className="slider"
          />
          <div className="slider-labels">
            <span>800px</span>
            <span>1280px (권장)</span>
            <span>1920px</span>
          </div>
        </div>

        <div className="size-info">
          <p>📊 예상 파일 크기:</p>
          <ul>
            <li>800px: ~100KB</li>
            <li>1280px: ~200KB (권장)</li>
            <li>1920px: ~400KB</li>
          </ul>
        </div>
      </div>

      <div className="section">
        <h3>압축 품질</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          품질이 높을수록 파일 크기가 커집니다. 70-80%가 적당합니다.
        </p>

        <div className="slider-container">
          <div className="slider-header">
            <span>품질</span>
            <span className="slider-value">{settings.quality}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="95"
            step="5"
            value={settings.quality}
            onChange={(e) => setSettings({ ...settings, quality: parseInt(e.target.value) })}
            className="slider"
          />
          <div className="slider-labels">
            <span>60% (낮음)</span>
            <span>75% (권장)</span>
            <span>95% (높음)</span>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>썸네일 크기</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          목록에서 표시되는 썸네일 이미지의 크기입니다.
        </p>

        <div className="slider-container">
          <div className="slider-header">
            <span>크기</span>
            <span className="slider-value">{settings.thumbnail_size}px</span>
          </div>
          <input
            type="range"
            min="200"
            max="500"
            step="50"
            value={settings.thumbnail_size}
            onChange={(e) => setSettings({ ...settings, thumbnail_size: parseInt(e.target.value) })}
            className="slider"
          />
          <div className="slider-labels">
            <span>200px</span>
            <span>300px (권장)</span>
            <span>500px</span>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>예상 스토리지 사용량</h3>
        <div className="storage-estimate">
          <p>현재 설정 기준 (WebP {settings.max_width}px, {settings.quality}% 품질):</p>
          <ul>
            <li>평균 파일 크기: ~{Math.round(settings.max_width * settings.quality / 5)}KB</li>
            <li>하루 50명 업로드: ~{Math.round(settings.max_width * settings.quality / 100)}MB/일</li>
            <li>10GB 도달: 약 {Math.round(10000 / (settings.max_width * settings.quality / 100))}일</li>
          </ul>
        </div>
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
        <div className="info-box" style={{ background: '#FFF9E6', borderColor: '#FFD700' }}>
          <p style={{ fontSize: '14px' }}>
            ⚠️ <strong>주의:</strong> 설정 변경 후 Netlify Functions 재배포가 필요합니다.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            기존 업로드된 이미지는 영향받지 않으며, 새로 업로드되는 이미지부터 적용됩니다.
          </p>
        </div>
      </div>

      <style>{`
        .slider-container {
          margin: 16px 0;
        }

        .slider-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-weight: 500;
        }

        .slider-value {
          color: var(--primary-color);
          font-weight: 600;
        }

        .slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #ddd;
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: none;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        .size-info, .storage-estimate {
          background: var(--background);
          padding: 12px;
          border-radius: 8px;
          margin-top: 12px;
        }

        .size-info p, .storage-estimate p {
          font-weight: 600;
          margin-bottom: 8px;
        }

        .size-info ul, .storage-estimate ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .size-info li, .storage-estimate li {
          padding: 4px 0;
          font-size: 14px;
          color: var(--text-secondary);
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
