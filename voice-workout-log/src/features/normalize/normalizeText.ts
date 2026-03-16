interface NormalizationRule {
  pattern: RegExp;
  replacement: string;
}

const normalizationRules: NormalizationRule[] = [
  // 스포츠 활동
  { pattern: /스노우\s*보드|스노\s*보딩|보드\s*타기|보딩/g, replacement: '스노보드' },

  // 유산소 운동
  { pattern: /런닝|러닝|조깅/g, replacement: '달리기' },
  { pattern: /사이클|자전거/g, replacement: '사이클' },
  { pattern: /로잉|로우잉/g, replacement: '로잉' },

  // 웨이트 트레이닝
  { pattern: /사레레|사례를|사레/g, replacement: '사이드 레터럴 레이즈' },
  { pattern: /데드\s*버그|데드북/g, replacement: '데드버그' },
  { pattern: /천국의\s*계단/g, replacement: '스텝밀' },
  { pattern: /랫\s*풀다운|랫풀/g, replacement: '랫풀다운' },
  { pattern: /푸쉬업|팔굽혀/g, replacement: '푸시업' },
  { pattern: /플랭크/g, replacement: '플랭크' },
  { pattern: /사이드\s*플랭크|사플/g, replacement: '사이드플랭크' },
  { pattern: /카프(\s*레이즈)?/g, replacement: '카프레이즈' },
  { pattern: /로우/g, replacement: '로우' },

  // 강도/스타일 표현 정규화
  { pattern: /빡세게|하드하게|빡시게/g, replacement: '빡세게' },
  { pattern: /가볍게|라이트하게|여유롭게/g, replacement: '가볍게' },
];

export const normalizeText = (text: string): string => {
  let normalized = text.trim();

  for (const rule of normalizationRules) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }

  return normalized;
};

export const getKnownExercises = (): string[] => {
  return [
    // 스포츠 활동
    '스노보드',

    // 유산소 운동
    '달리기',
    '사이클',
    '로잉',

    // 근력 운동
    '사이드 레터럴 레이즈',
    '데드버그',
    '스텝밀',
    '랫풀다운',
    '푸시업',
    '플랭크',
    '사이드플랭크',
    '카프레이즈',
    '로우',
    '벤치프레스',
    '스쿼트',
    '데드리프트',
    '풀업',
    '친업',
    '덤벨컬',
    '트라이셉스',
    '레그프레스',
    '레그컬',
    '레그익스텐션',
    '숄더프레스',

    // 유산소/기능성 운동
    '버피',
    '마운틴클라이머',
    '점핑잭',
  ];
};
