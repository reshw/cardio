// 이어달리기 코스 — 정해진 구간은 없다. 기준선(경유지 좌표)만 있고,
// 각 주자가 앞사람이 멈춘 곳에서 출발해 원하는 곳에서 멈추며 km 를 쌓는다.
// 지도 위 위치는 "누적 km 를 기준선 위에 보간"해서 그린다 (GPS 아님, 대략치).

export interface RelayPoint {
  name: string;
  lat: number;
  lng: number;
  /** 지도에 지역 이름으로 표시할 지점 */
  region?: string;
  /** 지도 이름표 위치 */
  label?: 'left' | 'right' | 'below' | 'above';
}

export interface RelayCourse {
  key: string;
  title: string;
  subtitle: string;
  startName: string;
  finishName: string;
  points: RelayPoint[];
  /** 직선거리 합 → 실제 길 거리 보정 배수 */
  pathFactor: number;
}

function haversineKm(a: RelayPoint, b: RelayPoint): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const RELAY_COURSES: Record<string, RelayCourse> = {
  'seoul-busan': {
    key: 'seoul-busan',
    title: '서울 → 부산 이어달리기',
    subtitle: '국토종주 자전거길(한강·남한강·새재·낙동강) 따라',
    startName: '서울시청',
    finishName: '부산 낙동강하굿둑',
    // 강변 자전거길은 굽이가 많아 직선 대비 약 1.45배 (공식 인천~부산 633km 중 서울 이후 ≈ 565km)
    pathFactor: 1.45,
    points: [
      { name: '서울시청', lat: 37.5663, lng: 126.9779, region: '서울', label: 'left' },
      { name: '반포한강공원', lat: 37.51, lng: 126.996 },
      { name: '뚝섬', lat: 37.5294, lng: 127.0669 },
      { name: '광나루', lat: 37.5463, lng: 127.1205 },
      { name: '팔당', lat: 37.547, lng: 127.244 },
      { name: '능내', lat: 37.5577, lng: 127.3027 },
      { name: '양평', lat: 37.4917, lng: 127.4877, region: '양평', label: 'right' },
      { name: '이포보', lat: 37.4012, lng: 127.5426 },
      { name: '여주보', lat: 37.3245, lng: 127.6017, region: '여주', label: 'left' },
      { name: '강천보', lat: 37.3164, lng: 127.6857 },
      { name: '비내섬', lat: 37.1048, lng: 127.818 },
      { name: '충주 탄금대', lat: 36.9887, lng: 127.9123, region: '충주', label: 'left' },
      { name: '수안보', lat: 36.8455, lng: 127.9928 },
      { name: '이화령', lat: 36.7462, lng: 128.0566, region: '이화령', label: 'right' },
      { name: '문경', lat: 36.5877, lng: 128.1868 },
      { name: '상주 상풍교', lat: 36.5375, lng: 128.2711, region: '상주', label: 'right' },
      { name: '상주보', lat: 36.4359, lng: 128.2513 },
      { name: '낙단보', lat: 36.357, lng: 128.2914 },
      { name: '구미보', lat: 36.264, lng: 128.338, region: '구미', label: 'right' },
      { name: '칠곡보', lat: 35.9988, lng: 128.4014 },
      { name: '강정고령보', lat: 35.8445, lng: 128.463, region: '대구', label: 'right' },
      { name: '달성보', lat: 35.7307, lng: 128.43 },
      { name: '합천창녕보', lat: 35.5866, lng: 128.3672, region: '합천', label: 'left' },
      { name: '창녕함안보', lat: 35.3814, lng: 128.4416 },
      { name: '양산 물금', lat: 35.3132, lng: 128.9886, region: '양산', label: 'right' },
      { name: '낙동강하굿둑', lat: 35.1065, lng: 128.944, region: '부산', label: 'left' },
    ],
  },
};

export const DEFAULT_RELAY_COURSE = 'seoul-busan';

/** 각 경유지까지의 누적 km (보정 배수 적용) */
export function cumulativeKm(course: RelayCourse): number[] {
  const acc = [0];
  for (let i = 1; i < course.points.length; i++) {
    acc.push(acc[i - 1] + haversineKm(course.points[i - 1], course.points[i]) * course.pathFactor);
  }
  return acc;
}

export function courseTotalKm(course: RelayCourse): number {
  const acc = cumulativeKm(course);
  return Math.round(acc[acc.length - 1]);
}

/** 누적 km → 기준선 위 좌표 (총거리 비율로 보간해서 total_km 가 달라도 끝이 맞게) */
export function pointAtKm(course: RelayCourse, km: number, totalKm?: number): { lat: number; lng: number } {
  const acc = cumulativeKm(course);
  const full = acc[acc.length - 1];
  const target = Math.max(0, Math.min(full, (km / (totalKm || full)) * full));
  let i = 1;
  while (i < acc.length - 1 && acc[i] < target) i++;
  const a = course.points[i - 1], b = course.points[i];
  const t = acc[i] === acc[i - 1] ? 0 : (target - acc[i - 1]) / (acc[i] - acc[i - 1]);
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** 누적 km 가 기준선상 어디쯤인지 한 줄 설명 — 예: "팔당 지나 3km" */
export function describeKm(course: RelayCourse, km: number, totalKm?: number): string {
  const acc = cumulativeKm(course);
  const full = acc[acc.length - 1];
  const target = Math.max(0, Math.min(full, (km / (totalKm || full)) * full));
  let i = 0;
  while (i < acc.length - 1 && acc[i + 1] <= target) i++;
  if (i >= acc.length - 1) return course.points[acc.length - 1].name;
  const past = target - acc[i];
  const toNext = acc[i + 1] - target;
  if (past < 1) return `${course.points[i].name} 부근`;
  if (toNext < 1) return `${course.points[i + 1].name} 부근`;
  return toNext < past
    ? `${course.points[i + 1].name} 전 ${Math.round(toNext)}km`
    : `${course.points[i].name} 지나 ${Math.round(past)}km`;
}
