// 카디오 랩드 노출 기간 — clubs.wrapped_period (jsonb, null 허용)
//
//   null                                   → 기본: 12/10 18:00 ~ 1/31 (KST). 12월은 올해, 1월은 작년 결산
//   { mode: 'off' }                        → 이 클럽에선 배너를 안 띄움
//   { mode: 'custom', from, to }           → 운영진이 정한 기간(YYYY-MM-DD, 양끝 포함, KST 하루 전체)
//
// 결산 대상 연도는 시작일 기준: 시작일이 1~2월이면 작년, 3월 이후면 그해.
// (예: 2026-12-01 ~ 2027-01-15 → 2026년, 2027-01-05 ~ 2027-02-10 → 2026년)
//
// 기간 판정은 기기 시간대와 무관하게 KST 로 한다.

export type WrappedPeriod =
  | { mode: 'off' }
  | { mode: 'custom'; from: string; to: string };

export interface WrappedWindow {
  year: number;      // 결산 대상 연도
  from: string;      // YYYY-MM-DD
  to: string;        // YYYY-MM-DD
  fromTime?: string; // HH:mm (KST). 없으면 00:00
}

export const DEFAULT_START_MD = '12-10';
export const DEFAULT_START_TIME = '18:00';

const pad = (n: number) => String(n).padStart(2, '0');
/** 기기 로컬 날짜 → YYYY-MM-DD (달력 피커용) */
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 지금 시각을 KST 기준 'YYYY-MM-DDTHH:mm' 으로 */
export const kstStamp = (now = new Date()) => {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
};

/** 시작일로부터 결산 대상 연도 */
export const wrappedYearFor = (from: string) => {
  const y = +from.slice(0, 4);
  const m = +from.slice(5, 7);
  return m <= 2 ? y - 1 : y;
};

/** 기본 규칙(설정 없음)일 때 `now` 가 속한/다가올 노출 기간 */
export const defaultWindow = (now = new Date()): WrappedWindow => {
  const today = kstStamp(now);
  const y = +today.slice(0, 4);
  // 1월이면 작년 12월에 시작한 기간, 그 외엔 올해 12월에 시작하는 기간
  const start = today.slice(5, 7) === '01' ? y - 1 : y;
  return { year: start, from: `${start}-${DEFAULT_START_MD}`, fromTime: DEFAULT_START_TIME, to: `${start + 1}-01-31` };
};

/** 설정에 따른 기간 (끔이면 null). 지금 노출 중인지는 isWithin 으로 따로 본다. */
export const resolveWindow = (period: WrappedPeriod | null | undefined, now = new Date()): WrappedWindow | null => {
  if (!period) return defaultWindow(now);
  if (period.mode === 'off') return null;
  return { year: wrappedYearFor(period.from), from: period.from, to: period.to };
};

export const startStamp = (w: WrappedWindow) => `${w.from}T${w.fromTime ?? '00:00'}`;

export const isWithin = (w: WrappedWindow, now = new Date()) => {
  const t = kstStamp(now);
  return t >= startStamp(w) && t <= `${w.to}T23:59`;
};

/** 지금 배너를 띄울 결산 연도. 노출 기간이 아니면 null */
export const activeWrappedYear = (period: WrappedPeriod | null | undefined, now = new Date()): number | null => {
  const w = resolveWindow(period, now);
  return w && isWithin(w, now) ? w.year : null;
};
