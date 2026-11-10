import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import html2canvas from 'html2canvas';
import wrappedService, { type WrappedData, type WrappedSport, type WrappedWorkout } from '../services/wrappedService';
import { useModalHistory } from '../hooks/useModalHistory';
import './CardioWrapped.css';

// 카디오 랩드 — 세로로 슥슥 내리며 보는 나의 한 해.
// 전체화면 오버레이(createPortal), 슬라이드마다 scroll-snap. 화면에 들어온 슬라이드만
// 애니메이션(숫자 카운트업·페이드업)이 켜진다.

interface Props {
  clubId: string;
  clubName: string;
  userId: string;
  fallbackName: string;
  year: number;
  hideRank: boolean; // 월말 마일리지 잠금 중(일반회원)이면 순위 카드를 숨긴다
  onClose: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMOJI: Record<string, string> = {
  달리기: '🏃', 사이클: '🚴', 수영: '🏊', 계단: '🪜', 등산: '⛰️', 요가: '🧘', 복싱: '🥊', 검도: '🗡️', 걷기: '🚶',
};
const emoji = (c: string) => EMOJI[c] ?? '💪';

const fmt = (n: number, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const md = (ymd: string) => `${+ymd.slice(5, 7)}월 ${+ymd.slice(8, 10)}일`;
const amount = (value: number, unit: string) => {
  if (unit === '분' && value >= 60) {
    const h = Math.floor(value / 60), m = Math.round(value % 60);
    return m ? `${fmt(h)}시간 ${m}분` : `${fmt(h)}시간`;
  }
  return `${fmt(value, unit === 'km' ? 1 : 0)}${unit}`;
};
const workoutLabel = (w: WrappedWorkout) => `${w.subType && w.subType !== w.category ? `${w.category}(${w.subType})` : w.category} ${amount(w.value, w.unit)}`;
const sportLabel = (s: WrappedSport) => (s.unit === '층' || s.unit === '분') && s.category === '계단' ? `계단(${s.unit})` : s.category;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target: number, active: boolean, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reducedMotion()) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms]);
  return v;
}

const Count = ({ to, active, digits = 0 }: { to: number; active: boolean; digits?: number }) => {
  const v = useCountUp(to, active);
  return <>{fmt(v, digits)}</>;
};

function distancePhrase(km: number) {
  if (km >= 20037) return `지구를 ${fmt(km / 40075, 1)}바퀴 도는 거리`;
  if (km >= 800) return `서울에서 부산까지 ${fmt(Math.floor(km / 400))}번 갈 수 있는 거리`;
  if (km >= 84) return `마라톤 풀코스 ${fmt(Math.floor(km / 42.195))}개를 이어 붙인 거리`;
  return '한 걸음 한 걸음이 모인 거리';
}

function daysPhrase(ratio: number) {
  if (ratio >= 0.8) return '거의 매일. 이건 습관이 아니라 생활이에요.';
  if (ratio >= 0.5) return '이틀에 한 번 넘게 움직였어요.';
  if (ratio >= 0.3) return '사흘에 한 번, 꾸준함이 쌓였어요.';
  return '한 번 한 번이 다 소중한 기록이에요.';
}

interface Slide { key: string; tone: string; body: (active: boolean) => ReactNode }

function buildSlides(d: WrappedData, hideRank: boolean): Slide[] {
  const s: Slide[] = [];
  const asOfNote = d.asOf.endsWith('12-31') ? `${d.year}년 1월 1일 ~ 12월 31일` : `${d.year}년 1월 1일 ~ ${md(d.asOf)} 기록 기준`;

  s.push({ key: 'intro', tone: 'tone-night', body: () => (
    <>
      <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>{d.clubName}</p>
      <h1 className="cw-title cw-in" style={{ ['--i' as any]: 1 }}>{d.nickname}님의<br />{d.year}</h1>
      <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>올 한 해, 당신이 움직인 시간을<br />한 장씩 펼쳐볼게요.</p>
      <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>{asOfNote}</p>
      <div className="cw-scroll-hint" aria-hidden>아래로 내려보세요<span>↓</span></div>
    </>
  ) });

  if (d.first) {
    const f = d.first;
    s.push({ key: 'first', tone: 'tone-dawn', body: () => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>모든 건 이날 시작됐어요</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>{md(f.date)}</p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>{emoji(f.category)} {workoutLabel(f)}<br />{d.year}년의 첫 기록</p>
      </>
    ) });
  }

  s.push({ key: 'days', tone: 'tone-ocean', body: (a) => (
    <>
      <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>올해 운동한 날</p>
      <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}><Count to={d.activeDays} active={a} /><small>일</small></p>
      <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>{d.elapsedDays}일 중 {fmt((d.activeDays / d.elapsedDays) * 100)}%<br />{daysPhrase(d.activeDays / d.elapsedDays)}</p>
      <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>기록 {fmt(d.workoutCount)}개 · 마일리지 {fmt(d.totalMileage, 1)}</p>
    </>
  ) });

  if (d.distanceKm >= 10) {
    s.push({ key: 'distance', tone: 'tone-forest', body: (a) => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>달리고, 타고, 헤엄친 거리</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}><Count to={d.distanceKm} active={a} /><small>km</small></p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>{distancePhrase(d.distanceKm)}</p>
      </>
    ) });
  }

  if (d.sports.length > 0) {
    const top = d.sports.slice(0, 5);
    const max = top[0].mileage || 1;
    s.push({ key: 'sports', tone: 'tone-violet', body: () => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>당신의 {d.year}을 채운 종목</p>
        <p className="cw-big cw-in" style={{ ['--i' as any]: 1 }}>{emoji(top[0].category)} {sportLabel(top[0])}</p>
        <ul className="cw-bars">
          {top.map((sp, i) => (
            <li key={`${sp.category}-${sp.unit}`} className="cw-in" style={{ ['--i' as any]: i + 2 }}>
              <span className="cw-bar-name">{emoji(sp.category)} {sportLabel(sp)}</span>
              <span className="cw-bar-track"><span className="cw-bar-fill" style={{ ['--w' as any]: `${Math.max(4, (sp.mileage / max) * 100)}%` }} /></span>
              <span className="cw-bar-val">{amount(sp.value, sp.unit)} · {sp.count}회</span>
            </li>
          ))}
        </ul>
        {d.sports.length > 5 && <p className="cw-note cw-in" style={{ ['--i' as any]: 8 }}>그 밖에 {d.sports.length - 5}개 종목까지</p>}
      </>
    ) });
  }

  if (d.best) {
    const b = d.best;
    s.push({ key: 'best', tone: 'tone-ember', body: () => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>가장 뜨거웠던 하루</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>{md(b.date)}</p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>{emoji(b.category)} {workoutLabel(b)}</p>
        <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>이날 하루 마일리지 {fmt(b.mileage, 1)}</p>
      </>
    ) });
  }

  if (d.fullMarathons.length > 0) {
    s.push({ key: 'marathon', tone: 'tone-gold', body: (a) => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>42.195km</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>풀코스 <Count to={d.fullMarathons.length} active={a} /><small>번</small></p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>{d.fullMarathons.map((m) => md(m.date)).join(' · ')}</p>
        <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>끝까지 달린 당신, 진짜 멋있어요.</p>
      </>
    ) });
  }

  if (d.streak && d.streak.days >= 3) {
    const st = d.streak;
    s.push({ key: 'streak', tone: 'tone-fire', body: (a) => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>하루도 쉬지 않았던 날들</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}><Count to={st.days} active={a} /><small>일 연속</small></p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>{md(st.start)}부터 {md(st.end)}까지</p>
      </>
    ) });
  }

  const bestMonth = d.monthly.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
  if (d.monthly[bestMonth] > 0) {
    const max = d.monthly[bestMonth];
    s.push({ key: 'month', tone: 'tone-sunset', body: () => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>가장 불타올랐던 달</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>{bestMonth + 1}<small>월</small></p>
        <div className="cw-cols cw-in" style={{ ['--i' as any]: 2 }}>
          {d.monthly.map((v, i) => (
            <div key={i} className={`cw-col${i === bestMonth ? ' on' : ''}`}>
              <span className="cw-col-bar" style={{ ['--h' as any]: `${Math.max(2, (v / max) * 100)}%`, ['--d' as any]: `${i * 60}ms` }} />
              <span className="cw-col-label">{i + 1}</span>
            </div>
          ))}
        </div>
        <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>한 달 마일리지 {fmt(max, 1)}</p>
      </>
    ) });
  }

  const favDay = d.weekday.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
  if (d.activeDays >= 7) {
    const max = d.weekday[favDay] || 1;
    s.push({ key: 'weekday', tone: 'tone-teal', body: () => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>당신은</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>{WEEKDAYS[favDay]}요일형<small> 인간</small></p>
        <div className="cw-cols cw-in" style={{ ['--i' as any]: 2 }}>
          {d.weekday.map((v, i) => (
            <div key={i} className={`cw-col${i === favDay ? ' on' : ''}`}>
              <span className="cw-col-bar" style={{ ['--h' as any]: `${Math.max(2, (v / max) * 100)}%`, ['--d' as any]: `${i * 70}ms` }} />
              <span className="cw-col-label">{WEEKDAYS[i]}</span>
            </div>
          ))}
        </div>
        <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>{WEEKDAYS[favDay]}요일에만 {d.weekday[favDay]}번 운동했어요</p>
      </>
    ) });
  }

  if (d.likesReceived + d.likesGiven > 0) {
    s.push({ key: 'likes', tone: 'tone-rose', body: (a) => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>혼자 달린 게 아니었어요</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>❤️ <Count to={d.likesReceived} active={a} /></p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>클럽 동료들에게 받은 응원</p>
        {d.likesGiven > 0 && <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>당신도 {fmt(d.likesGiven)}번 응원을 보냈어요</p>}
      </>
    ) });
  }

  if (d.prevYear && d.prevYear.mileage > 0) {
    const p = d.prevYear;
    const ratio = d.totalMileage / p.mileage;
    s.push({ key: 'growth', tone: 'tone-ocean', body: (a) => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>작년의 나와 비교하면</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}>{ratio >= 1 ? '+' : ''}<Count to={(ratio - 1) * 100} active={a} /><small>%</small></p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>마일리지 {fmt(p.mileage, 0)} → {fmt(d.totalMileage, 0)}</p>
        <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>{ratio >= 1 ? '작년의 나를 넘어섰어요.' : '쉬어가는 해도 괜찮아요. 내년이 있으니까요.'}</p>
      </>
    ) });
  }

  if (!hideRank && d.rank && d.memberCount > 0 && d.clubTotalMileage > 0) {
    const topPct = Math.max(1, Math.ceil((d.rank / d.memberCount) * 100));
    const share = (d.totalMileage / d.clubTotalMileage) * 100;
    s.push({ key: 'club', tone: 'tone-night', body: (a) => (
      <>
        <p className="cw-kicker cw-in" style={{ ['--i' as any]: 0 }}>{d.clubName} 전체 마일리지 {fmt(d.clubTotalMileage)} 중</p>
        <p className="cw-huge cw-in" style={{ ['--i' as any]: 1 }}><Count to={share} active={a} digits={1} /><small>%</small></p>
        <p className="cw-lead cw-in" style={{ ['--i' as any]: 2 }}>당신이 만든 몫이에요</p>
        {topPct <= 50 && <p className="cw-note cw-in" style={{ ['--i' as any]: 3 }}>{d.memberCount}명 중 상위 {topPct}%</p>}
      </>
    ) });
  }

  return s;
}

export function CardioWrapped({ clubId, clubName, userId, fallbackName, year, hideRank, onClose }: Props) {
  useModalHistory(true, onClose);
  const [data, setData] = useState<WrappedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    wrappedService.getWrapped(clubId, clubName, userId, fallbackName, year)
      .then((d) => { if (alive) setData(d); })
      .catch((err: any) => {
        console.error('[카디오랩드] 불러오기 실패 상세:', JSON.stringify(err), err);
        const msg = err?.message || err?.error_description || err?.hint || JSON.stringify(err);
        if (alive) setError(`카디오 랩드를 불러오지 못했어요: ${msg}`);
      });
    return () => { alive = false; };
  }, [clubId, clubName, userId, fallbackName, year]);

  const slides = useMemo(() => (data ? buildSlides(data, hideRank) : []), [data, hideRank]);
  const total = slides.length + 1; // + 마지막 요약 카드

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || slides.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const idx = Number((e.target as HTMLElement).dataset.idx);
        setCurrent(idx);
        setSeen((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
      });
    }, { root, threshold: 0.55 });
    root.querySelectorAll('[data-idx]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slides.length]);

  const saveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true });
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('이미지 변환 결과가 비어 있어요 (canvas.toBlob null)');
      const file = new File([blob], `cardio-wrapped-${year}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `나의 ${year} 카디오 랩드` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setSaveMsg('이미지를 저장했어요. 안 보이면 화면을 캡처해서 공유해주세요.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // 공유 시트를 사용자가 닫음
      console.error('[카디오랩드] 이미지 저장 실패 상세:', JSON.stringify(err), err);
      setSaveMsg(`이미지 저장 실패: ${err?.message || JSON.stringify(err)} — 화면을 캡처해서 공유해주세요.`);
    } finally {
      setSaving(false);
    }
  };

  const restart = () => scrollerRef.current?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });

  const bestSport = data?.sports[0];

  return createPortal(
    <div className="cw-overlay" role="dialog" aria-label={`나의 ${year} 카디오 랩드`}>
      {data && (
        <div className="cw-progress" aria-hidden>
          {Array.from({ length: total }, (_, i) => <span key={i} className={i <= current ? 'on' : ''} />)}
        </div>
      )}
      <button className="cw-close" type="button" onClick={onClose} aria-label="닫기"><X size={22} /></button>

      {!data && !error && (
        <div className="cw-loading"><div className="cw-spinner" /><p>{year}년을 모으는 중…</p></div>
      )}
      {error && (
        <div className="cw-loading"><p className="cw-error">{error}</p><button className="cw-btn" type="button" onClick={onClose}>닫기</button></div>
      )}

      {data && data.workoutCount === 0 && (
        <div className="cw-loading">
          <p className="cw-lead">{year}년 {clubName}에 올린 기록이 아직 없어요.</p>
          <p className="cw-note">첫 기록을 올리면 나만의 랩드가 시작돼요.</p>
          <button className="cw-btn" type="button" onClick={onClose}>닫기</button>
        </div>
      )}

      {data && data.workoutCount > 0 && (
        <div className="cw-scroller" ref={scrollerRef}>
          {slides.map((sl, i) => (
            <section key={sl.key} data-idx={i} className={`cw-slide ${sl.tone}${seen.has(i) ? ' is-visible' : ''}`}>
              <div className="cw-content">{sl.body(seen.has(i))}</div>
            </section>
          ))}
          <section data-idx={slides.length} className={`cw-slide tone-night${seen.has(slides.length) ? ' is-visible' : ''}`}>
            <div className="cw-content">
              <div className="cw-card cw-in" ref={cardRef} style={{ ['--i' as any]: 0 }}>
                <p className="cw-card-club">{data.clubName}</p>
                <p className="cw-card-title">{data.nickname}님의 {data.year}</p>
                <div className="cw-card-grid">
                  <div><b>{fmt(data.activeDays)}일</b><span>운동한 날</span></div>
                  <div><b>{fmt(data.totalMileage, 0)}</b><span>마일리지</span></div>
                  {data.distanceKm >= 10 && <div><b>{fmt(data.distanceKm, 0)}km</b><span>움직인 거리</span></div>}
                  {data.streak && data.streak.days >= 3 && <div><b>{data.streak.days}일</b><span>최장 연속</span></div>}
                  {bestSport && <div><b>{emoji(bestSport.category)} {sportLabel(bestSport)}</b><span>최애 종목</span></div>}
                  {data.fullMarathons.length > 0 && <div><b>{data.fullMarathons.length}번</b><span>풀코스 완주</span></div>}
                </div>
                <p className="cw-card-foot">{data.year + 1}에도 함께 달려요 · cardio</p>
              </div>
              <div className="cw-actions cw-in" style={{ ['--i' as any]: 1 }}>
                <button className="cw-btn primary" type="button" onClick={saveImage} disabled={saving}>{saving ? '만드는 중…' : '이미지로 저장·공유'}</button>
                <button className="cw-btn" type="button" onClick={restart}>처음부터 다시</button>
              </div>
              {saveMsg && <p className="cw-note">{saveMsg}</p>}
            </div>
          </section>
        </div>
      )}
    </div>,
    document.body
  );
}

export default CardioWrapped;
