import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import relayService from '../services/relayService';
import type { RelayChallenge, RelayLegRecord } from '../services/relayService';
import clubService from '../services/clubService';
import { RELAY_COURSES, DEFAULT_RELAY_COURSE, cumulativeKm, courseTotalKm, pointAtKm, describeKm } from '../data/relayCourses';
import type { RelayCourse } from '../data/relayCourses';
import { RelayCompleteSheet } from '../components/RelayCompleteSheet';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { getR2Thumbnail } from '../utils/r2Storage';
import './ClubRelay.css';

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const fmtKm = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');

/** 위경도 → SVG 좌표 (등장방형 + 위도 보정), 코스 전체가 viewBox 에 꽉 차게 */
function makeProjection(course: RelayCourse, w: number, h: number, pad: number) {
  const lats = course.points.map((p) => p.lat);
  const lngs = course.points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const minX = Math.min(...lngs) * k, maxX = Math.max(...lngs) * k;
  const minY = Math.min(...lats), maxY = Math.max(...lats);
  const scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  const offX = (w - (maxX - minX) * scale) / 2;
  const offY = (h - (maxY - minY) * scale) / 2;
  return (lat: number, lng: number) => ({ x: offX + (lng * k - minX) * scale, y: offY + (maxY - lat) * scale });
}

const RelayMap = ({ course, totalKm, ends, finished }: { course: RelayCourse; totalKm: number; ends: number[]; finished: boolean }) => {
  const W = 320, H = 400;
  const proj = useMemo(() => makeProjection(course, W, H, 34), [course]);
  const acc = useMemo(() => cumulativeKm(course), [course]);
  const full = acc[acc.length - 1];
  const pts = course.points.map((p) => ({ ...p, ...proj(p.lat, p.lng) }));
  const doneKm = ends.length ? ends[ends.length - 1] : 0;
  const at = (km: number) => { const p = pointAtKm(course, km, totalKm); return proj(p.lat, p.lng); };
  const baton = at(doneKm);
  // 지나온 길: 시작 ~ 바통 위치 직전 경유지들 + 바통 위치
  const target = (Math.min(doneKm, totalKm) / totalKm) * full;
  const passed = pts.filter((_, i) => acc[i] < target);
  const line = (arr: { x: number; y: number }[]) => arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg className="relay-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${course.title} 진행 지도`}>
      <polyline className="relay-map-rest" points={line(pts)} />
      {doneKm > 0 && <polyline className="relay-map-done" points={line([...passed, baton])} />}
      {/* 주자들이 멈춘 곳 = 바통 넘긴 자리 */}
      {ends.slice(0, -1).map((km, i) => { const p = at(km); return <circle key={i} className="relay-map-handoff" cx={p.x} cy={p.y} r={2.6} />; })}
      {pts.filter((p) => p.region).map((p) => {
        const dx = p.label === 'left' ? -9 : p.label === 'right' ? 9 : 0;
        const dy = p.label === 'below' ? 16 : p.label === 'above' ? -9 : 4;
        return (
          <g key={p.name}>
            <circle className="relay-map-region-dot" cx={p.x} cy={p.y} r={2} />
            <text className="relay-map-label" x={p.x + dx} y={p.y + dy}
              textAnchor={p.label === 'left' ? 'end' : p.label === 'right' ? 'start' : 'middle'}>{p.region}</text>
          </g>
        );
      })}
      {finished ? (
        <text className="relay-map-finish" x={baton.x - 10} y={baton.y + 22} textAnchor="end">🏁 완주!</text>
      ) : (
        <g>
          <circle className="relay-map-baton-pulse" cx={baton.x} cy={baton.y} r={8} />
          <circle className="relay-map-baton" cx={baton.x} cy={baton.y} r={7} />
        </g>
      )}
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
  const [showSheet, setShowSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const course = RELAY_COURSES[relay?.course_key ?? DEFAULT_RELAY_COURSE] ?? RELAY_COURSES[DEFAULT_RELAY_COURSE];

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
      .then((clubs) => {
        const me = clubs.find((c) => c.id === clubId);
        setIsMember(!!me);
        setIsManager(me?.role === 'manager' || me?.role === 'vice-manager');
      })
      .catch((err: any) => console.error('[이어달리기] 내 역할 조회 실패:', JSON.stringify(err), err));
  }, [clubId, user]);

  const totalKm = relay?.total_km ?? courseTotalKm(course);
  const ends = useMemo(() => {
    let s = 0;
    return records.map((r) => (s += r.km));
  }, [records]);
  const doneKm = Math.min(totalKm, ends.length ? ends[ends.length - 1] : 0);
  const leftKm = Math.max(0, totalKm - doneKm);
  const runners = new Set(records.map((r) => r.user_id)).size;
  const lastRecord = records[records.length - 1];
  const batonName = lastRecord?.end_name || relay?.start_name || course.startName;
  const canCancelLast = !!lastRecord && (isManager || lastRecord.user_id === user?.id);
  const finished = relay?.status === 'finished';
  // 멈춘 곳 사진 앨범 — 서울 → 부산 순서
  const photos = records
    .filter((r) => r.end_photo_url)
    .map((r) => ({ id: r.id, url: r.end_photo_url as string, caption: `${r.end_name} · ${r.runnerName} · ${fmtDay(r.created_at)}` }));
  const openPhoto = (recId: string) => {
    const i = photos.findIndex((p) => p.id === recId);
    if (i >= 0) setLightboxIdx(i);
  };

  const handleStart = async () => {
    if (!clubId || !user) return;
    if (!(await confirm(`${course.title}을 시작할까요? 클럽원 누구나 앞사람이 멈춘 곳에서 이어 달리고 기록할 수 있어요.`, { title: '이어달리기 시작', confirmLabel: '시작' }))) return;
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
    if (!(await confirm(`${lastRecord.runnerName}님의 마지막 기록(${lastRecord.start_name} → ${lastRecord.end_name}, ${fmtKm(lastRecord.km)}km)을 취소할까요? 바통이 ${lastRecord.start_name}(으)로 돌아가요.`, { title: '마지막 기록 취소', confirmLabel: '취소하기', danger: true }))) return;
    setBusy(true);
    try {
      await relayService.cancelLastLeg(relay.id);
      await load();
    } catch (err: any) {
      setError(`기록 취소 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!relay) return;
    if (!(await confirm('이어달리기를 중단할까요? 지금까지 기록은 남지만 더 이상 이어 달릴 수 없어요.', { title: '이어달리기 중단', confirmLabel: '중단', danger: true }))) return;
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
          <h2>{course.title}</h2>
          <p>
            {course.subtitle}<br />
            {course.startName}에서 {course.finishName}까지 약 {courseTotalKm(course)}km.<br />
            앞사람이 멈춘 곳에서 이어 달리고, 내가 멈춘 곳을 남겨요.
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
            {finished ? (
              <div className="relay-hero-big">🏁 부산 도착!</div>
            ) : (
              <div className="relay-hero-big">부산까지 <b>{fmtKm(leftKm)}</b>km 남음</div>
            )}
            <div className="relay-progress"><span style={{ width: `${(doneKm / totalKm) * 100}%` }} /></div>
            <div className="relay-hero-meta">
              {fmtKm(doneKm)}km 왔어요 · {runners}명이 {records.length}번 이어 달림
              {relay.status === 'cancelled' && ' · 중단됨'}
            </div>
          </section>

          <RelayMap course={course} totalKm={totalKm} ends={ends} finished={finished} />

          {relay.status === 'active' && (
            <section className="relay-next">
              <div className="relay-next-kicker">
                {lastRecord ? <>{lastRecord.runnerName}님이 {fmtDay(lastRecord.created_at)}에 멈춘 곳</> : '출발점'}
              </div>
              <div className="relay-next-leg">📍 {batonName}</div>
              {lastRecord?.end_photo_url && (
                <button type="button" className="relay-next-photo" onClick={() => openPhoto(lastRecord.id)}>
                  <img src={lastRecord.end_photo_url} alt={`${batonName} 출발 지점 사진`} loading="lazy" />
                  <span>여기서 출발하세요</span>
                </button>
              )}
              <div className="relay-next-sub">기준선으로는 {describeKm(course, doneKm, totalKm)}</div>
              {isMember ? (
                <button type="button" className="relay-primary-btn" onClick={() => setShowSheet(true)}>
                  여기서부터 이어 달렸어요
                </button>
              ) : (
                <div className="relay-muted">클럽원으로 로그인하면 이어 달릴 수 있어요.</div>
              )}
            </section>
          )}

          {records.length > 0 && (
            <section className="relay-log">
              <div className="relay-log-title">바통 기록</div>
              <ol className="relay-log-list">
                {[...records].reverse().map((rec) => (
                  <li key={rec.id} className="relay-log-item">
                    <div className="relay-log-text">
                      <div className="relay-log-head">
                        <b>{rec.runnerName}</b>
                        <span>{fmtDay(rec.created_at)} · {fmtKm(rec.km)}km</span>
                      </div>
                      <div className="relay-log-route">{rec.start_name} → {rec.end_name}</div>
                      {rec.note && <div className="relay-log-note">“{rec.note}”</div>}
                    </div>
                    {rec.end_photo_url && (
                      <button type="button" className="relay-log-thumb" onClick={() => openPhoto(rec.id)} aria-label={`${rec.end_name} 사진 보기`}>
                        <img src={getR2Thumbnail(rec.end_photo_url)} alt="" loading="lazy"
                          onError={(e) => { const img = e.currentTarget; if (img.src !== rec.end_photo_url) img.src = rec.end_photo_url as string; }} />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(canCancelLast || isManager) && (
            <div className="relay-admin">
              {canCancelLast && (
                <button type="button" className="relay-ghost-btn" disabled={busy} onClick={handleCancelLast}>
                  마지막 기록 취소
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

      {showSheet && relay && user && (
        <RelayCompleteSheet
          relayId={relay.id}
          course={course}
          totalKm={totalKm}
          doneKm={doneKm}
          startName={batonName}
          userId={user.id}
          usedWorkoutIds={records.map((r) => r.workout_id).filter(Boolean) as string[]}
          onClose={() => setShowSheet(false)}
          onDone={() => { setShowSheet(false); load(); }}
        />
      )}
      {lightboxIdx !== null && photos.length > 0 && (
        <PhotoLightbox photos={photos} index={lightboxIdx} onIndexChange={setLightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
      {ConfirmDialog}
    </div>
  );
};
