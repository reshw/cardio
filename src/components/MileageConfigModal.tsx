import { X } from 'lucide-react';
import type { MileageConfig } from '../services/clubService';

interface Props {
  config: MileageConfig;
  onClose: () => void;
}

// 마일리지 계산 예시 생성 (나눗셈 방식)
const getExplanation = (coefficient: number, unit: string = 'km'): string => {
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
  }

  return '';
};

export const MileageConfigModal = ({ config, onClose }: Props) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>마일리지 계수 설정</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <p className="form-hint" style={{ marginBottom: '20px' }}>
            현재 클럽의 운동별 마일리지 계산 방식입니다.
          </p>

          <div className="mileage-explanation-list">
            <div className="mileage-explanation-item">
              <div className="mileage-explanation-header">
                <span className="mileage-explanation-emoji">🏃</span>
                <span className="mileage-explanation-label">달리기 - 트레드밀</span>
              </div>
              <div className="mileage-explanation-detail">
                <span className="mileage-explanation-example">
                  {getExplanation(config['달리기-트레드밀'], 'km')}
                </span>
                <span className="mileage-explanation-coefficient">계수: {config['달리기-트레드밀']}</span>
              </div>
            </div>

            <div className="mileage-explanation-item">
              <div className="mileage-explanation-header">
                <span className="mileage-explanation-emoji">🏃‍♂️</span>
                <span className="mileage-explanation-label">달리기 - 러닝</span>
              </div>
              <div className="mileage-explanation-detail">
                <span className="mileage-explanation-example">
                  {getExplanation(config['달리기-러닝'], 'km')}
                </span>
                <span className="mileage-explanation-coefficient">계수: {config['달리기-러닝']}</span>
              </div>
            </div>

            <div className="mileage-explanation-item">
              <div className="mileage-explanation-header">
                <span className="mileage-explanation-emoji">🚴</span>
                <span className="mileage-explanation-label">사이클 - 실외</span>
              </div>
              <div className="mileage-explanation-detail">
                <span className="mileage-explanation-example">
                  {getExplanation(config['사이클-실외'], 'km')}
                </span>
                <span className="mileage-explanation-coefficient">계수: {config['사이클-실외']}</span>
              </div>
            </div>

            <div className="mileage-explanation-item">
              <div className="mileage-explanation-header">
                <span className="mileage-explanation-emoji">🚴‍♀️</span>
                <span className="mileage-explanation-label">사이클 - 실내</span>
              </div>
              <div className="mileage-explanation-detail">
                <span className="mileage-explanation-example">
                  {getExplanation(config['사이클-실내'], 'km')}
                </span>
                <span className="mileage-explanation-coefficient">계수: {config['사이클-실내']}</span>
              </div>
            </div>

            <div className="mileage-explanation-item">
              <div className="mileage-explanation-header">
                <span className="mileage-explanation-emoji">🏊</span>
                <span className="mileage-explanation-label">수영</span>
              </div>
              <div className="mileage-explanation-detail">
                <span className="mileage-explanation-example">
                  {getExplanation(config['수영'], 'm')}
                </span>
                <span className="mileage-explanation-coefficient">계수: {config['수영']}</span>
              </div>
            </div>

            <div className="mileage-explanation-item">
              <div className="mileage-explanation-header">
                <span className="mileage-explanation-emoji">🪜</span>
                <span className="mileage-explanation-label">계단</span>
              </div>
              <div className="mileage-explanation-detail">
                <span className="mileage-explanation-example">
                  {getExplanation(config['계단'], '층')}
                </span>
                <span className="mileage-explanation-coefficient">계수: {config['계단']}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
