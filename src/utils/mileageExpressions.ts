interface Expression {
  emoji: string;
  label: string;
  km: number;
  singularUnit: string;   // 1회 이상일 때
  percentUnit: string;    // 미달일 때
  format: (n: number) => string;
}

const EXPRESSIONS: Expression[] = [
  {
    emoji: '🗺️',
    label: '서울→부산',
    km: 420,
    singularUnit: '번 완주',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${Math.floor(n)}번 완주` : `${Math.round(n * 100)}% 달성`,
  },
  {
    emoji: '✈️',
    label: '서울↔뉴욕',
    km: 11052,
    singularUnit: '회',
    percentUnit: '% 날아감',
    format: (n) => n >= 1 ? `${n.toFixed(1)}번 왕복` : `${Math.round(n * 100)}% 날아감`,
  },
  {
    emoji: '✈️',
    label: '서울↔런던',
    km: 9008,
    singularUnit: '회',
    percentUnit: '% 날아감',
    format: (n) => n >= 1 ? `${n.toFixed(1)}번 왕복` : `${Math.round(n * 100)}% 날아감`,
  },
  {
    emoji: '🏃',
    label: '풀마라톤',
    km: 42.195,
    singularUnit: '번 완주',
    percentUnit: '% 달성',
    format: (n) => `${Math.floor(n)}번 완주`,
  },
  {
    emoji: '🌄',
    label: '국토종주',
    km: 633,
    singularUnit: '번 종주',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${Math.floor(n)}번 종주` : `${Math.round(n * 100)}% 달성`,
  },
  {
    emoji: '🏝️',
    label: '제주 해안도로',
    km: 253,
    singularUnit: '바퀴',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${Math.floor(n)}바퀴` : `${Math.round(n * 100)}% 달성`,
  },
  {
    emoji: '🌍',
    label: '지구 한 바퀴',
    km: 40075,
    singularUnit: '바퀴',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${n.toFixed(2)}바퀴` : `${(n * 100).toFixed(1)}% 달성`,
  },
  {
    emoji: '🏔️',
    label: '백두대간 종주',
    km: 735,
    singularUnit: '번 종주',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${Math.floor(n)}번 종주` : `${Math.round(n * 100)}% 달성`,
  },
  {
    emoji: '🌊',
    label: '동해안 해파랑길',
    km: 770,
    singularUnit: '번 완주',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${Math.floor(n)}번 완주` : `${Math.round(n * 100)}% 달성`,
  },
  {
    emoji: '⛰️',
    label: '에베레스트 등정',
    km: 8849,
    singularUnit: '번 등정',
    percentUnit: '% 달성',
    format: (n) => `${Math.floor(n)}번 등정`,
  },
  {
    emoji: '🚄',
    label: '서울↔부산 KTX',
    km: 420,
    singularUnit: '번 왕복',
    percentUnit: '% 달성',
    format: (n) => n >= 2 ? `${Math.floor(n / 2)}번 왕복` : `${Math.floor(n)}번 완주`,
  },
  {
    emoji: '🏖️',
    label: '제주 올레길',
    km: 425,
    singularUnit: '번 완주',
    percentUnit: '% 달성',
    format: (n) => n >= 1 ? `${Math.floor(n)}번 완주` : `${Math.round(n * 100)}% 달성`,
  },
];

export function getExpressions(mileage: number, count = 2): { emoji: string; label: string; text: string; ratio: number; km: number }[] {
  // 풀마라톤처럼 너무 작거나(1번도 못 채우는 경우) 에베레스트처럼 너무 큰 수는 상황에 맞게 필터
  const usable = EXPRESSIONS.filter((e) => {
    const n = mileage / e.km;
    return n >= 0.05; // 5% 이상은 표시
  });

  // 매번 다른 조합이 나오도록 shuffle
  const shuffled = [...usable].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((e) => ({
    emoji: e.emoji,
    label: e.label,
    text: e.format(mileage / e.km),
    ratio: mileage / e.km,
    km: e.km,
  }));
}
