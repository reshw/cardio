/**
 * Challenge Wizard - Quest Builder
 * 3-Step 챌린지 생성 마법사
 */

import { useState } from 'react';
import type {
  QuestTheme,
  ChallengeRules,
  MetricType,
  CreateChallengeDTO,
  ChallengeTemplate,
} from '../../types/challenge';
import { CHALLENGE_TEMPLATES, REFERENCE_GUIDES } from '../../types/challenge';
import type { WorkoutCategory, WorkoutType } from '../../types';
import * as clubStorage from '../../storage/clubStorage';

interface ChallengeWizardProps {
  clubId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 1 | 2 | 3;

export const ChallengeWizard = ({ clubId, onClose, onSuccess }: ChallengeWizardProps) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Quest Theme 선택
  const [theme, setTheme] = useState<QuestTheme | null>(null);

  // Step 2: Rules 설정
  const [rules, setRules] = useState<ChallengeRules>({
    target_metric: 'volume_kg',
    filter: {},
    aggregation: 'sum',
    goal_value: 0,
    unit: 'kg',
  });

  // Step 3: 메타데이터
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [themeColor, setThemeColor] = useState('#8b5cf6');

  // 템플릿 적용
  const applyTemplate = (template: ChallengeTemplate) => {
    setTheme(template.theme);
    setRules(template.rules);
    setTitle(template.name);
    setDescription(template.description);
    setThemeColor(getThemeColor(template.theme));

    // 권장 기간 설정
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + template.recommended_duration_days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);

    setStep(3); // 바로 Step 3로 이동
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      alert('챌린지 제목을 입력해주세요.');
      return;
    }
    if (rules.goal_value <= 0) {
      alert('목표 값을 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      alert('시작일과 종료일을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const dto: CreateChallengeDTO = {
        club_id: clubId,
        title: title.trim(),
        description: description.trim() || undefined,
        rules,
        start_date: startDate,
        end_date: endDate,
        theme_color: themeColor,
      };

      await clubStorage.createChallenge(dto);
      alert('챌린지가 생성되었습니다!');
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : '챌린지 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg)',
          borderRadius: '16px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              🎯 Quest Builder
            </h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: step === 1 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                1. 테마 선택
              </span>
              <span style={{ color: step === 2 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                2. 규칙 설정
              </span>
              <span style={{ color: step === 3 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                3. 꾸미기
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: '24px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {step === 1 && (
            <Step1ThemeSelect
              selectedTheme={theme}
              onSelectTheme={(t) => {
                setTheme(t);
                setStep(2);
              }}
              onApplyTemplate={applyTemplate}
            />
          )}

          {step === 2 && theme && (
            <Step2RulesConfig
              theme={theme}
              rules={rules}
              onUpdateRules={setRules}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <Step3MetaData
              title={title}
              description={description}
              startDate={startDate}
              endDate={endDate}
              themeColor={themeColor}
              rules={rules}
              onUpdateTitle={setTitle}
              onUpdateDescription={setDescription}
              onUpdateStartDate={setStartDate}
              onUpdateEndDate={setEndDate}
              onUpdateThemeColor={setThemeColor}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Step 1: Theme Selection
// ============================================

interface Step1Props {
  selectedTheme: QuestTheme | null;
  onSelectTheme: (theme: QuestTheme) => void;
  onApplyTemplate: (template: ChallengeTemplate) => void;
}

const Step1ThemeSelect = ({ selectedTheme, onSelectTheme, onApplyTemplate }: Step1Props) => {
  const themes: Array<{ id: QuestTheme; name: string; emoji: string; color: string; desc: string }> = [
    { id: 'strength', name: '근력', emoji: '💪', color: '#ef4444', desc: '더 무겁게!' },
    { id: 'endurance', name: '지구력', emoji: '🏃', color: '#3b82f6', desc: '더 멀리, 더 오래!' },
    { id: 'skill', name: '기술/횟수', emoji: '🏂', color: '#8b5cf6', desc: '더 많이!' },
    { id: 'consistency', name: '꾸준함', emoji: '📅', color: '#eab308', desc: '빠지지 않고!' },
  ];

  return (
    <div>
      <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
        무엇으로 승부할까요?
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        챌린지 테마를 선택하세요. 또는 아래 인기 템플릿을 바로 적용할 수 있습니다.
      </p>

      {/* Theme Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {themes.map((t) => (
          <div
            key={t.id}
            onClick={() => onSelectTheme(t.id)}
            style={{
              background: selectedTheme === t.id ? `${t.color}22` : 'var(--input-bg)',
              border: `2px solid ${selectedTheme === t.id ? t.color : 'var(--border-color)'}`,
              borderRadius: '12px',
              padding: '20px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{t.emoji}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{t.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Template Quick Apply */}
      <div style={{ marginTop: '32px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          ⚡ 인기 템플릿 (바로 적용)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {CHALLENGE_TEMPLATES.map((template) => (
            <div
              key={template.id}
              onClick={() => onApplyTemplate(template)}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <div style={{ fontSize: '32px' }}>{template.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                  {template.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {template.description}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                권장 {template.recommended_duration_days}일
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Step 2: Rules Configuration
// ============================================

interface Step2Props {
  theme: QuestTheme;
  rules: ChallengeRules;
  onUpdateRules: (rules: ChallengeRules) => void;
  onNext: () => void;
  onBack: () => void;
}

const Step2RulesConfig = ({ theme, rules, onUpdateRules, onNext, onBack }: Step2Props) => {
  const updateFilter = (key: keyof ChallengeRules['filter'], value: any) => {
    onUpdateRules({
      ...rules,
      filter: { ...rules.filter, [key]: value },
    });
  };

  const getMetricOptions = (): Array<{ value: MetricType; label: string; unit: string }> => {
    switch (theme) {
      case 'strength':
        return [{ value: 'volume_kg', label: '볼륨 (무게 × 세트 × 횟수)', unit: 'kg' }];
      case 'endurance':
        return [
          { value: 'adjusted_dist_km', label: '거리 (평지 환산)', unit: 'km' },
          { value: 'duration_min', label: '시간', unit: '분' },
        ];
      case 'skill':
        return [
          { value: 'run_count', label: '런 수 / 시도 횟수', unit: '회' },
          { value: 'workout_count', label: '운동 횟수', unit: '회' },
        ];
      case 'consistency':
        return [{ value: 'attendance_days', label: '출석 일수', unit: '일' }];
    }
  };

  const categoryOptions: Array<{ value: WorkoutCategory; label: string; emoji: string }> = [
    { value: 'gym', label: '헬스장', emoji: '🏋️' },
    { value: 'running', label: '러닝', emoji: '🏃' },
    { value: 'snowboard', label: '스노보드', emoji: '🏂' },
    { value: 'sports', label: '구기/라켓', emoji: '⚽' },
    { value: 'home', label: '홈트', emoji: '🏠' },
    { value: 'other', label: '기타', emoji: '💪' },
  ];

  const typeOptions: Array<{ value: WorkoutType; label: string }> = [
    { value: 'strength', label: '근력' },
    { value: 'cardio', label: '유산소' },
    { value: 'skill', label: '기술' },
    { value: 'flexibility', label: '유연성' },
  ];

  const selectedMetric = getMetricOptions().find((m) => m.value === rules.target_metric) || getMetricOptions()[0];

  const handleMetricChange = (metric: MetricType) => {
    const option = getMetricOptions().find((m) => m.value === metric);
    onUpdateRules({
      ...rules,
      target_metric: metric,
      unit: option?.unit || '',
    });
  };

  const referenceGuides = REFERENCE_GUIDES[rules.target_metric] || [];

  return (
    <div>
      <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px' }}>
        상세 규칙 설정
      </h3>

      {/* Metric Type */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
          추적 지표 *
        </label>
        <select
          value={rules.target_metric}
          onChange={(e) => handleMetricChange(e.target.value as MetricType)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            background: 'var(--input-bg)',
          }}
        >
          {getMetricOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category Filter */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
          종목 필터 (선택 안하면 전체)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {categoryOptions.map((cat) => {
            const isSelected = rules.filter.category?.includes(cat.value);
            return (
              <div
                key={cat.value}
                onClick={() => {
                  const current = rules.filter.category || [];
                  const updated = isSelected
                    ? current.filter((c) => c !== cat.value)
                    : [...current, cat.value];
                  updateFilter('category', updated.length > 0 ? updated : undefined);
                }}
                style={{
                  padding: '8px 16px',
                  border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--primary-color)22' : 'transparent',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Type Filter */}
      {rules.target_metric !== 'attendance_days' && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            운동 타입 필터 (선택 안하면 전체)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {typeOptions.map((type) => {
              const isSelected = rules.filter.type?.includes(type.value);
              return (
                <div
                  key={type.value}
                  onClick={() => {
                    const current = rules.filter.type || [];
                    const updated = isSelected
                      ? current.filter((t) => t !== type.value)
                      : [...current, type.value];
                    updateFilter('type', updated.length > 0 ? updated : undefined);
                  }}
                  style={{
                    padding: '8px 16px',
                    border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    borderRadius: '20px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-color)22' : 'transparent',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                >
                  {type.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Keyword Filter */}
      {rules.target_metric !== 'attendance_days' && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            키워드 필터 (고급) - 운동 이름에 포함되어야 하는 단어
          </label>
          <input
            type="text"
            placeholder="예: squat, 스쿼트 (쉼표로 구분)"
            value={rules.filter.keyword_include?.join(', ') || ''}
            onChange={(e) => {
              const keywords = e.target.value
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean);
              updateFilter('keyword_include', keywords.length > 0 ? keywords : undefined);
            }}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
        </div>
      )}

      {/* Goal Value */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
          목표 수치 *
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              value={rules.goal_value || ''}
              onChange={(e) => onUpdateRules({ ...rules, goal_value: Number(e.target.value) })}
              placeholder="목표 값을 입력하세요"
              min="1"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--input-bg)',
              }}
            />
          </div>
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              minWidth: '60px',
              textAlign: 'center',
            }}
          >
            {selectedMetric.unit}
          </div>
        </div>

        {/* Reference Guide */}
        {rules.goal_value > 0 && referenceGuides.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: '8px', fontWeight: '600' }}>💡 참고:</div>
            {referenceGuides.map((guide) => (
              <div
                key={guide.value}
                style={{
                  padding: '8px 12px',
                  background: 'var(--input-bg)',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{guide.emoji}</span>
                <span>
                  {guide.value.toLocaleString()} {selectedMetric.unit} = {guide.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
        <button className="cancel-button" onClick={onBack} style={{ flex: 1 }}>
          ← 이전
        </button>
        <button
          className="primary-button"
          onClick={onNext}
          disabled={rules.goal_value <= 0}
          style={{ flex: 1 }}
        >
          다음 →
        </button>
      </div>
    </div>
  );
};

// ============================================
// Step 3: Meta Data & Preview
// ============================================

interface Step3Props {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  themeColor: string;
  rules: ChallengeRules;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (desc: string) => void;
  onUpdateStartDate: (date: string) => void;
  onUpdateEndDate: (date: string) => void;
  onUpdateThemeColor: (color: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

const Step3MetaData = ({
  title,
  description,
  startDate,
  endDate,
  themeColor,
  rules,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateStartDate,
  onUpdateEndDate,
  onUpdateThemeColor,
  onBack,
  onSubmit,
  loading,
}: Step3Props) => {
  const themeColors = [
    { value: '#ef4444', label: 'Fire' },
    { value: '#3b82f6', label: 'Ocean' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#eab308', label: 'Gold' },
    { value: '#10b981', label: 'Forest' },
    { value: '#1e293b', label: 'Dark' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Left: Form */}
      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px' }}>
          챌린지 꾸미기
        </h3>

        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            제목 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder="예: 스쿼트 100톤 챌린지"
            maxLength={50}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            placeholder="참여 독려 멘트를 작성하세요"
            rows={3}
            maxLength={200}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
              시작일 *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onUpdateStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--input-bg)',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
              종료일 *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onUpdateEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--input-bg)',
              }}
            />
          </div>
        </div>

        {/* Theme Color */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            테마 색상
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {themeColors.map((color) => (
              <div
                key={color.value}
                onClick={() => onUpdateThemeColor(color.value)}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  background: color.value,
                  cursor: 'pointer',
                  border: themeColor === color.value ? '3px solid white' : '2px solid var(--border-color)',
                  boxShadow: themeColor === color.value ? '0 0 0 2px var(--primary-color)' : 'none',
                  transition: 'all 0.2s',
                }}
                title={color.label}
              />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          <button className="cancel-button" onClick={onBack} style={{ flex: 1 }}>
            ← 이전
          </button>
          <button
            className="primary-button"
            onClick={onSubmit}
            disabled={loading || !title.trim() || !startDate || !endDate}
            style={{ flex: 1 }}
          >
            {loading ? '생성 중...' : '챌린지 만들기 🎯'}
          </button>
        </div>
      </div>

      {/* Right: Live Preview */}
      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px' }}>
          미리보기
        </h3>
        <ChallengeCardPreview
          title={title || '챌린지 제목'}
          description={description || '설명을 입력하세요'}
          rules={rules}
          startDate={startDate}
          endDate={endDate}
          themeColor={themeColor}
        />
      </div>
    </div>
  );
};

// ============================================
// Challenge Card Preview
// ============================================

interface PreviewProps {
  title: string;
  description: string;
  rules: ChallengeRules;
  startDate: string;
  endDate: string;
  themeColor: string;
}

const ChallengeCardPreview = ({
  title,
  description,
  rules,
  startDate,
  endDate,
  themeColor,
}: PreviewProps) => {
  const currentValue = Math.floor(rules.goal_value * 0.35); // 임시 진행도 35%
  const progress = (currentValue / rules.goal_value) * 100;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${themeColor}22 0%, ${themeColor}11 100%)`,
        border: `2px solid ${themeColor}66`,
        borderRadius: '12px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>{title}</h4>
      {description && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {description}
        </p>
      )}

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '28px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '14px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            width: `${Math.min(progress, 100)}%`,
            height: '100%',
            background: themeColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '12px',
            fontSize: '12px',
            fontWeight: '700',
            color: 'white',
          }}
        >
          {progress.toFixed(0)}%
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '20px', fontWeight: '700', color: themeColor }}>
            {currentValue.toLocaleString()}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}> / {rules.goal_value.toLocaleString()}</span>
          <span style={{ marginLeft: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {rules.unit}
          </span>
        </div>
      </div>

      {/* Date */}
      {startDate && endDate && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {startDate} ~ {endDate}
        </div>
      )}

      {/* Rules Summary */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      >
        <div style={{ fontWeight: '600', marginBottom: '6px' }}>📋 규칙:</div>
        <div style={{ color: 'var(--text-secondary)' }}>
          {rules.filter.category && rules.filter.category.length > 0 && (
            <div>• 종목: {rules.filter.category.join(', ')}</div>
          )}
          {rules.filter.type && rules.filter.type.length > 0 && (
            <div>• 타입: {rules.filter.type.join(', ')}</div>
          )}
          {rules.filter.keyword_include && rules.filter.keyword_include.length > 0 && (
            <div>• 키워드: {rules.filter.keyword_include.join(', ')}</div>
          )}
          {!rules.filter.category && !rules.filter.type && !rules.filter.keyword_include && (
            <div>• 모든 운동 인정</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper: Get theme color by quest theme
const getThemeColor = (theme: QuestTheme): string => {
  switch (theme) {
    case 'strength':
      return '#ef4444';
    case 'endurance':
      return '#3b82f6';
    case 'skill':
      return '#8b5cf6';
    case 'consistency':
      return '#eab308';
  }
};
