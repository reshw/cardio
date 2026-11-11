// 이어달리기 코스 정의 — 코스는 코드에 고정(마이그레이션 없이 수정 가능)하고,
// DB(relay_challenges)에는 course_key 와 구간 수(leg_count)만 저장한다.
// 정밀한 경로 검증은 하지 않는다(클럽 재미용, 자율 인증). 거리는 "약" 값이다.

export interface RelayPoint {
  name: string;
  lat: number;
  lng: number;
  /** 지도에 이름을 항상 표시할 큰 도시 */
  major?: boolean;
  /** 지도 이름표 위치 (없으면 경로에 수직으로 자동 배치) */
  label?: 'left' | 'right' | 'below' | 'below-left';
}

export interface RelayCourse {
  key: string;
  title: string;
  points: RelayPoint[]; // 구간 = 인접한 두 점 (points.length - 1 개)
}

export interface RelayLeg {
  no: number; // 0부터
  from: RelayPoint;
  to: RelayPoint;
  km: number; // 도로 기준 대략치
  startKm: number; // 출발점까지 누적
}

// 직선거리 × 1.2 ≈ 도로 거리 (경부 축 국도 기준 대략치)
const ROAD_FACTOR = 1.2;

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
    points: [
      { name: '서울시청', lat: 37.5663, lng: 126.9779, major: true, label: 'right' },
      { name: '강남역', lat: 37.4979, lng: 127.0276 },
      { name: '판교역', lat: 37.3948, lng: 127.1112 },
      { name: '수원역', lat: 37.2656, lng: 127.0001, major: true, label: 'right' },
      { name: '오산역', lat: 37.1452, lng: 127.0669 },
      { name: '평택역', lat: 36.991, lng: 127.0856 },
      { name: '천안역', lat: 36.8101, lng: 127.1464, major: true, label: 'right' },
      { name: '전의역', lat: 36.6835, lng: 127.2011 },
      { name: '조치원역', lat: 36.601, lng: 127.2961 },
      { name: '신탄진역', lat: 36.4511, lng: 127.4291 },
      { name: '대전역', lat: 36.3324, lng: 127.4343, major: true, label: 'below-left' },
      { name: '옥천역', lat: 36.3063, lng: 127.5714 },
      { name: '심천역', lat: 36.2439, lng: 127.7113 },
      { name: '영동역', lat: 36.1747, lng: 127.7835 },
      { name: '추풍령역', lat: 36.2194, lng: 127.9953 },
      { name: '김천역', lat: 36.124, lng: 128.1137, major: true, label: 'below' },
      { name: '구미역', lat: 36.1283, lng: 128.331 },
      { name: '왜관역', lat: 35.9922, lng: 128.3976 },
      { name: '서대구역', lat: 35.882, lng: 128.5409 },
      { name: '동대구역', lat: 35.8793, lng: 128.6284, major: true, label: 'below-left' },
      { name: '경산역', lat: 35.8221, lng: 128.738 },
      { name: '청도역', lat: 35.6474, lng: 128.7362 },
      { name: '밀양역', lat: 35.4744, lng: 128.7714 },
      { name: '삼랑진역', lat: 35.415, lng: 128.835 },
      { name: '물금역', lat: 35.3132, lng: 128.9886 },
      { name: '구포역', lat: 35.2056, lng: 128.9966 },
      { name: '부산역', lat: 35.1152, lng: 129.0422, major: true, label: 'left' },
    ],
  },
};

export const DEFAULT_RELAY_COURSE = 'seoul-busan';

export function getRelayLegs(course: RelayCourse): RelayLeg[] {
  const legs: RelayLeg[] = [];
  let acc = 0;
  for (let i = 1; i < course.points.length; i++) {
    const km = Math.round(haversineKm(course.points[i - 1], course.points[i]) * ROAD_FACTOR);
    legs.push({ no: i - 1, from: course.points[i - 1], to: course.points[i], km, startKm: acc });
    acc += km;
  }
  return legs;
}
