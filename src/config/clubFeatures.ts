// 클럽별 opt-in 기능 레지스트리 — 계획: docs/plans/클럽-탭-optin.md
// 새 opt-in 기능이 생기면 여기 한 줄만 추가한다 (ClubGeneralSettings의 "탭 관리" 섹션이
// 이 목록을 그대로 순회해서 렌더하므로 UI 쪽은 안 건드려도 됨).

export interface OptionalClubFeature {
  key: string;
  label: string;
  description: string;
}

export const OPTIONAL_CLUB_FEATURES: OptionalClubFeature[] = [
  {
    key: 'calendar',
    label: '클럽달력',
    description: '행사 일정을 등록하고 사진으로 기록해요',
  },
];
