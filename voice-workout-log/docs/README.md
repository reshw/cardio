# Voice Workout Log - Documentation

이 폴더는 Voice Workout Log 프로젝트의 모든 문서를 포함합니다.

---

## 📚 문서 목록

### 1. 프로젝트 이해하기
- **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)** ⭐
  - 프로젝트 전체 개요 및 핵심 기능 설명
  - AI가 이해하기 좋은 포맷으로 작성
  - 기술 스택, 데이터 플로우, 주요 화면 설명
  - **새로운 개발자 또는 AI가 프로젝트를 이해하려면 이 문서부터 읽으세요**

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**
  - 시스템 아키텍처 상세 설명
  - 레이어 구조, 디자인 패턴, 보안 정책
  - 성능 최적화 및 확장성 고려사항.

### 2. 데이터베이스
- **[database/schema.sql](./database/schema.sql)**
  - Supabase PostgreSQL 데이터베이스 전체 스키마
  - 테이블 정의, 인덱스, RLS 정책
  - 최신 프로덕션 스키마

- **[database/migrations/](./database/migrations/)**
  - 데이터베이스 마이그레이션 관련 파일
  - `MIGRATION_GUIDE.md`: 마이그레이션 가이드
  - `migrate-user-data.ts`: 사용자 데이터 마이그레이션 스크립트
  - `migrate_test01_to_kakao.sql`: 테스트 DB → Kakao 통합 마이그레이션

### 3. API 문서 (향후 추가 예정)
- REST API 엔드포인트 명세
- Supabase 함수 사용법
- 인증 플로우 다이어그램

### 4. 향후 계획 (향후 추가 예정)
- 클럽 시스템 설계 문서
- 챌린지 기능 기획
- 소셜 피드 설계

---

## 🚀 빠른 시작

1. **프로젝트가 처음이라면**: [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)를 읽으세요
2. **기술적 구조를 이해하려면**: [ARCHITECTURE.md](./ARCHITECTURE.md)를 읽으세요
3. **데이터베이스 스키마를 보려면**: [database/schema.sql](./database/schema.sql)를 참조하세요
4. **마이그레이션을 진행하려면**: [database/migrations/MIGRATION_GUIDE.md](./database/migrations/MIGRATION_GUIDE.md)를 따르세요

---

## 📝 문서 작성 원칙

### AI 친화적 작성
이 문서들은 AI (Gemini, GPT)가 프로젝트를 이해하고 협업하기 쉽도록 다음 원칙을 따릅니다:

1. **구조화된 정보**: 계층적 구조로 정보 조직
2. **명확한 컨텍스트**: 각 섹션이 독립적으로 이해 가능
3. **코드 예제 포함**: 추상적 설명보다 구체적 예제 제공
4. **최신 상태 유지**: 코드 변경 시 문서도 함께 업데이트
5. **타입과 인터페이스 명시**: TypeScript 타입 정보 포함

### 인간 친화적 작성
- 전문 용어 사용 시 간단한 설명 추가
- 다이어그램 및 플로우차트 활용 (가능한 경우)
- 실제 사용 사례 및 시나리오 포함

---

## 🔄 문서 업데이트 가이드

### 언제 문서를 업데이트해야 하나요?
- 새로운 기능을 추가할 때
- 데이터베이스 스키마를 변경할 때
- API 엔드포인트를 추가/수정할 때
- 아키텍처 결정을 내릴 때
- 중요한 버그 수정 후 (만약 문서에 영향을 준다면)

### 문서 작성 체크리스트
- [ ] 변경 사항을 PROJECT_OVERVIEW.md에 반영했나요?
- [ ] 새로운 테이블/컬럼을 schema.sql에 추가했나요?
- [ ] 마이그레이션 스크립트를 작성했나요?
- [ ] 코드 예제가 최신 버전인가요?
- [ ] 타입 정의가 정확한가요?

---

## 📂 폴더 구조

```
docs/
├── README.md                    # 이 파일 (문서 네비게이션)
├── PROJECT_OVERVIEW.md          # 프로젝트 전체 개요 ⭐
├── ARCHITECTURE.md              # 아키텍처 상세 설명
│
└── database/                    # 데이터베이스 관련 문서
    ├── schema.sql               # 현재 DB 스키마
    └── migrations/              # 마이그레이션 히스토리
        ├── MIGRATION_GUIDE.md   # 마이그레이션 가이드
        ├── migrate-user-data.ts # 사용자 데이터 마이그레이션 스크립트
        └── migrate_test01_to_kakao.sql
```

---

## 💡 참고

### 외부 문서
- [Supabase Docs](https://supabase.com/docs)
- [React Router v7](https://reactrouter.com/)
- [Kakao Developers](https://developers.kakao.com/)
- [Google Generative AI](https://ai.google.dev/)
- [OpenAI API](https://platform.openai.com/docs)

### 프로젝트 루트 파일
- `package.json`: 의존성 및 스크립트
- `.env`: 환경 변수 (민감 정보, Git에 커밋되지 않음)
- `tsconfig.json`: TypeScript 설정
- `vite.config.ts`: Vite 빌드 설정

---

## 🤝 기여

문서 개선 제안이나 오류를 발견하면:
1. 이슈를 생성하거나
2. PR을 제출하거나
3. 프로젝트 관리자에게 직접 알려주세요a

**좋은 문서는 좋은 코드만큼 중요합니다!**
