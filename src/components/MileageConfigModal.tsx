import { X } from 'lucide-react';
import type { MileageConfig } from '../services/clubService';

interface Props {
  config: MileageConfig;
  enabledCategories?: string[];
  onClose: () => void;
}

// 마일리지 계산 예시 생성 (나눗셈 방식)
const getExplanation = (coefficient: number | undefined, unit: string = 'km'): string => {
  if (coefficient === undefined || coefficient === null) return '설정 안됨';
  if (coefficient === 0) return '마일리지 없음';

  // 나눗셈 방식: coefficient 자체가 "X 단위당 1 마일리지"
  if (unit === 'km') {
    if (coefficient === 1) {
      return '1km당 1 마일리지';
    } else if (coefficient < 1) {
      return `${coefficient.toFixed(2)}km당 1 마일리지`;
    } else {
      return `${coefficient.toFixed(1)}km당 1 마일리지`;
    }
  } else if (unit === 'm') {
    return `${Math.round(coefficient)}m당 1 마일리지`;
  } else if (unit === '층') {
    return `${Math.round(coefficient)}층당 1 마일리지`;
  } else if (unit === '분') {
    return `${coefficient.toFixed(2)}분당 1 마일리지`;
  }

  return '';
};

export const MileageConfigModal = ({ config, enabledCategories, onClose }: Props) => {
  // 운동 종목 정의
  const workoutTypes = [
    { key: '달리기-트레드밀', emoji: '🏃', label: '달리기 - 트레드밀', unit: 'km' },
    { key: '달리기-러닝', emoji: '🏃‍♂️', label: '달리기 - 러닝', unit: 'km' },
    { key: '사이클-실외', emoji: '🚴', label: '사이클 - 실외', unit: 'km' },
    { key: '사이클-실내', emoji: '🚴‍♀️', label: '사이클 - 실내', unit: 'km' },
    { key: '수영', emoji: '🏊', label: '수영', unit: 'm' },
    { key: '계단', emoji: '🪜', label: '계단', unit: '층' },
    { key: '복싱-샌드백/미트', emoji: '🥊', label: '복싱 - 샌드백/미트', unit: '분' },
    { key: '복싱-스파링', emoji: '🥊', label: '복싱 - 스파링', unit: '분' },
    { key: '요가-일반', emoji: '🧘', label: '요가 - 일반', unit: '분' },
    { key: '요가-빈야사/아쉬탕가', emoji: '🧘', label: '요가 - 빈야사/아쉬탕가', unit: '분' },
  ];

  // 활성화된 운동 종목만 필터링
  const filteredWorkouts = enabledCategories
    ? workoutTypes.filter(w => enabledCategories.includes(w.key))
    : workoutTypes;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mileage-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>마일리지 계수</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <p className="mileage-config-description">
            운동별 마일리지 계산 방식
          </p>

          <div className="mileage-config-list">
            {filteredWorkouts.map((workout) => (
              <div key={workout.key} className="mileage-config-item">
                <div className="mileage-config-header">
                  <span className="mileage-config-emoji">{workout.emoji}</span>
                  <span className="mileage-config-label">{workout.label}</span>
                </div>
                <div className="mileage-config-value">
                  <div className="mileage-config-example">
                    {getExplanation(config[workout.key], workout.unit as 'km' | 'm' | '층' | '분')}
                  </div>
                  <div className="mileage-config-coefficient">
                    계수 {config[workout.key] ?? '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredWorkouts.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p>활성화된 운동 종목이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
