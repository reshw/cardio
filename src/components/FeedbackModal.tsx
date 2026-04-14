import { useState, useRef, useMemo, useEffect } from 'react';
import JoditEditor from 'jodit-react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

export const FeedbackModal = ({ onClose }: Props) => {
  const { user } = useAuth();
  const editor = useRef(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('phone_number')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.phone_number) setPhoneNumber(data.phone_number);
      });
  }, [user?.id]);

  const joditConfig = useMemo(
    () => ({
      readonly: false,
      placeholder: '내용을 입력하세요...',
      height: 320,
      toolbarButtonSize: 'small' as const,
      buttons: [
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'ul', 'ol', '|',
        'outdent', 'indent', '|',
        'fontsize', '|',
        'brush', '|',
        'link', '|',
        'undo', 'redo',
      ],
      toolbarAdaptive: false,
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: 'insert_clear_html' as const,
      style: {
        fontSize: '15px',
        lineHeight: '1.6',
      },
    }),
    []
  );

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('send-feedback', {
        body: {
          title: title.trim(),
          content,
          senderName: user?.display_name || '',
          senderEmail: user?.email || '',
          senderPhone: phoneNumber || '',
        },
      });

      if (error) throw error;

      alert('피드백이 전송되었습니다. 감사합니다!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content feedback-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>피드백 보내기</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="feedback-modal-body">
          <div className="feedback-field">
            <label className="input-label">제목</label>
            <input
              type="text"
              className="input-field"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="feedback-field">
            <label className="input-label">내용</label>
            <div className="feedback-editor-wrapper">
              <JoditEditor
                ref={editor}
                value={content}
                config={joditConfig}
                onBlur={(val) => setContent(val)}
              />
            </div>
          </div>
          <button
            className="primary-button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? '전송 중...' : '전송하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
