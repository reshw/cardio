import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import relayService from '../services/relayService';
import type { RelayChallenge } from '../services/relayService';
import { RELAY_COURSES } from '../data/relayCourses';
import type { RelayLegRecord } from '../services/relayService';
import '../pages/ClubRelay.css';

// 클럽 화면의 이어달리기 진입 카드. 진행 중이면 모두에게, 아직 없으면 운영진에게만 보인다.
export const RelayEntryCard = ({ clubId, isManager }: { clubId: string; isManager: boolean }) => {
  const navigate = useNavigate();
  const [relay, setRelay] = useState<RelayChallenge | null | undefined>(undefined);
  const [legs, setLegs] = useState<RelayLegRecord[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await relayService.getCurrentRelay(clubId);
        const legs = r ? await relayService.getLegs(r) : [];
        if (!alive) return;
        setRelay(r);
        setLegs(legs);
      } catch (err: any) {
        // 카드는 부가 요소라 실패해도 클럽 화면을 막지 않는다 (원인은 서비스에서 로그)
        console.error('[이어달리기] 진입 카드 로드 실패:', err?.message || JSON.stringify(err));
        if (alive) setRelay(null);
      }
    })();
    return () => { alive = false; };
  }, [clubId]);

  if (relay === undefined) return null;
  // 중단된 것, 또는 아직 없는데 운영진이 아니면 숨김
  if (!relay && !isManager) return null;

  const go = () => navigate(`/club/relay/${clubId}`);

  if (!relay) {
    return (
      <button type="button" className="relay-entry" onClick={go}>
        <span className="relay-entry-emoji" aria-hidden>🏃</span>
        <span className="relay-entry-text">
          <strong>서울 → 부산 이어달리기</strong>
          <small>운영진 전용 · 눌러서 클럽 이어달리기를 시작하세요</small>
        </span>
        <ChevronRight size={18} />
      </button>
    );
  }

  const course = RELAY_COURSES[relay.course_key];
  if (!course) return null;
  const total = relay.total_km;
  const done = Math.min(total, legs.reduce((s, l) => s + l.km, 0));
  const baton = legs.length ? legs[legs.length - 1].end_name : relay.start_name;
  const sub = relay.status === 'finished'
    ? '🏁 부산 도착! 완주 기록 보기'
    : `📍 ${baton} · 부산까지 ${Math.round(total - done)}km`;

  return (
    <button type="button" className="relay-entry" onClick={go}>
      <span className="relay-entry-emoji" aria-hidden>🏃</span>
      <span className="relay-entry-text">
        <strong>{relay.title}</strong>
        <span className="relay-progress"><span style={{ width: `${(done / total) * 100}%` }} /></span>
        <small>{sub}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
};
