# Voice Workout Log - Project Overview

## 프로젝트 개요

Voice Workout Log는 **음성 인식 기반 운동 기록 관리 웹 애플리케이션**입니다. 사용자가 음성으로 운동 내역을 입력하면 AI가 이를 파싱하여 구조화된 데이터로 저장하고, 통계 및 추천 기능을 제공합니다.

### 핵심 가치 제안
- **빠른 입력**: 음성으로 운동을 기록하여 입력 시간 단축
- **AI 파싱**: 자연어를 구조화된 운동 데이터로 자동 변환
- **개인화**: 사용자별 운동 목표 및 추천 시스템
- **카카오 통합**: 간편한 소셜 로그인

---

## 주요 기능

### 1. 음성 입력 및 AI 파싱
- **Web Speech API**: 브라우저 내장 음성 인식 (기본)
- **Whisper API**: OpenAI Whisper를 통한 고급 음성 인식 (옵션)
- **AI 텍스트 파싱**: GPT 또는 Gemini가 자연어를 운동 데이터로 변환
  - 예: "벤치프레스 80키로 10개씩 3세트 했어" → 구조화된 Workout 객체

### 2. 운동 기록 관리
- 운동 기록 저장 및 조회 (CRUD)
- 날짜별 운동 내역 조회
- 운동 타입별 분류 (근력, 유산소, 스트레칭, 스포츠)

### 3. 대시보드 및 통계
- 월별 운동 통계 (총 운동 일수, 시간, 볼륨 등)
- 캘린더 뷰: 운동한 날짜 시각화
- 운동 타입별 분포 차트

### 4. AI 기반 운동 추천
- 사용자의 운동 이력 및 목표를 기반으로 AI가 맞춤 추천
- 오늘의 추천 운동 루틴 생성

### 5. 일일 운동 목표 관리 (Todo List)
- AI 추천 또는 수동으로 오늘의 운동 목표 설정
- 운동 완료 체크 및 진행률 추적

### 6. 인증 시스템
- Kakao OAuth 기반 소셜 로그인
- 회원가입 시 성별, 운동 목표 입력
- Supabase Auth 통합

---

## 기술 스택

### 프론트엔드
- **React 19.2.0**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구 및 개발 서버
- **React Router v7**: SPA 라우팅

### 백엔드 & 인프라
- **Supabase**:
  - PostgreSQL 데이터베이스
  - Row Level Security (RLS) 기반 보안
  - Auth (소셜 로그인 통합)
  - Real-time 기능 (현재 미사용, 향후 클럽 기능에 활용 가능)

### AI & 음성 인식
- **Google Generative AI (Gemini)**: 텍스트 파싱 및 운동 추천
- **OpenAI API**:
  - GPT-4: 텍스트 파싱 (대체 옵션)
  - Whisper: 음성-텍스트 변환 (고급 기능)
- **Web Speech API**: 브라우저 내장 음성 인식 (기본 기능)

### 인증
- **Kakao OAuth 2.0**: 소셜 로그인

---

## 프로젝트 구조

```
voice-workout-log/
├── src/
│   ├── components/         # 재사용 가능한 UI 컴포넌트
│   │   ├── BottomNav.tsx   # 하단 네비게이션 바
│   │   ├── Header.tsx      # 상단 헤더 (프로필 드롭다운)
│   │   ├── KakaoLogin.tsx  # 카카오 로그인 버튼
│   │   └── KakaoCallback.tsx # 카카오 OAuth 콜백 핸들러
│   │
│   ├── pages/              # 라우트별 페이지 컴포넌트
│   │   ├── Login.tsx       # 로그인 페이지
│   │   ├── Signup.tsx      # 회원가입 페이지
│   │   ├── Dashboard.tsx   # 대시보드 (통계 + 캘린더)
│   │   ├── History.tsx     # 운동 기록 이력 및 추가
│   │   ├── TodoList.tsx    # 일일 운동 목표 관리
│   │   ├── Recommend.tsx   # AI 운동 추천
│   │   ├── PrivacyPolicy.tsx
│   │   └── TermsOfService.tsx
│   │
│   ├── features/           # 기능별 모듈
│   │   ├── speech/         # 음성 인식 관련
│   │   │   ├── useSpeechRecognition.ts  # Web Speech API 훅
│   │   │   └── useWhisperRecording.ts   # Whisper 녹음 훅
│   │   ├── parse/          # AI 텍스트 파싱
│   │   │   ├── parseWorkoutText.ts      # 메인 파싱 로직
│   │   │   └── parseWithGPT.ts          # GPT/Gemini 파싱
│   │   └── normalize/
│   │       └── normalizeText.ts         # 텍스트 정규화
│   │
│   ├── services/           # 외부 서비스 연동
│   │   └── authService.ts  # 인증 서비스 (Kakao + Supabase)
│   │
│   ├── storage/            # 데이터 저장소 계층
│   │   ├── supabaseStorage.ts  # Supabase CRUD 작업
│   │   └── logStorage.ts       # (레거시/로컬) 스토리지
│   │
│   ├── utils/              # 유틸리티 함수
│   │   ├── ai.ts           # AI 공통 유틸
│   │   ├── gemini.ts       # Gemini API 래퍼
│   │   └── openai.ts       # OpenAI API 래퍼
│   │
│   ├── contexts/           # React Context
│   │   └── AuthContext.tsx # 인증 상태 관리
│   │
│   ├── lib/                # 외부 라이브러리 초기화
│   │   └── supabase.ts     # Supabase 클라이언트 설정
│   │
│   ├── types/              # TypeScript 타입 정의
│   │   ├── index.ts        # 주요 도메인 타입
│   │   └── speech.d.ts     # Web Speech API 타입
│   │
│   ├── config/             # 설정 파일
│   │   └── features.ts     # 기능 플래그
│   │
│   ├── App.tsx             # 메인 앱 컴포넌트 (라우팅)
│   └── main.tsx            # 앱 진입점
│
├── docs/                   # 프로젝트 문서
│   ├── README.md           # 문서 네비게이션
│   ├── PROJECT_OVERVIEW.md # 이 파일
│   ├── ARCHITECTURE.md     # 아키텍처 상세 설명
│   └── database/
│       ├── schema.sql      # 데이터베이스 스키마
│       └── migrations/     # 마이그레이션 스크립트
│
├── public/                 # 정적 파일
├── .env                    # 환경 변수 (API 키 등)
└── package.json            # 프로젝트 의존성
```

---

## 데이터베이스 스키마

### 주요 테이블

#### 1. users
사용자 정보 (Supabase Auth와 연동)
- `id` (UUID, PK): Supabase Auth 사용자 ID
- `kakao_id` (BIGINT, UNIQUE): 카카오 사용자 ID
- `email` (TEXT): 이메일
- `name` (TEXT): 이름
- `gender` (TEXT): 성별 (male/female/other)
- `created_at` (TIMESTAMPTZ): 가입일

#### 2. workout_logs
운동 기록 로그 (일별 단위)
- `id` (UUID, PK): 로그 ID
- `user_id` (UUID, FK → users): 사용자 ID
- `date` (DATE): 운동 날짜
- `raw_text` (TEXT): 원본 입력 텍스트
- `normalized_text` (TEXT): 정규화된 텍스트
- `memo` (TEXT): 메모
- `created_at` (TIMESTAMPTZ): 생성일

#### 3. workouts
개별 운동 상세 정보 (운동 로그 내 각 운동)
- `id` (UUID, PK): 운동 ID
- `log_id` (UUID, FK → workout_logs): 로그 ID
- `name` (TEXT): 운동 이름 (예: 벤치프레스)
- `type` (TEXT): 운동 타입 (strength/cardio/stretching/sports)
- `sets` (INT): 세트 수
- `reps` (INT): 반복 횟수
- `weight_kg` (DECIMAL): 중량 (kg)
- `duration_min` (INT): 운동 시간 (분)
- `note` (TEXT): 운동별 노트
- `created_at` (TIMESTAMPTZ): 생성일

#### 4. user_profiles
사용자 운동 목표 및 프로필
- `user_id` (UUID, PK, FK → users): 사용자 ID
- `goals` (TEXT): 운동 목표
- `current_weight_kg` (DECIMAL): 현재 체중
- `target_weight_kg` (DECIMAL): 목표 체중
- `height_cm` (DECIMAL): 키
- `weekly_workout_days` (INT): 주간 목표 운동일
- `updated_at` (TIMESTAMPTZ): 수정일

### 보안: Row Level Security (RLS)
모든 테이블에 RLS 정책 적용:
- 사용자는 **자신의 데이터만** 읽기/쓰기 가능
- `auth.uid() = user_id` 조건으로 격리

상세 스키마는 `docs/database/schema.sql` 참조

---

## 주요 데이터 플로우

### 1. 운동 기록 입력 플로우
```
사용자 음성 입력
  ↓
음성 인식 (Web Speech API / Whisper)
  ↓
텍스트 변환
  ↓
텍스트 정규화 (normalizeText)
  ↓
AI 파싱 (Gemini/GPT) → 구조화된 Workout 객체 배열
  ↓
Supabase 저장 (workout_logs + workouts)
```

### 2. 운동 추천 플로우
```
사용자 요청
  ↓
사용자 프로필 + 최근 운동 이력 조회
  ↓
Gemini/GPT에 컨텍스트 전달
  ↓
AI가 맞춤 운동 루틴 생성
  ↓
사용자에게 표시 (Todo로 저장 가능)
```

### 3. 인증 플로우
```
Kakao 로그인 버튼 클릭
  ↓
Kakao OAuth 인증 페이지로 리디렉션
  ↓
사용자 동의 후 콜백
  ↓
Access Token으로 Kakao 사용자 정보 조회
  ↓
Supabase에 사용자 존재 여부 확인
  ↓
신규 사용자 → 회원가입 페이지
기존 사용자 → Supabase 세션 생성 후 대시보드
```

---

## 환경 변수 (.env)

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Kakao OAuth
VITE_KAKAO_CLIENT_ID=your-kakao-client-id
VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/kakao/callback

# AI APIs
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_OPENAI_API_KEY=your-openai-api-key
```

---

## API 엔드포인트 (Supabase)

### Storage Layer (supabaseStorage.ts)

#### 운동 기록 관련
- `getAllLogs(userId: string)`: 사용자의 모든 운동 기록 조회
- `getLogById(logId: string)`: 특정 로그 상세 조회
- `saveLog(log: WorkoutLog)`: 운동 기록 저장 (log + workouts)
- `deleteLog(logId: string)`: 운동 기록 삭제

#### 사용자 프로필 관련
- `getUserProfile(userId: string)`: 사용자 프로필 조회
- `saveUserProfile(profile: UserProfile)`: 프로필 저장/수정
- `deleteUserProfile(userId: string)`: 프로필 삭제

### Auth Service (authService.ts)

- `getKakaoUserInfo(accessToken: string)`: Kakao API로 사용자 정보 조회
- `checkUserExistsByKakaoId(kakaoId: string)`: 카카오 ID로 사용자 존재 여부 확인
- `registerKakaoUser(userData: KakaoUserData)`: 카카오 사용자 회원가입
- `getUserByKakaoId(kakaoId: string)`: 카카오 ID로 사용자 조회
- `updateUserProfile(userId: string, updates: Partial<User>)`: 사용자 정보 수정

---

## 사용자 인터페이스

### 네비게이션 구조
하단 네비게이션 바 (BottomNav):
1. **대시보드**: 통계 + 캘린더
2. **기록**: 운동 기록 추가 및 조회
3. **투두**: 오늘의 운동 목표
4. **추천**: AI 운동 추천

### 주요 화면

#### Login.tsx
- 카카오 로그인 버튼
- 개인정보처리방침 / 이용약관 링크

#### Signup.tsx
- 카카오 인증 후 추가 정보 입력
- 성별, 운동 목표 입력 후 회원가입 완료

#### Dashboard.tsx
- 이번 달 운동 통계 (일수, 시간, 볼륨 등)
- 캘린더: 운동한 날짜 표시
- 운동 타입별 분포 차트

#### History.tsx
- 날짜별 운동 기록 목록
- 음성 입력 버튼 (Web Speech / Whisper 선택 가능)
- 기록 추가/수정/삭제

#### TodoList.tsx
- 오늘의 운동 목표 목록
- AI 추천으로 자동 생성 또는 수동 추가
- 완료 체크 기능

#### Recommend.tsx
- AI가 생성한 맞춤 운동 루틴
- 루틴을 투두로 추가 가능

---

## 코드 컨벤션 및 패턴

### 타입 정의
모든 도메인 모델은 `src/types/index.ts`에 정의:
- `User`, `WorkoutLog`, `Workout`, `UserProfile`, `DailyTodo` 등

### 상태 관리
- React Context (AuthContext): 인증 상태 전역 관리
- 로컬 상태: `useState`, `useEffect`
- 서버 상태: Supabase 직접 호출 (향후 React Query 도입 고려 가능)

### 에러 처리
- 주요 API 호출은 try-catch로 감싸기
- 사용자에게 친화적인 에러 메시지 표시
- 콘솔에 상세 에러 로그

### 코드 스타일
- ESLint + TypeScript ESLint 사용
- 함수형 컴포넌트 + Hooks
- 명확한 변수명 및 함수명 사용

---

## 현재 구현 상태

### ✅ 완료된 기능
- [x] Kakao OAuth 로그인/회원가입
- [x] 음성 인식 운동 입력 (Web Speech + Whisper)
- [x] AI 텍스트 파싱 (Gemini/GPT)
- [x] 운동 기록 CRUD
- [x] 대시보드 통계 및 캘린더
- [x] AI 기반 운동 추천
- [x] 일일 운동 목표 관리
- [x] 반응형 UI
- [x] RLS 보안 정책

### 🚧 진행 중 / 계획
- [ ] **클럽/동호회 시스템** (멀티테넌트)
  - 클럽 생성 및 가입
  - 클럽원 간 운동 내역 공유
  - 합산 챌린지 (그룹 목표 달성)
  - 리더보드
- [ ] 소셜 기능
  - 운동 기록 피드
  - 좋아요/댓글
  - 팔로우 시스템
- [ ] 고급 통계
  - PR (Personal Record) 추적
  - 운동별 성장 그래프
  - 주간/월간 리포트
- [ ] 푸시 알림
  - 운동 목표 리마인더
  - 클럽 활동 알림
- [ ] PWA (Progressive Web App)
  - 오프라인 지원
  - 모바일 앱처럼 설치 가능

---

## 클럽 시스템 계획 (향후 개발)

### 목표
사용자들이 **동호회/클럽**을 만들어 운동 내역을 공유하고, 함께 챌린지를 수행하는 소셜 피트니스 플랫폼으로 확장.

### 핵심 기능 (예정)
1. **클럽 관리**
   - 클럽 생성 (이름, 설명, 공개/비공개)
   - 멤버 초대 및 승인
   - 역할 관리 (오너, 관리자, 멤버)

2. **운동 내역 공유**
   - 클럽 피드: 멤버들의 운동 기록 타임라인
   - 반응 (좋아요, 응원 메시지)

3. **합산 챌린지**
   - 그룹 목표 설정 (예: 이번 달 총 1,000km 달리기)
   - 개인 기여도 추적
   - 실시간 진행률 대시보드
   - 챌린지 완료 시 배지/보상

4. **리더보드**
   - 클럽 내 개인 순위
   - 기간별 (주간/월간) 랭킹
   - 운동 타입별 순위

### 기술적 고려사항
- **멀티테넌트 RLS**: 클럽 멤버만 해당 클럽 데이터 접근
- **Real-time 업데이트**: Supabase Realtime으로 챌린지 진행률 동기화
- **알림 시스템**: 클럽 활동 및 챌린지 마일스톤 알림
- **확장성**: 클럽 규모 확대 시 인덱싱 및 쿼리 최적화

---

## 배포 및 운영

### 개발 환경
```bash
npm install
npm run dev  # http://localhost:5173
```

### 프로덕션 빌드
```bash
npm run build
npm run preview
```

### 배포 플랫폼 (예시)
- **Vercel** / **Netlify**: 정적 호스팅
- **Supabase**: 백엔드 및 데이터베이스
- **Kakao Developers**: OAuth 앱 등록

---

## 문서 네비게이션

- [프로젝트 개요](./PROJECT_OVERVIEW.md) ← 현재 문서
- [아키텍처 상세](./ARCHITECTURE.md)
- [데이터베이스 스키마](./database/schema.sql)
- [마이그레이션 가이드](./database/migrations/MIGRATION_GUIDE.md)

---

## 기여 및 문의

이 프로젝트는 개인 프로젝트이며, AI (Gemini, GPT)와의 협업을 통해 기획 및 개발 중입니다.

향후 오픈소스화를 고려 중입니다.
