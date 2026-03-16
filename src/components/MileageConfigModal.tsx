import { X } from 'lucide-react';
import type { MileageConfig } from '../services/clubService';

interface Props {
  config: MileageConfig;
  onClose: () => void;
}

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
          <p className="form-hint" style={{ marginBottom: '16px' }}>
            현재 클럽의 운동별 마일리지 계산 계수입니다.
          </p>

          <div className="config-list">
            <div className="config-item">
              <span className="config-label">달리기 - 트레드밀</span>
              <span className="config-value">{config['달리기-트레드밀']}</span>
            </div>
            <div className="config-item">
              <span className="config-label">달리기 - 러닝</span>
              <span className="config-value">{config['달리기-러닝']}</span>
            </div>
            <div className="config-item">
              <span className="config-label">사이클 - 실외</span>
              <span className="config-value">{config['사이클-실외']}</span>
            </div>
            <div className="config-item">
              <span className="config-label">사이클 - 실내</span>
              <span className="config-value">{config['사이클-실내']}</span>
            </div>
            <div className="config-item">
              <span className="config-label">수영</span>
              <span className="config-value">{config['수영']}</span>
            </div>
            <div className="config-item">
              <span className="config-label">계단</span>
              <span className="config-value">{config['계단']}</span>
            </div>
          </div>

          <p className="form-hint" style={{ marginTop: '16px' }}>
            💡 예시: 계수 0.33은 거리의 33%가 마일리지로 계산됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};
