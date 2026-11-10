import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import type { ClubMember } from '../services/clubService';

interface Props {
  title: string;
  members: ClubMember[];
  excludeUserIds?: Set<string>;
  /** 이름 옆에 붙일 보조 문구 (예: 시상 관리의 "1위 · 56.0점"). 없으면 생략 */
  metaByUserId?: Record<string, string>;
  onSelect: (userId: string) => void;
  onClose: () => void;
}

// 모바일에서 카드마다 검색창을 따로 두면 손이 많이 가서, 등록 지점(부클럽장 카드,
// 커스텀 등급 카드, 클럽달력 사람 필터, 시상 관리)마다 이 시트 하나를 공유해서 연다.
//
// ⚠️ 클럽 닉네임만 표시·검색한다. 본명(users.display_name, 카카오 실명)은 절대 쓰지 않는다.
// 예전엔 실명도 함께 보여주고 실명으로도 검색되게 했는데, 클럽달력처럼 일반 멤버가 여는
// 화면에서 "야시 = 양승일" 같은 닉네임-본명 매핑이 그대로 드러났다. 화면에 안 보여도
// 본명으로 검색이 걸리면 같은 정보가 새므로 검색 대상에서도 뺐다.
export const MemberPickerSheet = ({ title, members, excludeUserIds, metaByUserId, onSelect, onClose }: Props) => {
  useModalHistory(true, onClose);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = members.filter((m) => {
    if (excludeUserIds?.has(m.user_id)) return false;
    if (!q) return true;
    return (m.club_nickname || '').toLowerCase().includes(q);
  });

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet member-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{title}</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <input
          className="search-input"
          placeholder="닉네임으로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="member-picker-list">
          {results.length === 0 ? (
            <p className="empty-message">검색 결과가 없습니다.</p>
          ) : (
            results.map((m) => {
              // 닉네임이 없어도 본명으로 대체하지 않는다
              const nickname = m.club_nickname || '(닉네임 없음)';
              return (
                <button
                  key={m.user_id}
                  type="button"
                  className="member-picker-item"
                  onClick={() => { onSelect(m.user_id); onClose(); }}
                >
                  {(() => {
                    const img = m.club_profile_image || m.user?.profile_image;
                    // 'default:<색상>' 은 URL 이 아니라 색상 아바타 표기다 (WorkoutFeedCard 와 같은 규칙).
                    // 예전엔 이걸 그대로 <img src> 에 넣어 ERR_UNKNOWN_URL_SCHEME 로 깨졌다.
                    if (img?.startsWith('default:')) {
                      return (
                        <div
                          className="participant-avatar participant-avatar--fallback"
                          style={{ background: img.slice('default:'.length), color: 'white' }}
                        >
                          {nickname[0]}
                        </div>
                      );
                    }
                    return img ? (
                      <img src={img} alt={nickname} className="participant-avatar" />
                    ) : (
                      <div className="participant-avatar participant-avatar--fallback">{nickname[0]}</div>
                    );
                  })()}
                  <div className="member-picker-item-text">
                    <span className="member-picker-nickname">{nickname}</span>
                    {metaByUserId?.[m.user_id] && (
                      <span className="member-picker-realname">{metaByUserId[m.user_id]}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
