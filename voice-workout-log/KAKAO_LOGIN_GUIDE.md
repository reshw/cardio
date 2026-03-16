# 카카오 로그인 구현 가이드

## 개요
Voice Workout Log 애플리케이션에 카카오 OAuth 로그인이 구현되었습니다.

## 서비스 정보
- **서비스 주소**: https://undong.lunagd.com
- **리다이렉트 URI**: https://undong.lunagd.com/auth/kakao/callback

## 1. 카카오 개발자 콘솔 설정

### 1.1 애플리케이션 생성
1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속
2. "내 애플리케이션" > "애플리케이션 추가하기" 클릭
3. 앱 이름: `Voice Workout Log` (또는 원하는 이름)
4. 사업자명: `jh308(제이에이치308)`

### 1.2 플랫폼 설정
1. "플랫폼" 탭 선택
2. "Web 플랫폼 등록" 클릭
3. 사이트 도메인: `https://undong.lunagd.com` 입력

### 1.3 카카오 로그인 활성화
1. "카카오 로그인" 메뉴 선택
2. "카카오 로그인 활성화" ON
3. **Redirect URI 등록**:
   - `https://undong.lunagd.com/auth/kakao/callback`
   - `http://localhost:5173/auth/kakao/callback` (개발용)

### 1.4 동의 항목 설정
"카카오 로그인" > "동의 항목" 에서 다음 항목 설정:

#### 필수 동의 항목
- **닉네임**: 필수 동의
- **프로필 사진**: 필수 동의

#### 선택 동의 항목
- **카카오계정 이메일**: 선택 동의
- **이름**: 선택 동의 (실명 필요 시)
- **전화번호**: 선택 동의
- **생년월일**: 선택 동의
- **성별**: 선택 동의

### 1.5 보안 설정
1. "보안" 탭 선택
2. **Client Secret** 발급 (권장)
   - "Client Secret" 생성 클릭
   - "활성화 상태" ON

### 1.6 비즈니스 정보 등록 (선택)
"비즈니스" 탭에서 사업자 정보 등록:
- 사업자명: jh308(제이에이치308)
- 대표자: 양석환
- 사업자번호: 188-17-02548

## 2. 환경 변수 설정

`.env` 파일에 카카오 API 키 추가:

```env
# Kakao OAuth
VITE_KAKAO_REST_API_KEY=your_kakao_rest_api_key_here
VITE_KAKAO_CLIENT_SECRET=your_kakao_client_secret_here
```

### 환경 변수 값 확인
- **REST API 키**: 카카오 개발자 콘솔 > 내 애플리케이션 > 앱 설정 > 앱 키 > "REST API 키"
- **Client Secret**: 카카오 개발자 콘솔 > 내 애플리케이션 > 보안 > Client Secret

## 3. 데이터베이스 마이그레이션

Supabase에서 다음 SQL 스크립트를 실행하여 users 테이블에 카카오 로그인 컬럼 추가:

```bash
# SQL 파일 실행
psql -h your_supabase_host -d postgres -U postgres -f supabase_kakao_login_migration.sql
```

또는 Supabase 대시보드 > SQL Editor에서 `supabase_kakao_login_migration.sql` 파일 내용 실행

추가되는 컬럼:
- `kakao_id`: 카카오 사용자 고유 ID (UNIQUE)
- `provider`: 로그인 제공자 ('local', 'kakao')
- `profile_image`: 프로필 이미지 URL
- `phone_number`: 전화번호
- `birthyear`: 출생년도
- `gender`: 성별
- `nickname`: 카카오 닉네임

## 4. 구현 파일 구조

```
voice-workout-log/
├── src/
│   ├── services/
│   │   └── authService.ts          # 카카오 인증 서비스 (Supabase 연동)
│   ├── components/
│   │   ├── KakaoLogin.tsx          # 카카오 로그인 버튼 컴포넌트
│   │   └── KakaoCallback.tsx       # 카카오 콜백 처리 컴포넌트
│   ├── contexts/
│   │   └── AuthContext.tsx         # 인증 컨텍스트 (카카오 로그인 지원)
│   └── pages/
│       ├── Login.tsx               # 로그인 페이지 (카카오 버튼 포함)
│       └── Signup.tsx              # 회원가입 페이지 (카카오 정보 자동 입력)
└── supabase_kakao_login_migration.sql  # DB 마이그레이션 SQL
```

## 5. 카카오 로그인 플로우

### 5.1 로그인 프로세스
1. 사용자가 "카카오 로그인" 버튼 클릭
2. 카카오 인증 페이지로 리다이렉트
3. 사용자가 카카오 로그인 및 동의
4. `/auth/kakao/callback`으로 리다이렉트 (인가 코드 포함)
5. 인가 코드로 액세스 토큰 교환
6. 액세스 토큰으로 카카오 사용자 정보 조회

### 5.2 신규 사용자 (회원가입)
7. Supabase에서 `kakao_id`로 사용자 조회
8. 사용자 없음 → 회원가입 페이지로 이동
9. 카카오 정보로 폼 자동 입력
10. 약관 동의 후 회원가입 완료
11. Supabase users 테이블에 저장
12. 자동 로그인 및 메인 페이지 이동

### 5.3 기존 사용자 (로그인)
7. Supabase에서 `kakao_id`로 사용자 조회
8. 사용자 존재 → 프로필 정보 최신화
9. 로그인 처리 (localStorage에 사용자 정보 저장)
10. 메인 페이지 이동

## 6. 로컬 개발 환경 테스트

### 6.1 개발 서버 실행
```bash
npm run dev
```

### 6.2 카카오 개발자 콘솔 설정
로컬 테스트용 Redirect URI 추가:
- `http://localhost:5173/auth/kakao/callback`

### 6.3 테스트 절차
1. http://localhost:5173/login 접속
2. "카카오 로그인하기" 버튼 클릭
3. 카카오 로그인 진행
4. 신규 사용자: 회원가입 페이지에서 정보 확인 후 가입
5. 기존 사용자: 자동 로그인 후 메인 페이지 이동

## 7. 배포 시 주의사항

### 7.1 환경 변수 설정
- Netlify/Vercel 등 배포 플랫폼에서 환경 변수 설정 필수
- `VITE_KAKAO_REST_API_KEY`
- `VITE_KAKAO_CLIENT_SECRET`

### 7.2 카카오 개발자 콘솔 설정
- 실제 서비스 도메인(`https://undong.lunagd.com`)으로 Redirect URI 등록 확인
- 플랫폼에 서비스 도메인 등록 확인

### 7.3 보안 고려사항
- Client Secret은 반드시 환경 변수로 관리 (코드에 노출 금지)
- HTTPS 사용 필수 (카카오 정책)
- 프로덕션에서는 localhost Redirect URI 제거

## 8. 문제 해결

### 8.1 "Redirect URI mismatch" 오류
- 카카오 개발자 콘솔에서 Redirect URI 정확히 등록 확인
- 프로토콜(http/https), 도메인, 경로 모두 일치해야 함
- 예: `https://undong.lunagd.com/auth/kakao/callback`

### 8.2 "Invalid client_id" 오류
- `.env` 파일에 `VITE_KAKAO_REST_API_KEY` 확인
- 카카오 개발자 콘솔에서 REST API 키 복사 확인
- 개발 서버 재시작 (환경 변수 변경 시)

### 8.3 "카카오 사용자 정보 조회 실패"
- 카카오 개발자 콘솔 > 동의 항목 설정 확인
- 필수 동의 항목 활성화 확인
- 비즈니스 인증 필요한 항목(이름, 전화번호 등)은 비즈니스 등록 후 사용 가능

### 8.4 데이터베이스 오류
- Supabase에서 `supabase_kakao_login_migration.sql` 실행 확인
- users 테이블에 `kakao_id` 컬럼 존재 확인
- RLS(Row Level Security) 정책 확인

## 9. API 참고 문서

- [카카오 로그인 REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [카카오 사용자 정보 가져오기](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info)
- [Supabase 문서](https://supabase.com/docs)

## 10. 담당자 정보

**서비스 운영자**
- 사업자명: jh308(제이에이치308)
- 대표자: 양석환
- 이메일: shy@lunagarden.co.kr
- 전화: 010-3114-8626
