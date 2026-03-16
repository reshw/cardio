# Voice Workout Log - Architecture

이 문서는 Voice Workout Log의 시스템 아키텍처를 상세히 설명합니다.

---

## 목차
1. [시스템 아키텍처 개요](#시스템-아키텍처-개요)
2. [레이어 구조](#레이어-구조)
3. [주요 컴포넌트](#주요-컴포넌트)
4. [데이터 플로우](#데이터-플로우)
5. [보안 아키텍처](#보안-아키텍처)
6. [상태 관리](#상태-관리)
7. [에러 처리](#에러-처리)
8. [성능 최적화](#성능-최적화)
9. [확장성 고려사항](#확장성-고려사항)

---

## 시스템 아키텍처 개요

Voice Workout Log는 **3-Tier 아키텍처**를 기반으로 한 SPA(Single Page Application)입니다.

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (React Components, Pages, UI)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Application Layer               │
│  (Hooks, Services, Features, Utils)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Data Layer                      │
│  (Supabase Storage, Local Storage)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         External Services               │
│  (Supabase, Kakao, Gemini, OpenAI)      │
└─────────────────────────────────────────┘
```

### 핵심 설계 원칙
1. **관심사의 분리**: UI, 비즈니스 로직, 데이터 계층 명확히 구분
2. **단일 책임 원칙**: 각 모듈은 하나의 명확한 책임만 가짐
3. **의존성 역전**: 상위 레이어가 하위 레이어에 의존하지만, 인터페이스를 통해 결합도 낮춤
4. **테스트 가능성**: 각 레이어를 독립적으로 테스트 가능하도록 설계

---

## 레이어 구조

### 1. Presentation Layer (프레젠테이션 계층)

**위치**: `src/components/`, `src/pages/`

**책임**:
- 사용자 인터페이스 렌더링
- 사용자 입력 처리
- 애플리케이션 상태를 UI로 표현

**주요 컴포넌트**:
- **Pages**: 라우트별 페이지 컴포넌트 (Dashboard, History, TodoList 등)
- **Components**: 재사용 가능한 UI 컴포넌트 (Header, BottomNav 등)

**특징**:
- 비즈니스 로직을 포함하지 않음
- Props를 통한 데이터 전달
- 이벤트 핸들러를 통한 상위 계층과의 통신

**예시**:
```tsx
// History.tsx (페이지 컴포넌트)
function History() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  // 비즈니스 로직은 서비스 계층에 위임
  useEffect(() => {
    if (user) {
      supabaseStorage.getAllLogs(user.id).then(setLogs);
    }
  }, [user]);

  return (
    <div>
      {logs.map(log => (
        <LogCard key={log.id} log={log} />
      ))}
    </div>
  );
}
```

---

### 2. Application Layer (애플리케이션 계층)

**위치**: `src/features/`, `src/services/`, `src/utils/`, `src/hooks/`

**책임**:
- 비즈니스 로직 구현
- 외부 API 호출 및 데이터 변환
- 도메인 규칙 적용

**주요 모듈**:

#### Features (기능 모듈)
도메인별로 그룹화된 기능 구현

- **speech/**: 음성 인식
  - `useSpeechRecognition.ts`: Web Speech API 훅
  - `useWhisperRecording.ts`: Whisper API 녹음 및 전송

- **parse/**: AI 텍스트 파싱
  - `parseWorkoutText.ts`: 메인 파싱 로직
  - `parseWithGPT.ts`: GPT/Gemini API 호출

- **normalize/**: 텍스트 정규화
  - `normalizeText.ts`: 입력 텍스트 정제

#### Services (서비스)
외부 시스템과의 통합

- **authService.ts**: 인증 관련 로직
  - Kakao OAuth 처리
  - Supabase 세션 관리
  - 사용자 생성 및 조회

#### Utils (유틸리티)
공통 헬퍼 함수

- **ai.ts**: AI 공통 유틸리티
- **gemini.ts**: Gemini API 래퍼
- **openai.ts**: OpenAI API 래퍼

**예시**:
```ts
// parseWorkoutText.ts (비즈니스 로직)
export async function parseWorkoutText(text: string): Promise<Workout[]> {
  // 1. 텍스트 정규화
  const normalized = normalizeText(text);

  // 2. AI 파싱 시도
  try {
    const workouts = await parseWithGPT(normalized);
    return workouts;
  } catch (error) {
    console.error('AI parsing failed:', error);
    return [];
  }
}
```

---

### 3. Data Layer (데이터 계층)

**위치**: `src/storage/`, `src/lib/`

**책임**:
- 데이터 영속화
- CRUD 작업
- 데이터 소스 추상화

**주요 모듈**:

#### Storage
- **supabaseStorage.ts**: Supabase 데이터 접근 계층
  - 모든 Supabase 쿼리를 이 파일에 집중
  - RLS 정책 적용된 안전한 데이터 접근

- **logStorage.ts**: (레거시) 로컬 스토리지 (향후 제거 예정)

#### Lib
- **supabase.ts**: Supabase 클라이언트 초기화

**데이터 접근 패턴**:
```ts
// supabaseStorage.ts
export const supabaseStorage = {
  // 운동 기록 조회
  async getAllLogs(userId: string): Promise<WorkoutLog[]> {
    const { data, error } = await supabase
      .from('workout_logs')
      .select(`
        *,
        workouts (*)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return transformToWorkoutLogs(data);
  },

  // 운동 기록 저장
  async saveLog(log: WorkoutLog): Promise<void> {
    // 트랜잭션 로직
    const { data: logData, error: logError } = await supabase
      .from('workout_logs')
      .insert([{ /* log data */ }])
      .select()
      .single();

    if (logError) throw logError;

    // 개별 운동 저장
    const workoutsToInsert = log.workouts.map(workout => ({
      log_id: logData.id,
      ...workout
    }));

    const { error: workoutsError } = await supabase
      .from('workouts')
      .insert(workoutsToInsert);

    if (workoutsError) throw workoutsError;
  }
};
```

---

### 4. External Services Layer

Voice Workout Log는 다음 외부 서비스에 의존합니다:

#### Supabase
- **PostgreSQL**: 데이터 저장
- **Auth**: 인증 및 세션 관리
- **RLS**: Row Level Security로 데이터 격리
- **Storage** (향후): 프로필 이미지 등

#### Kakao API
- **OAuth 2.0**: 소셜 로그인
- **사용자 정보 조회**: 프로필, 이메일

#### Google Generative AI (Gemini)
- **텍스트 생성**: 운동 텍스트 파싱
- **추천 시스템**: 맞춤 운동 루틴 생성

#### OpenAI
- **GPT-4**: 텍스트 파싱 (대체 옵션)
- **Whisper**: 음성-텍스트 변환

---

## 주요 컴포넌트

### 인증 플로우 (AuthContext + authService)

```
User clicks "Kakao Login"
  ↓
Redirect to Kakao OAuth
  ↓
User authorizes
  ↓
Callback to /auth/kakao/callback
  ↓
KakaoCallback.tsx:
  - Extract access_token from URL
  - Call authService.getKakaoUserInfo(token)
  - Call authService.checkUserExistsByKakaoId(kakaoId)
  ↓
If user exists:
  - Create Supabase session
  - Redirect to /dashboard
  ↓
If new user:
  - Redirect to /signup
  - User fills in gender + goals
  - Call authService.registerKakaoUser(userData)
  - Create Supabase session
  - Redirect to /dashboard
```

**AuthContext.tsx**:
```tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase 세션 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Supabase auth user → 우리 DB의 user 조회
          const userData = await authService.getUserBySupabaseId(session.user.id);
          setUser(userData);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

### 음성 입력 플로우

#### Web Speech API (useSpeechRecognition)
```tsx
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'ko-KR';

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    recognitionRef.current?.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, transcript, startListening, stopListening };
}
```

#### Whisper API (useWhisperRecording)
```tsx
export function useWhisperRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];

      // Whisper API로 전송
      const transcript = await transcribeWithWhisper(audioBlob);
      // ... 처리
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return { isRecording, startRecording, stopRecording };
}

async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const data = await response.json();
  return data.text;
}
```

---

### AI 파싱 플로우

```
원본 텍스트: "벤치프레스 80키로 10개씩 3세트"
  ↓
normalizeText() → "벤치프레스 80kg 10reps 3sets"
  ↓
parseWithGPT() → Gemini/GPT API 호출
  ↓
AI 응답: JSON 배열
[
  {
    "name": "벤치프레스",
    "type": "strength",
    "weight_kg": 80,
    "sets": 3,
    "reps": 10
  }
]
  ↓
TypeScript Workout[] 객체로 변환
```

**parseWithGPT.ts**:
```ts
export async function parseWithGPT(text: string): Promise<Workout[]> {
  const prompt = `
다음 운동 기록 텍스트를 JSON 배열로 파싱하세요.

입력: "${text}"

출력 형식:
[
  {
    "name": "운동 이름",
    "type": "strength" | "cardio" | "stretching" | "sports",
    "sets": 숫자 또는 null,
    "reps": 숫자 또는 null,
    "weight_kg": 숫자 또는 null,
    "duration_min": 숫자 또는 null,
    "note": "추가 메모 또는 null"
  }
]

반드시 유효한 JSON만 반환하세요.
`;

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const jsonText = response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '');

  const workouts = JSON.parse(jsonText);
  return workouts;
}
```

---

## 데이터 플로우

### 운동 기록 저장 플로우

```
[History.tsx]
  User clicks "음성 입력"
    ↓
  useSpeechRecognition.startListening()
    ↓
  Web Speech API → transcript
    ↓
  User clicks "파싱"
    ↓
  parseWorkoutText(transcript)
    ↓
  [parseWorkoutText.ts]
    normalizeText(transcript)
      ↓
    parseWithGPT(normalized)
      ↓
    [parseWithGPT.ts]
      Gemini API call
        ↓
      JSON response → Workout[]
    ↓
  [History.tsx]
    User confirms parsed workouts
      ↓
    supabaseStorage.saveLog({ date, workouts, rawText, ... })
      ↓
    [supabaseStorage.ts]
      INSERT into workout_logs
        ↓
      INSERT into workouts (batch)
        ↓
      SUCCESS
    ↓
  [History.tsx]
    Show success message
    Refresh logs list
```

### 운동 추천 플로우

```
[Recommend.tsx]
  User clicks "추천 받기"
    ↓
  Load user profile + recent workout logs
    ↓
  Build context:
    - User goals: "근력 향상, 주 5회 운동"
    - Recent workouts: [벤치프레스, 스쿼트, ...]
    ↓
  Call Gemini API with prompt:
    "사용자의 목표와 최근 운동 이력을 기반으로
     오늘의 운동 루틴을 추천해주세요."
    ↓
  Gemini response:
    "오늘은 하체 운동을 추천합니다.
     1. 스쿼트 80kg 12reps 4sets
     2. 레그프레스 120kg 10reps 3sets
     ..."
    ↓
  Display recommendation
    ↓
  User clicks "투두에 추가"
    ↓
  Parse AI response → DailyTodo object
    ↓
  Save to local state or Supabase (향후)
```

---

## 보안 아키텍처

### Row Level Security (RLS)

Supabase RLS를 통해 데이터 격리 및 접근 제어.

#### users 테이블
```sql
-- 사용자는 자신의 레코드만 읽기 가능
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- 사용자는 자신의 레코드만 수정 가능
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

#### workout_logs 테이블
```sql
-- 사용자는 자신의 로그만 읽기 가능
CREATE POLICY "Users can read own logs"
  ON workout_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 로그만 삽입 가능
CREATE POLICY "Users can insert own logs"
  ON workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 로그만 수정 가능
CREATE POLICY "Users can update own logs"
  ON workout_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 로그만 삭제 가능
CREATE POLICY "Users can delete own logs"
  ON workout_logs FOR DELETE
  USING (auth.uid() = user_id);
```

#### workouts 테이블
```sql
-- 사용자는 자신의 로그에 속한 운동만 읽기 가능
CREATE POLICY "Users can read own workouts"
  ON workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = workouts.log_id
        AND workout_logs.user_id = auth.uid()
    )
  );

-- 삽입/수정/삭제도 동일한 패턴
```

### 인증 보안

#### Kakao OAuth 플로우
1. **Authorization Code Grant** 사용 (가장 안전한 OAuth 플로우)
2. **Access Token은 서버에서만 사용** (프론트엔드에서 최소 노출)
3. **Supabase Session으로 변환** 후 JWT 토큰 사용

#### 환경 변수 보안
- API 키는 `.env` 파일에 저장
- `.env`는 `.gitignore`에 포함
- 프로덕션 환경에서는 환경 변수로 주입

#### CORS 정책
- Supabase는 허용된 도메인에서만 접근 가능
- Kakao OAuth Redirect URI는 화이트리스트 등록 필요

---

## 상태 관리

### 로컬 상태 (useState)
컴포넌트 내부에서만 사용하는 UI 상태
- 폼 입력값
- 모달 열림/닫힘
- 로딩 스피너

### Context API (AuthContext)
전역적으로 공유해야 하는 상태
- 현재 로그인 사용자
- 인증 로딩 상태

### 서버 상태 (Supabase)
백엔드에서 관리하는 데이터
- 운동 기록
- 사용자 프로필
- (현재는 직접 fetch, 향후 React Query 도입 고려)

### 상태 관리 패턴
```tsx
// ❌ 나쁜 예: 서버 상태를 로컬 상태로 중복 관리
const [user, setUser] = useState(null);
useEffect(() => {
  fetchUser().then(setUser);
}, []);

// ✅ 좋은 예: Context로 전역 관리
const { user } = useAuth();

// ✅ 더 좋은 예: React Query (향후)
const { data: user, isLoading } = useQuery('user', fetchUser);
```

---

## 에러 처리

### 계층별 에러 처리 전략

#### Data Layer
```ts
export async function getAllLogs(userId: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch logs:', error);
    throw new Error('운동 기록을 불러올 수 없습니다.');
  }

  return data;
}
```

#### Application Layer
```ts
export async function parseWorkoutText(text: string): Promise<Workout[]> {
  try {
    return await parseWithGPT(text);
  } catch (error) {
    console.error('AI parsing failed:', error);
    // 폴백: 빈 배열 또는 기본 파싱
    return [];
  }
}
```

#### Presentation Layer
```tsx
function History() {
  const [error, setError] = useState<string | null>(null);

  const handleSaveLog = async (log: WorkoutLog) => {
    try {
      await supabaseStorage.saveLog(log);
      alert('저장되었습니다!');
    } catch (error) {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div>
      {error && <ErrorMessage message={error} />}
      {/* ... */}
    </div>
  );
}
```

### 에러 타입별 처리

| 에러 유형 | 처리 방법 |
|---------|---------|
| 네트워크 에러 | 재시도 로직 + 사용자에게 안내 |
| 인증 에러 | 로그아웃 후 로그인 페이지로 리디렉션 |
| 권한 에러 | 403 에러 표시 + 고객센터 안내 |
| 유효성 검증 실패 | 폼 필드별 에러 메시지 |
| AI API 에러 | 폴백 파싱 또는 수동 입력 안내 |

---

## 성능 최적화

### 현재 적용된 최적화

#### 1. 코드 스플리팅
```tsx
// React.lazy로 페이지별 코드 스플리팅
const Dashboard = lazy(() => import('./pages/Dashboard'));
const History = lazy(() => import('./pages/History'));
```

#### 2. 데이터베이스 쿼리 최적화
```ts
// ✅ 관계 데이터를 한 번에 조회 (N+1 문제 방지)
const { data } = await supabase
  .from('workout_logs')
  .select(`
    *,
    workouts (*)
  `)
  .eq('user_id', userId);

// ❌ 나쁜 예: 각 로그마다 별도 쿼리
for (const log of logs) {
  const workouts = await supabase
    .from('workouts')
    .select('*')
    .eq('log_id', log.id);
}
```

#### 3. 인덱스 활용
```sql
-- workout_logs 테이블에 복합 인덱스
CREATE INDEX idx_workout_logs_user_date
  ON workout_logs(user_id, date DESC);

-- 자주 조인되는 외래 키에 인덱스
CREATE INDEX idx_workouts_log_id
  ON workouts(log_id);
```

### 향후 최적화 계획

#### 1. React Query 도입
```tsx
// 캐싱, 재시도, 낙관적 업데이트 등
const { data: logs } = useQuery(
  ['logs', userId],
  () => supabaseStorage.getAllLogs(userId),
  {
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    cacheTime: 10 * 60 * 1000,
  }
);
```

#### 2. 무한 스크롤 (Pagination)
```tsx
const { data, fetchNextPage } = useInfiniteQuery(
  ['logs', userId],
  ({ pageParam = 0 }) => supabaseStorage.getLogsPaginated(userId, pageParam),
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

#### 3. 이미지 최적화 (향후 프로필 이미지 추가 시)
- WebP 형식 사용
- Lazy loading
- Thumbnail 생성

---

## 확장성 고려사항

### 1. 클럽 시스템 추가 시 아키텍처

#### 데이터 모델
```sql
-- 클럽 테이블
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 클럽 멤버 테이블
CREATE TABLE club_members (
  club_id UUID REFERENCES clubs(id),
  user_id UUID REFERENCES users(id),
  role TEXT CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

-- 공유된 운동 기록
CREATE TABLE shared_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID REFERENCES workout_logs(id),
  club_id UUID REFERENCES clubs(id),
  shared_by UUID REFERENCES users(id),
  shared_at TIMESTAMPTZ DEFAULT now()
);
```

#### RLS 정책 (멀티테넌트)
```sql
-- 클럽 멤버만 클럽 데이터 읽기 가능
CREATE POLICY "Club members can read club data"
  ON clubs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = clubs.id
        AND club_members.user_id = auth.uid()
    )
  );

-- 공유된 운동 기록은 클럽 멤버만 조회 가능
CREATE POLICY "Club members can read shared workouts"
  ON shared_workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = shared_workouts.club_id
        AND club_members.user_id = auth.uid()
    )
  );
```

#### Real-time 기능 (Supabase Realtime)
```tsx
// 클럽 피드 실시간 업데이트
useEffect(() => {
  const subscription = supabase
    .channel('club-feed')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'shared_workouts',
        filter: `club_id=eq.${clubId}`
      },
      (payload) => {
        setFeed(prev => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [clubId]);
```

### 2. 성능 확장

#### 데이터베이스 샤딩 (향후 대규모 확장 시)
- 사용자 ID 기반 수평 샤딩
- 클럽 ID 기반 샤딩 (클럽 데이터)

#### CDN 활용
- 정적 자산 (이미지, CSS, JS)
- Vercel/Netlify Edge Functions

#### 캐싱 전략
- Redis for session storage (향후)
- Service Worker for offline support (PWA)

### 3. 모니터링 및 로깅

#### 향후 도입 계획
- **Sentry**: 에러 모니터링
- **Google Analytics**: 사용자 행동 분석
- **Supabase Logs**: 데이터베이스 쿼리 성능 모니터링

---

## 개발 워크플로우

### 로컬 개발
```bash
npm install
npm run dev  # Vite dev server on http://localhost:5173
```

### 빌드
```bash
npm run build  # TypeScript 컴파일 + Vite 빌드
```

### 배포
1. Vercel/Netlify에 연결
2. 환경 변수 설정
3. Git push → 자동 배포

---

## 참고 자료

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**이 문서는 프로젝트 진화에 따라 지속적으로 업데이트됩니다.**
