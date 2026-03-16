# Database Migrations

## 실행 방법
Supabase Dashboard → SQL Editor → 파일 내용 복사 & Run

---

## 파일 목록

### 🏗️ 초기 스키마 (이미 실행됨)
- **two_track_challenge_migration.sql** - challenges 테이블 생성 (Global + Club 챌린지 시스템)
- **club_system_migration.sql** - 클럽 시스템 테이블 생성
- **schema.sql** - 전체 데이터베이스 스키마

### 🔧 기능 추가 마이그레이션
- **quest_builder_migration.sql** - 챌린지에 rules/theme_color 컬럼 추가 (Quest Builder용)
- **club_dashboard_widgets_migration.sql** - 클럽 대시보드 위젯 설정 컬럼 추가
- **zero_copy_view_migration.sql** - Zero-Copy View 패턴 구현
- **type_specific_metrics_migration.sql** - Type별 지표 컬럼 추가
- **matrix_classification_migration.sql** - 2-Axis 매트릭스 분류 컬럼 추가
- **xp_system_migration.sql** - XP 시스템 컬럼 추가

### 🔐 보안 설정
- **fix_club_rls.sql** - RLS 정책 수정
- **disable_rls_for_dev.sql** - 개발 모드용 RLS 비활성화

### 🐛 버그 수정
- **fix_duration_type.sql** - duration 타입 수정

---

## 주의사항
1. 마이그레이션은 **한 번만** 실행하세요
2. 실행 전 백업 권장
3. 에러 발생 시 SQL Editor의 에러 메시지 확인
