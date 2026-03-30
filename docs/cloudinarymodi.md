# Cloudinary 사용 현황 및 Cloudflare R2 마이그레이션 가이드

## 현재 Cloudinary 사용 현황

### 1. 환경 변수 설정 (.env)
```dotenv
VITE_CLOUDINARY_CLOUD_NAME=dhnyr34t1
VITE_CLOUDINARY_API_KEY=329831885452139  # 실제로는 사용되지 않음
VITE_CLOUDINARY_UPLOAD_PRESET=cardio
```

### 2. 유틸리티 파일 (src/utils/cloudinary.ts)

#### 주요 함수들:
- `uploadToCloudinary(file: File): Promise<string>` - 이미지 파일을 Cloudinary에 업로드
- `getCloudinaryThumbnail(url: string, width?: number, height?: number): string` - Cloudinary URL을 썸네일 변환

#### 업로드 로직:
- FormData를 사용한 POST 요청
- `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` 엔드포인트 사용
- upload_preset을 통한 인증

#### 썸네일 변환 로직:
- URL에서 `/upload/` 부분을 찾아 변환 파라미터 삽입
- `w_${width},h_${height},c_fill` 파라미터 사용

### 3. 사용되는 페이지들

#### 이미지 업로드 (uploadToCloudinary 사용):
- `src/pages/AddWorkout.tsx` - 운동 인증 사진 업로드
- `src/pages/WorkoutDetail.tsx` - 운동 상세에서 인증 사진 추가
- `src/pages/JoinClub.tsx` - 클럽 가입 시 프로필 이미지 업로드
- `src/pages/ClubMySettings.tsx` - 내 설정에서 프로필 이미지 변경
- `src/pages/ClubGeneralSettings.tsx` - 클럽 로고 업로드

#### 썸네일 표시 (getCloudinaryThumbnail 사용):
- `src/pages/History.tsx` - 운동 기록 목록과 상세에서 인증 사진 썸네일 표시

### 4. 데이터베이스 저장 방식
- 업로드된 이미지 URL이 데이터베이스에 직접 저장됨
- Supabase의 workouts, profiles, clubs 테이블 등에 URL 필드로 저장

## 마이그레이션 계획 (Cloudflare R2로)

### 1. 새로운 유틸리티 파일 생성
- `src/utils/r2Storage.ts` 생성
- Cloudflare R2 API를 사용한 업로드/다운로드 함수 구현

### 2. 환경 변수 변경
```dotenv
# 기존 Cloudinary 제거
# VITE_CLOUDINARY_CLOUD_NAME=...
# VITE_CLOUDINARY_API_KEY=...
# VITE_CLOUDINARY_UPLOAD_PRESET=...

# 새로운 Cloudflare R2 설정 추가
VITE_R2_ACCOUNT_ID=your_account_id
VITE_R2_ACCESS_KEY_ID=your_access_key
VITE_R2_SECRET_ACCESS_KEY=your_secret_key
VITE_R2_BUCKET_NAME=your_bucket_name
VITE_R2_PUBLIC_URL=https://your-domain.r2.cloudflarestorage.com
```

### 3. 마이그레이션 단계

#### Phase 1: 새로운 업로드 로직 구현
- R2 업로드 함수 구현
- 기존 Cloudinary 함수와 동일한 인터페이스 유지
- 새로운 이미지는 R2에 업로드

#### Phase 2: 썸네일 처리 변경
- Cloudinary의 URL 변환 대신, 별도의 썸네일 생성 로직 구현
- 또는 Cloudflare Images 사용 고려

#### Phase 3: 기존 이미지 마이그레이션
- 기존 Cloudinary URL들을 R2로 복사
- 데이터베이스 URL 업데이트
- 점진적 마이그레이션으로 다운타임 최소화

#### Phase 4: 코드 정리
- Cloudinary 관련 코드 제거
- 환경 변수 정리

### 4. 고려사항

#### URL 호환성:
- 기존 Cloudinary URL들은 `cloudinary.com` 도메인 사용
- R2로 마이그레이션 시 URL 구조 변경 필요
- 데이터베이스에 저장된 모든 URL 업데이트 필요

#### 썸네일 처리:
- Cloudinary는 URL 파라미터로 실시간 썸네일 생성
- R2는 별도의 썸네일 저장 또는 Cloudflare Images 사용 필요

#### 비용:
- Cloudinary 무료 티어에서 R2로의 비용 변화 고려

#### 성능:
- Cloudflare의 글로벌 CDN 활용으로 성능 향상 기대

### 5. 구현 우선순위

1. R2 업로드 유틸리티 구현
2. 기존 페이지들의 업로드 로직 교체
3. 썸네일 처리 로직 구현
4. 기존 데이터 마이그레이션
5. Cloudinary 코드 제거

### 6. 테스트 케이스

- 이미지 업로드 성공/실패
- 썸네일 표시
- 기존 Cloudinary URL과의 호환성
- 에러 처리
- 파일 크기/형식 제한