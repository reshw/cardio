import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { MileageConfig } from '../services/clubService';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType } from '../services/workoutTypeService';

interface Props {
  config: MileageConfig;
  enabledCategories?: string[];
  onClose: () => void;
}

interface WorkoutCategory {
  key: string;
  label: string;
  emoji: string;
  unit: string;
}

const buildCategories = (workoutTypes: WorkoutType[]): WorkoutCategory[] => {
  const categories: WorkoutCategory[] = [];
  for (const type of workoutTypes) {
    if (type.sub_types && type.sub_types.length > 0) {
      for (const subType of type.sub_types) {
        categories.push({
          key: `${type.name}-${subType.name}`,
          label: `${type.name} - ${subType.name}`,
          emoji: type.emoji,
          unit: subType.unit,
        });
      }
    } else {
      categories.push({
        key: type.name,
        label: type.name,
        emoji: type.emoji,
        unit: type.unit,
      });
    }
  }
  return categories;
};

// 마일리지 계산 예시 생성 (나눗셈 방식)
const getExplanation = (coefficient: number | undefined, unit: string = 'km'): string => {
  if (coefficient === undefined || coefficient === null) return '설정 안됨';
  if (coefficient === 0) return '마일리지 없음';

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
  const [allCategories, setAllCategories] = useState<WorkoutCategory[]>([]);

  useEffect(() => {
    workoutTypeService.getActiveWorkoutTypes().then((types) => {
      setAllCategories(buildCategories(types));
    });
  }, []);

  const filteredCategories = enabledCategories
    ? allCategories.filter(c => enabledCategories.includes(c.key))
    : allCategories;

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
            {filteredCategories.map((category) => (
              <div key={category.key} className="mileage-config-item">
                <div className="mileage-config-header">
                  <span className="mileage-config-emoji">{category.emoji}</span>
                  <span className="mileage-config-label">{category.label}</span>
                </div>
                <div className="mileage-config-value">
                  <div className="mileage-config-example">
                    {getExplanation((config as any)[category.key], category.unit as 'km' | 'm' | '층' | '분')}
                  </div>
                  <div className="mileage-config-coefficient">
                    계수 {(config as any)[category.key] ?? '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p>활성화된 운동 종목이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
