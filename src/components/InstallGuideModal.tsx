import { useState, useEffect } from 'react';
import { Smartphone, Share2, MoreVertical, Plus } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const InstallGuideModal = ({ onClose }: Props) => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('other');
    }
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content install-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📱 앱 설치 안내</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {platform === 'ios' && (
            <div className="install-guide-content">
              <div className="guide-section">
                <h3>🍎 iOS (아이폰/아이패드)</h3>
                <p className="guide-intro">
                  카카오톡 링크로 들어오셨나요?<br />
                  아래 단계를 따라 홈 화면에 앱을 추가하세요.
                </p>

                <div className="guide-steps">
                  <div className="guide-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <Share2 size={24} />
                      </div>
                      <div className="step-text">
                        <strong>우측 하단 공유 버튼 클릭</strong>
                        <p>그릇 모양에 위 화살표(↑) 아이콘</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <Smartphone size={24} />
                      </div>
                      <div className="step-text">
                        <strong>"Safari로 열기" 선택</strong>
                        <p>메뉴에서 Safari 브라우저 선택</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <Share2 size={24} />
                      </div>
                      <div className="step-text">
                        <strong>Safari 하단 공유 버튼 클릭</strong>
                        <p>Safari 하단 중앙의 공유 아이콘</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <Plus size={24} />
                      </div>
                      <div className="step-text">
                        <strong>"홈 화면에 추가" 선택</strong>
                        <p>앱 아이콘이 바탕화면에 추가됩니다</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {platform === 'android' && (
            <div className="install-guide-content">
              <div className="guide-section">
                <h3>🤖 Android (안드로이드)</h3>
                <p className="guide-intro">
                  아래 단계를 따라 홈 화면에 앱을 추가하세요.
                </p>

                <div className="guide-steps">
                  <div className="guide-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <MoreVertical size={24} />
                      </div>
                      <div className="step-text">
                        <strong>브라우저 메뉴 열기</strong>
                        <p>우측 상단 점 3개(⋮) 또는 메뉴 버튼</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <Plus size={24} />
                      </div>
                      <div className="step-text">
                        <strong>"홈 화면에 추가" 선택</strong>
                        <p>또는 "바탕화면에 추가"</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <div className="step-icon">
                        <Smartphone size={24} />
                      </div>
                      <div className="step-text">
                        <strong>확인 버튼 클릭</strong>
                        <p>앱 아이콘이 홈 화면에 추가됩니다</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {platform === 'other' && (
            <div className="install-guide-content">
              <div className="guide-section">
                <h3>💻 데스크톱 / 기타</h3>
                <p className="guide-intro">
                  모바일 기기에서 접속하시면<br />
                  홈 화면 추가 기능을 사용할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          <div className="guide-footer">
            <p className="guide-note">
              💡 홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있습니다!
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button className="primary-button" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
