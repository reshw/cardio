import { useCallback, useEffect, useState } from 'react';
import clubGradeService, { type GradeMap, type MemberGrade } from '../services/clubGradeService';

/** 클럽 회원 등급 맵. gradeOf(userId) → 배지가 없으면 null */
export function useClubGrades(clubId: string | null | undefined) {
  const [map, setMap] = useState<GradeMap>(() => new Map());

  useEffect(() => {
    if (!clubId) {
      setMap(new Map());
      return;
    }
    let alive = true;
    const load = () => {
      clubGradeService
        .getGradeMap(clubId)
        .then((m) => alive && setMap(m))
        .catch((err) => {
          // 배지는 부가 정보라 화면을 막지 않는다 — 원인만 남긴다
          console.error('[등급] 배지 맵 로드 실패:', JSON.stringify(err), err);
        });
    };
    load();
    const unsub = clubGradeService.subscribe((id) => id === clubId && load());
    return () => {
      alive = false;
      unsub();
    };
  }, [clubId]);

  const gradeOf = useCallback((userId: string): MemberGrade | null => map.get(userId) ?? null, [map]);
  return { gradeOf, map };
}
