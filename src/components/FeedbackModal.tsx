import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useModalHistory } from '../hooks/useModalHistory';

interface Props {
  onClose: () => void;
}

const CATEGORIES = [
  { key: 'bug',     label: '🐛 버그 제보' },
  { key: 'request', label: '✏️ 수정 요청' },
  { key: 'cheer',   label: '💬 응원의 한마디' },
];

export const FeedbackModal = ({ onClose }: Props) => {
  useModalHistory(true, onClose);
  const { user } = useAuth();
  const [category, setCategory] = useState('bug');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!user?.id || user?.isGuest) return;
    // phone_number 는 컬럼 권한으로 차단돼 있어 직접 select 하면 permission denied.
    // 본인 정보는 RPC 로 받는다. (docs/plans/rls-hardening.md §3-3)
    supabase
      .rpc('get_my_account')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[피드백] 본인 연락처 조회 실패 상세:', JSON.stringify(error), error);
          return;
        }
        const phone = (data as { phone_number?: string } | null)?.phone_number;
        if (phone) setPhoneNumber(phone);
      });
  }, [user?.id, user?.isGuest]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const selectedLabel = CATEGORIES.find((c) => c.key === category)?.label ?? category;
      const { error } = await supabase.functions.invoke('send-feedback', {
        body: {
          title: `[${selectedLabel}] ${title.trim()}`,
          content: content.trim(),
          senderName: user?.display_name || '',
          senderEmail: user?.email || '',
          senderPhone: phoneNumber || '',
        },
      });
      if (error) throw error;
      alert('전송되었습니다. 감사합니다!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet" onClick={(e) => e.stopPropagation()}>
        {/* 핸들 */}
        <div className="feedback-handle" />

        {/* 헤더 */}
        <div className="feedback-sheet-header">
          <div>
            <div className="feedback-sheet-title">피드백 보내기</div>
            <div className="feedback-sheet-sub">의견이 앱 개선에 바로 반영됩니다</div>
          </div>
          <button className="feedback-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* 카테고리 칩 */}
        <div className="feedback-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`feedback-chip ${category === c.key ? 'active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 입력 영역 */}
        <div className="feedback-fields">
          <div className="feedback-input-wrap">
            <input
              className="feedback-input"
              type="text"
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="feedback-input-wrap">
            <textarea
              className="feedback-textarea"
              placeholder="어떤 점이 불편하셨나요? 자세히 적어주실수록 빠르게 반영됩니다."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        {/* 전송 버튼 */}
        <button
          className="feedback-submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim()}
        >
          {submitting ? '전송 중...' : '전송하기'}
        </button>
      </div>
    </div>
  );
};
