# 마일리지 계수 자동 보정 시스템 구축 완료

## 🎯 해결된 문제

### AS-IS (문제 상황)
- 기존 클럽: DB 기본값(6개 항목만) → 복싱/요가 없음 → 설정 페이지 에러
- 신규 운동 추가 시 매번 수동 업데이트 필요
- DB 스키마와 코드의 불일치

### TO-BE (해결 방안)
1. **자동 보정 시스템**
   - 없는 계수는 0으로 자동 설정 (비활성화)
   - 새 운동 추가 시 자동 대응
   - DB와 코드 일관성 유지

2. **명시적 설정**
   - 클럽 생성 시 전체 계수 명시적 저장
   - 로드 시 자동 보정 적용

---

## 📝 변경 사항

### 1. `src/services/clubService.ts`

#### 1.1 새 함수: `normalizeMileageConfig()`
```typescript
// 불완전한 마일리지 계수 보정
normalizeMileageConfig(partialConfig?: Partial<MileageConfig> | null): MileageConfig {
  const defaultConfig = this.getDefaultMileageConfig();
  if (!partialConfig) return defaultConfig;

  const normalized = { ...defaultConfig };
  for (const key in normalized) {
    if (key in partialConfig) {
      // 기존 값 유지
      normalized[key] = partialConfig[key];
    } else {
      // 없는 항목은 0 (비활성화)
      normalized[key] = 0;
    }
  }
  return normalized;
}
```

**동작 원리:**
- 기존 클럽: `{달리기: 1, 사이클: 3}` → `{달리기: 1, 사이클: 3, 복싱: 0, 요가: 0}`
- 신규 클럽: 전체 항목 기본값 적용
- 미래 운동 추가: 자동으로 0 설정

#### 1.2 `createClub()` 수정
```typescript
// BEFORE
enabled_categories: this.getDefaultEnabledCategories(),
// (mileage_config 없음 → DB 기본값 의존)

// AFTER
enabled_categories: this.getDefaultEnabledCategories(),
mileage_config: this.getDefaultMileageConfig(),  // 명시적 설정
```

#### 1.3 `getClubById()` 수정
```typescript
// 클럽 조회 후 자동 보정
if (club) {
  club.mileage_config = this.normalizeMileageConfig(club.mileage_config);
}
return club;
```

---

### 2. `sql/database-clubs.sql` (스키마 기본값 업데이트)

```sql
-- BEFORE (6개 항목, 곱셈 계수)
mileage_config JSONB DEFAULT '{
  "달리기-트레드밀": 1,
  "달리기-러닝": 1,
  "사이클-실외": 0.333,
  "사이클-실내": 0.2,
  "수영": 0.005,
  "계단": 0.05
}'

-- AFTER (10개 항목, 나눗셈 계수)
mileage_config JSONB DEFAULT '{
  "달리기-트레드밀": 1,
  "달리기-러닝": 1,
  "사이클-실외": 3,
  "사이클-실내": 5,
  "수영": 200,
  "계단": 20,
  "복싱-샌드백/미트": 1.78,
  "복싱-스파링": 0.77,
  "요가-일반": 3.27,
  "요가-빈야사/아쉬탕가": 2.45
}'
```

---

### 3. `sql/migrate-fix-incomplete-mileage-config.sql` (신규 마이그레이션 파일)

**용도:** 기존 클럽들의 불완전한 mileage_config 보정

**실행 내용:**
1. 복싱/요가 항목 추가 (기본값 0)
2. enabled_categories가 NULL인 경우 전체 카테고리 설정
3. 결과 확인 쿼리

---

## 🚀 배포 절차

### Step 1: DB 마이그레이션 실행
```bash
# Supabase SQL Editor에서 실행
sql/migrate-fix-incomplete-mileage-config.sql
```

**예상 결과:**
- 기존 클럽: 복싱/요가 계수 = 0 추가
- enabled_categories NULL → 전체 카테고리로 설정

### Step 2: 코드 배포
```bash
git add .
git commit -m "fix: add auto-normalization for mileage config

- Add normalizeMileageConfig() to handle incomplete configs
- Set mileage_config explicitly on club creation
- Auto-normalize on club load (getClubById)
- Update DB schema default to include all 10 categories
- Add migration script for existing clubs"
git push
```

### Step 3: 테스트
1. **기존 클럽 테스트**
   - 마일리지 계수 설정 페이지 접속
   - 복싱/요가 항목이 0으로 표시되는지 확인
   - 체크박스 해제 상태인지 확인

2. **신규 클럽 생성**
   - 클럽 생성 → DB 확인
   - mileage_config에 10개 항목 모두 존재하는지 확인

3. **계수 변경 테스트**
   - 복싱 계수를 1.78로 변경
   - enabled_categories에 복싱 추가
   - 저장 후 재조회 시 값 유지되는지 확인

---

## 🔄 향후 확장성

### 새 운동 타입 추가 시 (예: "클라이밍")

1. **MileageConfig 타입 확장**
```typescript
export interface MileageConfig {
  '달리기-트레드밀': number;
  ...
  '클라이밍': number;  // 추가
}
```

2. **getDefaultMileageConfig() 업데이트**
```typescript
getDefaultMileageConfig(): MileageConfig {
  return {
    ...
    '클라이밍': 0.5,  // 예: 2m당 1 마일리지
  };
}
```

3. **자동 처리**
   - 기존 클럽 로드 시: `normalizeMileageConfig()`가 클라이밍을 0으로 자동 추가
   - 신규 클럽: 0.5 기본값 적용
   - **별도 마이그레이션 불필요!**

---

## 📋 체크리스트

- [x] normalizeMileageConfig() 함수 추가
- [x] createClub() mileage_config 명시
- [x] getClubById() 자동 보정 적용
- [x] DB 스키마 기본값 업데이트
- [x] 마이그레이션 스크립트 작성
- [ ] DB 마이그레이션 실행 (Supabase)
- [ ] 코드 배포
- [ ] 기존 클럽 테스트
- [ ] 신규 클럽 생성 테스트

---

## 🎉 기대 효과

1. **안정성**
   - 기존 클럽 설정 페이지 에러 해결
   - 방어적 프로그래밍으로 런타임 에러 방지

2. **확장성**
   - 새 운동 추가 시 자동 대응
   - 마이그레이션 스크립트 불필요

3. **데이터 일관성**
   - DB와 코드 일치
   - 모든 클럽이 동일한 구조 유지
