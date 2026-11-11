import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Flag, Lock, Check } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import relayService from '../services/relayService';
import type { RelayChallenge, RelayLegRecord } from '../services/relayService';
import clubService from '../services/clubService';
import { RELAY_COURSES, DEFAULT_RELAY_COURSE, getRelayLegs } from '../data/relayCourses';
import type { RelayCourse, RelayLeg, RelayPoint } from '../data/relayCourses';
import { RelayCompleteSheet } from '../components/RelayCompleteSheet';
import './ClubRelay.css';

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** 위경도 → SVG 좌표 (등장방형 + 위도 보정). 코스 전체가 viewBox 에 꽉 차게 */
function useProjection(course: RelayCourse, w: number, h: number, pad: number) {
  return useMemo(() => {
    const lats = course.points.map((p) => p.lat);
    const lngs = course.points.map((p) => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const minX = Math.min(...lngs) * k, maxX = Math.max(...lngs) * k;
    const minY = Math.min(...lats), maxY = Math.max(...lats);
    const scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    const offX = (w - (maxX - minX) * scale) / 2;
    const offY = (h - (maxY - minY) * scale) / 2;
    return (lat: number, lng: number) => ({
      x: offX + (lng * k - minX) * scale,
      y: offY + (maxY - lat) * scale,
    });
  }, [course, w, h, pad]);
}

/** 이름표를 경로에 수직인 방향으로 비켜서 선과 안 겹치게 둔다 */
function labelPos(pts: { x: number; y: number; label?: RelayPoint['label'] }[], i: number) {
  const p0 = pts[i];
  switch (p0.label) {
    case 'left': return { x: p0.x - 10, y: p0.y + 4, anchor: 'end' as const };
    case 'right': return { x: p0.x + 10, y: p0.y + 4, anchor: 'start' as const };
    case 'below': return { x: p0.x, y: p0.y + 19, anchor: 'middle' as const };
    case 'below-left': return { x: p0.x - 6, y: p0.y + 18, anchor: 'end' as const };
  }
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  const p = pts[i];
  if (Math.abs(nx) > 0.5) {
    // 좌우로 비킬 수 있으면 왼쪽 선호, 단 왼쪽 여백이 없으면 오른쪽
    const wantLeft = p.x > 110;
    if ((nx < 0) !== wantLeft) { nx = -nx; ny = -ny; }
  } else if (ny < 0) { nx = -nx; ny = -ny; } // 가로 구간이면 아래로
  const anchor: 'start' | 'end' | 'middle' = nx > 0.5 ? 'start' : nx < -0.5 ? 'end' : 'middle';
  return { x: p.x + nx * 10, y: p.y + ny * 10 + (ny > 0.5 ? 9 : 4), anchor };
}

const RelayMap = ({ course, doneLegs }: { course: RelayCourse; doneLegs: number }) => {
  const W = 320, H = 400;
  const proj = useProjection(course, W, H, 36);
  const pts = course.points.map((p) => ({ ...p, ...proj(p.lat, p.lng) }));
  const line = (arr: typeof pts) => arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const done = pts.slice(0, doneLegs + 1);
  const rest = pts.slice(doneLegs);
  const baton = pts[Math.min(doneLegs, pts.length - 1)];
  const finished = doneLegs >= pts.length - 1;
  return (
    <svg className="relay-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${course.title} 진행 지도`}>
      <polyline className="relay-map-rest" points={line(rest)} />
      {done.length > 1 && <polyline className="relay-map-done" points={line(done)} />}
      {pts.map((p, i) => (
        <g key={p.name}>
          <circle className={i <= doneLegs ? 'relay-map-dot done' : 'relay-map-dot'} cx={p.x} cy={p.y} r={p.major ? 4.5 : 3} />
          {(p.major || i === doneLegs) && (() => {
            const l = labelPos(pts, i);
            return (
              <text className={`relay-map-label${i === doneLegs ? ' current' : ''}`} x={l.x} y={l.y} textAnchor={l.anchor}>
                {p.name}
              </text>
            );
          })()}
        </g>
      ))}
      {!finished && (
        <g>
          <circle className="relay-map-baton-pulse" cx={baton.x} cy={baton.y} r={8} />
          <circle className="relay-map-baton" cx={baton.x} cy={baton.y} r={7} />
        </g>
      )}
      {finished && <text className="relay-map-finish" x={baton.x - 10} y={baton.y + 22} textAnchor="end">🏁 완주!</text>}
    </svg>
  );
};

export const ClubRelay = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  const [relay, setRelay] = useState<RelayChallenge | null>(null);
  const [records, setRecords] = useState<RelayLegRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [sheetLeg, setSheetLeg] = useState<RelayLeg | null>(null);
  const [busy, setBusy] = useState(false);

  const course = RELAY_COURSES[relay?.course_key ?? DEFAULT_RELAY_COURSE] ?? RELAY_COURSES[DEFAULT_RELAY_COURSE];
  const legs = useMemo(() => getRelayLegs(course), [course]);

  usePageHeader({
    title: '이어달리기',
    subtitle: clubName ? `클럽 · ${clubName}` : '클럽',
    showBack: true,
  });

  const load = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setError('');
    try {
      const r = await relayService.getCurrentRelay(clubId);
      setRelay(r);
      setRecords(r ? await relayService.getLegs(r) : []);
    } catch (err: any) {
      setError(`이어달리기 불러오기 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!clubId || !user || user.isGuest) return;
    clubService
      .getMyClubs(user.id)
      .then((clubs: any[]) => {
        const me = clubs.find((c) => c.id === clubId);
        setIsMember(!!me);
        setIsManager(me?.role === 'manager' || me?.role === 'vice-manager');
      })
      .catch((err: any) => console.error('[이어달리기] 내 역할 조회 실패:', JSON.stringify(err), err));
  }, [clubId, user]);

  const doneCount = records.length;
  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  const doneKm = legs.slice(0, doneCount).reduce((s, l) => s + l.km, 0);
  const nextLeg = relay?.status === 'active' ? legs[doneCount] : undefined;
  const runners = new Set(records.map((r) => r.user_id)).size;
  const lastRecord = records[records.length - 1];
  const canCancelLast = !!lastRecord && (isManager || lastRecord.user_id === user?.id);

  const handleStart = async () => {
    if (!clubId || !user) return;
    if (!(await confirm(`${RELAY_COURSES[DEFAULT_RELAY_COURSE].title}을 시작할까요? 클럽원 누구나 1구간부터 이어서 인증할 수 있어요.`, { title: '이어달리기 시작', confirmLabel: '시작' }))) return;
    setBusy(true);
    try {
      await relayService.startRelay(clubId, DEFAULT_RELAY_COURSE, user.id);
      await load();
    } catch (err: any) {
      setError(`시작 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelLast = async () => {
    if (!relay || !lastRecord) return;
    const leg = legs[lastRecord.leg_no];
    if (!(await confirm(`${lastRecord.leg_no + 1}구간(${leg.from.name} → ${leg.to.name}, ${lastRecord.runnerName}) 인증을 취소할까요? 바통이 ${leg.from.name}으로 돌아가요.`, { title: '마지막 구간 취소', confirmLabel: '취소하기', danger: true }))) return;
    setBusy(true);
    try {
      await relayService.cancelLastLeg(relay.id);
      await load();
    } catch (err: any) {
      setError(`구간 취소 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!relay) return;
    if (!(await confirm('이어달리기를 중단할까요? 지금까지 기록은 남지만 더 이상 인증할 수 없어요.', { title: '이어달리기 중단', confirmLabel: '중단', danger: true }))) return;
    setBusy(true);
    try {
      await relayService.endRelay(relay.id, 'cancelled');
      await load();
    } catch (err: any) {
      setError(`중단 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="settings-page relay-page"><div className="relay-empty">불러오는 중…</div></div>;

  return (
    <div className="settings-page relay-page">
      {error && <div className="relay-error">{error}</div>}

      {!relay ? (
        <div className="relay-empty">
          <div className="relay-empty-emoji" aria-hidden>🏃‍♂️🏃‍♀️🏃</div>
          <h2>서울 → 부산 이어달리기</h2>
          <p>
            서울시청에서 부산역까지 약 {totalKm}km를 {legs.length}개 구간으로 나눠,<br />
            앞사람이 도착한 곳에서 다음 사람이 출발해요.
          </p>
          {isManager ? (
            <button type="button" className="relay-primary-btn" disabled={busy} onClick={handleStart}>
              이어달리기 시작하기
            </button>
          ) : (
            <p className="relay-muted">운영진이 시작하면 여기서 참여할 수 있어요.</p>
          )}
        </div>
      ) : (
        <>
          <section className="relay-hero">
            <div className="relay-hero-title">{relay.title}</div>
            {relay.status === 'finished' ? (
              <div className="relay-hero-big">🏁 부산 도착!</div>
            ) : (
              <div className="relay-hero-big">
                부산까지 <b>{totalKm - doneKm}</b>km
              </div>
            )}
            <div className="relay-progress"><span style={{ width: `${(doneKm / totalKm) * 100}%` }} /></div>
            <div className="relay-hero-meta">
              {doneCount}/{legs.length}구간 · {doneKm}km · {runners}명 참여
              {relay.status === 'cancelled' && ' · 중단됨'}
            </div>
          </section>

          <RelayMap course={course} doneLegs={doneCount} />

          {nextLeg && (
            <section className="relay-next">
              <div className="relay-next-kicker">지금 바통은 <b>{nextLeg.from.name}</b>에 있어요</div>
              <div className="relay-next-leg">
                {nextLeg.no + 1}구간 · {nextLeg.from.name} → {nextLeg.to.name} <span>약 {nextLeg.km}km</span>
              </div>
              {isMember ? (
                <button type="button" className="relay-primary-btn" onClick={() => setSheetLeg(nextLeg)}>
                  이 구간 뛰었어요
                </button>
              ) : (
                <div className="relay-muted">클럽원으로 로그인하면 인증할 수 있어요.</div>
              )}
            </section>
          )}

          <ol className="relay-legs">
            {legs.map((leg) => {
              const rec = records[leg.no];
              const state = rec ? 'done' : leg.no === doneCount && relay.status === 'active' ? 'current' : 'locked';
              return (
                <li key={leg.no} className={`relay-leg ${state}`}>
                  <span className="relay-leg-icon" aria-hidden>
                    {state === 'done' ? <Check size={14} /> : state === 'current' ? <Flag size={13} /> : <Lock size={12} />}
                  </span>
                  <div className="relay-leg-body">
                    <div className="relay-leg-title">
                      <span>{leg.no + 1}. {leg.from.name} → {leg.to.name}</span>
                      <span className="relay-leg-km">약 {leg.km}km</span>
                    </div>
                    {rec && (
                      <div className="relay-leg-runner">
                        <b>{rec.runnerName}</b> · {fmtDay(rec.created_at)}
                        {rec.workoutKm ? ` · ${rec.workoutKm}km 기록` : ''}
                        {rec.note && <div className="relay-leg-note">“{rec.note}”</div>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {(canCancelLast || isManager) && (
            <div className="relay-admin">
              {canCancelLast && (
                <button type="button" className="relay-ghost-btn" disabled={busy} onClick={handleCancelLast}>
                  마지막 구간 인증 취소
                </button>
              )}
              {isManager && relay.status === 'active' && (
                <button type="button" className="relay-ghost-btn danger" disabled={busy} onClick={handleEnd}>
                  이어달리기 중단
                </button>
              )}
              {isManager && relay.status !== 'active' && (
                <button type="button" className="relay-ghost-btn" disabled={busy} onClick={handleStart}>
                  새 이어달리기 시작
                </button>
              )}
            </div>
          )}
        </>
      )}

      {sheetLeg && relay && user && (
        <RelayCompleteSheet
          relayId={relay.id}
          leg={sheetLeg}
          userId={user.id}
          usedWorkoutIds={records.map((r) => r.workout_id).filter(Boolean) as string[]}
          onClose={() => setSheetLeg(null)}
          onDone={() => { setSheetLeg(null); load(); }}
        />
      )}
      {ConfirmDialog}
    </div>
  );
};
