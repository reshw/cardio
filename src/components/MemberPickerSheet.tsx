import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import type { ClubMember } from '../services/clubService';

interface Props {
  title: string;
  members: ClubMember[];
  excludeUserIds?: Set<string>;
  onSelect: (userId: string) => void;
  onClose: () => void;
}

// 모바일에서 카드마다 검색창을 따로 두면 손이 많이 가서, 등록 지점(부클럽장 카드,
// 커스텀 등급 카드)마다 이 시트 하나를 공유해서 연다. 닉네임뿐 아니라 실명(계정
// display_name)으로도 찾을 수 있게 해서, 클럽 닉네임을 못 외워도 찾을 수 있다.
export const MemberPickerSheet = ({ title, members, excludeUserIds, onSelect, onClose }: Props) => {
  useModalHistory(true, onClose);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = members.filter((m) => {
    if (excludeUserIds?.has(m.user_id)) return false;
    if (!q) return true;
    const nickname = (m.club_nickname || '').toLowerCase();
    const realName = (m.user?.display_name || '').toLowerCase();
    return nickname.includes(q) || realName.includes(q);
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
          placeholder="닉네임 또는 실명으로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="member-picker-list">
          {results.length === 0 ? (
            <p className="empty-message">검색 결과가 없습니다.</p>
          ) : (
            results.map((m) => {
              const nickname = m.club_nickname || m.user?.display_name || '회원';
              const showRealName = m.club_nickname && m.user?.display_name && m.club_nickname !== m.user.display_name;
              return (
                <button
                  key={m.user_id}
                  type="button"
                  className="member-picker-item"
                  onClick={() => { onSelect(m.user_id); onClose(); }}
                >
                  {m.club_profile_image || m.user?.profile_image ? (
                    <img src={m.club_profile_image || m.user?.profile_image} alt={nickname} className="participant-avatar" />
                  ) : (
                    <div className="participant-avatar participant-avatar--fallback">{nickname[0]}</div>
                  )}
                  <div className="member-picker-item-text">
                    <span className="member-picker-nickname">{nickname}</span>
                    {showRealName && <span className="member-picker-realname">{m.user!.display_name}</span>}
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
