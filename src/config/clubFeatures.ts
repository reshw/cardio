// 클럽별 기능 레지스트리 (opt-out) — 계획: docs/plans/club-workout-calendar.md
//
// 기본은 전부 켜짐이고, 운영진이 끈 것만 clubs.disabled_features 에 저장한다.
// "켠 것 목록"(구 enabled_features)으로 두면 기능을 추가할 때마다 기존 클럽에선
// 꺼진 채로 시작해 opt-in 으로 되돌아가므로, 반드시 "끈 것 목록"으로 판정한다.
//
// 새 기능이 생기면 여기 한 줄만 추가한다 (ClubGeneralSettings 의 "기능 관리" 섹션이
// 이 목록을 그대로 순회해서 렌더하므로 UI 쪽은 안 건드려도 됨).

export interface ClubFeature {
  key: string;
  label: string;
  description: string;
}

export const CLUB_FEATURES: ClubFeature[] = [
  {
    key: 'calendar',
    label: '행사 기능',
    description: '클럽달력에 행사 일정을 등록하고 사진으로 기록해요',
  },
];

/** 기능이 켜져 있는지. 끈 목록에 없으면 켜진 것이다. */
export const isClubFeatureOn = (
  club: { disabled_features?: string[] | null } | null | undefined,
  key: string
): boolean => !(club?.disabled_features ?? []).includes(key);
