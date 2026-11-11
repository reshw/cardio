// 카디오 랩드 노출 기간 — clubs.wrapped_period (jsonb, null 허용)
//
//   null                                   → 기본: 11/1 ~ 1/31 (11~12월은 올해, 1월은 작년 결산)
//   { mode: 'off' }                        → 이 클럽에선 배너를 안 띄움
//   { mode: 'custom', from, to }           → 운영진이 정한 기간(YYYY-MM-DD, 양끝 포함)
//
// 결산 대상 연도는 시작일 기준: 시작일이 1~2월이면 작년, 3월 이후면 그해.
// (예: 2026-12-01 ~ 2027-01-15 → 2026년, 2027-01-05 ~ 2027-02-10 → 2026년)

export type WrappedPeriod =
  | { mode: 'off' }
  | { mode: 'custom'; from: string; to: string };

export interface WrappedWindow {
  year: number;   // 결산 대상 연도
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 시작일로부터 결산 대상 연도 */
export const wrappedYearFor = (from: string) => {
  const y = +from.slice(0, 4);
  const m = +from.slice(5, 7);
  return m <= 2 ? y - 1 : y;
};

/** 기본 규칙(설정 없음)일 때 `now` 가 속한/다가올 노출 기간 */
export const defaultWindow = (now: Date): WrappedWindow => {
  const y = now.getFullYear();
  // 1월이면 작년 11월에 시작한 기간, 그 외엔 올해 11월에 시작하는 기간
  const start = now.getMonth() === 0 ? y - 1 : y;
  return { year: start, from: `${start}-11-01`, to: `${start + 1}-01-31` };
};

/** 설정에 따른 기간 (끔이면 null). 지금 노출 중인지는 isWithin 으로 따로 본다. */
export const resolveWindow = (period: WrappedPeriod | null | undefined, now = new Date()): WrappedWindow | null => {
  if (!period) return defaultWindow(now);
  if (period.mode === 'off') return null;
  return { year: wrappedYearFor(period.from), from: period.from, to: period.to };
};

export const isWithin = (w: WrappedWindow, now = new Date()) => {
  const today = toYmd(now);
  return today >= w.from && today <= w.to;
};

/** 지금 배너를 띄울 결산 연도. 노출 기간이 아니면 null */
export const activeWrappedYear = (period: WrappedPeriod | null | undefined, now = new Date()): number | null => {
  const w = resolveWindow(period, now);
  return w && isWithin(w, now) ? w.year : null;
};
