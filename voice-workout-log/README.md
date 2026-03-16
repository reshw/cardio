# Voice Workout Log

운동 후 "말로" 기록하는 모바일 우선 웹앱입니다.

## 두 가지 모드 지원

### 기본 모드 (무료)
- 브라우저 Web Speech API 음성 인식
- 룰 기반 파싱
- 완전 무료, 로그인 불필요

### AI 모드 (유료)
- Google Gemini 2.0 Flash 음성 인식 (정확도 향상)
- Gemini 2.0 Flash 스마트 파싱 (자연어 이해)
- 무료 또는 저비용 (개인 사용 기준)

## 기능

- 음성 인식을 통한 운동 기록 입력
- 실시간 자막 표시 (기본 모드)
- 운동 용어 자동 정규화
- 스마트 파싱 (세트, 횟수, 시간, 메모 자동 추출)
- 기록 편집 및 재정리
- 날짜별 히스토리 조회
- localStorage 기반 오프라인 저장

## 기술 스택

- React 18
- TypeScript
- Vite
- React Router
- Web Speech API
- Google Gemini API (Gemini 2.0 Flash)

## 실행 방법

### 1. 설치

```bash
npm install
```

### 2. AI 모드 설정 (선택사항)

AI 모드를 사용하려면 Google Gemini API 키가 필요합니다.

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급
2. `.env` 파일 생성:

```bash
cp .env.example .env
```

3. `.env` 파일에 API 키 입력:

```
VITE_GEMINI_API_KEY=your-api-key
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 빌드

```bash
npm run build
```

### 프리뷰

```bash
npm run preview
```

## 브라우저 지원

Web Speech API는 모든 브라우저에서 지원되지 않습니다.

### 지원되는 브라우저

- ✅ Chrome (데스크톱/모바일)
- ✅ Edge (데스크톱/모바일)
- ✅ Safari (iOS 14.5+)
- ✅ Samsung Internet

### 미지원 브라우저

- ❌ Firefox (Web Speech API 미지원)
- ❌ Opera (일부 버전 미지원)

**권장 브라우저**: Chrome 또는 Edge

## 사용 방법

### 1. 음성으로 운동 기록하기

1. 홈 화면의 마이크 버튼을 탭하여 녹음 시작
2. 운동 내용을 말하기 (예: "푸시업 12회 3세트, 플랭크 1분")
3. 마이크 버튼을 다시 탭하여 녹음 종료
4. 자동으로 파싱된 결과 확인

### 2. 기록 편집 및 저장

1. 원문 텍스트를 수정 가능
2. "재정리" 버튼으로 다시 파싱
3. "저장" 버튼으로 localStorage에 저장

### 3. 히스토리 조회

1. 히스토리 페이지에서 날짜별 기록 확인
2. 항목 클릭으로 상세 내용 보기
3. 필요시 기록 삭제

## 정규화 규칙

음성 인식 결과를 운동 용어로 자동 치환합니다:

- "사레레", "사례를", "사레" → "사이드 레터럴 레이즈"
- "데드 버그", "데드북" → "데드버그"
- "천국의 계단" → "스텝밀"
- "랫 풀다운", "랫풀" → "랫풀다운"
- "푸쉬업", "팔굽혀" → "푸시업"
- "플랭크" → "플랭크"
- "사이드 플랭크", "사플" → "사이드플랭크"
- "카프", "카프 레이즈" → "카프레이즈"
- "로우", "로잉" → "로우"
- "런닝", "러닝" → "러닝"

## 파싱 로직

룰 기반으로 텍스트에서 운동 정보를 추출합니다:

- `X분`, `X분간` → duration_min
- `X세트` → sets
- `X회`, `X개` → reps
- `XxY` 형태 (예: 12x3) → reps=12, sets=3
- 운동명은 알려진 용어 사전과 매칭

## 데이터 구조

### WorkoutLog

```typescript
{
  id: string;              // UUID
  date: string;            // YYYY-MM-DD
  rawText: string;         // 원문
  normalizedText: string;  // 정규화된 텍스트
  workouts: Workout[];     // 파싱된 운동 목록
  memo: string | null;     // 전체 메모
  createdAt: number;       // 생성 시각 (timestamp)
}
```

### Workout

```typescript
{
  name: string;
  sets: number | null;
  reps: number | null;
  duration_min: number | null;
  type: 'strength' | 'cardio' | 'core' | 'mobility' | 'unknown';
  note: string | null;
}
```

## 프로젝트 구조

```
src/
├── features/
│   ├── speech/
│   │   ├── useSpeechRecognition.ts      # Web Speech API 훅
│   │   └── useWhisperRecording.ts       # Gemini 음성 인식 훅
│   ├── normalize/
│   │   └── normalizeText.ts             # 텍스트 정규화
│   └── parse/
│       ├── parseWorkoutText.ts          # 룰 기반 파싱
│       └── parseWithGPT.ts              # Gemini 파싱
├── storage/
│   └── logStorage.ts                    # localStorage 관리
├── utils/
│   └── gemini.ts                        # Gemini API 유틸리티
├── pages/
│   ├── Home.tsx                         # 홈/녹음 페이지
│   ├── History.tsx                      # 히스토리 페이지
│   └── Recommend.tsx                    # AI 운동 추천 페이지
├── types/
│   ├── index.ts                         # TypeScript 타입 정의
│   └── speech.d.ts                      # Web Speech API 타입
├── App.tsx                              # 메인 앱 컴포넌트
├── App.css                              # 스타일
└── main.tsx                             # 엔트리 포인트
```

## AI 모드 비용

Google Gemini API는 무료 티어를 제공합니다:
- Gemini 2.0 Flash: 무료 티어에서 월 1,500 요청 가능
- 개인 사용 기준 (월 30~60회 기록)은 무료 티어 내에서 충분히 사용 가능
- 무료 티어 초과 시에도 비용이 매우 저렴함

자세한 정보: [Google AI Studio Pricing](https://ai.google.dev/pricing)

## 향후 개선 포인트

### AI 기능 확장

- 운동 루틴 추천 (GPT)
- 음성 명령 (시작/종료/저장 등)
- 운동 폼 분석 (이미지/영상 + Vision API)

### 기능 확장

- 백엔드 서버 + 인증 (로그인/회원가입)
- 다중 기기 동기화
- 통계 및 차트 (주간/월간 분석)
- 운동 목표 설정 및 추적
- 이미지/동영상 첨부

### UX 개선

- PWA (Progressive Web App) 변환
- 오프라인 지원 강화
- 다크 모드
- 다국어 지원

## 라이선스

MIT

## 기여

이슈 및 PR은 언제든 환영합니다!
