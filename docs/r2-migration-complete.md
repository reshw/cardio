# Cloudflare R2 마이그레이션 완료 ✅

## 완료된 작업

### 1. ✅ R2 스토리지 유틸리티 생성
- **파일**: `src/utils/r2Storage.ts`
- **기능**:
  - `uploadToR2()`: R2에 이미지 업로드 (원본 + 썸네일)
  - `getThumbnail()`: Cloudinary와 R2 이미지 모두 지원하는 통합 썸네일 함수
  - `getR2Thumbnail()`: R2 전용 썸네일 URL 변환

### 2. ✅ Netlify Functions 업로드 API 생성
- **파일**: `netlify/functions/upload-to-r2.ts`
- **기능**:
  - multipart/form-data 파일 업로드 처리
  - Sharp를 사용한 썸네일 생성 (300x300, cover fit)
  - R2에 원본 + 썸네일 업로드
  - CORS 헤더 자동 설정
  - 에러 처리 및 로깅

### 3. ✅ 환경 변수 설정
- **파일**: `.env`
- **추가된 변수**:
  ```env
  R2_ACCOUNT_ID=your_r2_account_id_here
  R2_ACCESS_KEY_ID=your_r2_access_key_id_here
  R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
  R2_BUCKET_NAME=cardio-images
  R2_PUBLIC_URL=https://your-custom-domain.com
  ```

### 4. ✅ 기존 페이지 업로드 로직 교체
다음 파일들의 import 및 함수 호출이 R2로 변경되었습니다:

#### 업로드 기능 (`uploadToR2` 사용):
- `src/components/AddWorkoutModal.tsx`
- `src/components/CreateClubModal.tsx`
- `src/components/EditClubModal.tsx`
- `src/components/WorkoutDetailModal.tsx`
- `src/pages/AddWorkout.tsx`
- `src/pages/ClubGeneralSettings.tsx`
- `src/pages/ClubMySettings.tsx`
- `src/pages/JoinClub.tsx`
- `src/pages/WorkoutDetail.tsx`

#### 썸네일 표시 (`getThumbnail` 사용):
- `src/pages/History.tsx`

### 5. ✅ 썸네일 처리 로직 구현
- 업로드 시 자동으로 300x300 썸네일 생성
- 원본과 썸네일을 각각 R2에 저장
- 기존 Cloudinary 이미지와의 하위 호환성 유지

### 6. ✅ 필요한 패키지 설치
```bash
npm install @aws-sdk/client-s3 sharp
```

## 다음 단계

### 1. R2 설정 (필수)
**상세 가이드**: `docs/r2-setup-guide.md` 참조

1. Cloudflare R2 버킷 생성
2. API 토큰 생성
3. 환경 변수 설정 (로컬 + Netlify)

### 2. 테스트

#### 로컬 테스트:
```bash
# .env 파일에 R2 credentials 설정 후
netlify dev
```

#### 테스트 항목:
- [ ] 운동 기록 추가 시 인증 사진 업로드
- [ ] 클럽 생성 시 로고 업로드
- [ ] 클럽 가입 시 프로필 이미지 업로드
- [ ] 썸네일이 History 페이지에서 정상 표시되는지
- [ ] 기존 Cloudinary 이미지도 정상 표시되는지

### 3. 배포
1. Netlify 환경 변수 설정
2. Git push로 자동 배포
3. 프로덕션 테스트

### 4. 모니터링
배포 후 다음을 확인:
- 업로드 성공률
- 이미지 로딩 속도
- R2 비용 (Cloudflare 대시보드)

## 기술적 세부사항

### 업로드 플로우
```
프론트엔드 (React)
    ↓ FormData (multipart/form-data)
Netlify Function (/.netlify/functions/upload-to-r2)
    ↓ 원본 이미지
Sharp 라이브러리 (리사이징)
    ↓ 원본 + 썸네일
Cloudflare R2 (S3 API)
    ↓ Public URLs
프론트엔드 (이미지 URL 저장)
```

### 썸네일 전략
- **사이즈**: 300x300px
- **Fit**: cover (비율 유지하며 크롭)
- **네이밍**: `{timestamp}-{random}_thumb.{ext}`
- **저장**: 원본과 썸네일 모두 R2에 저장

### 하위 호환성
`getThumbnail()` 함수가 자동으로 URL 타입을 감지:
- Cloudinary URL → Cloudinary 변환 파라미터 사용
- R2 URL → 썸네일 파일 URL로 변환

## 비용 절감 효과

### Before (Cloudinary 무료 티어)
- 스토리지: 25GB 제한
- 대역폭: 25GB/month 제한
- 초과 시: 유료 플랜 필요

### After (Cloudflare R2)
- 스토리지: 무제한 ($0.015/GB/month)
- Egress: **무료** 🎉
- 예상 월 비용: $0.25 (10GB 저장 기준)

## 주의사항

### 기존 Cloudinary 이미지
- 기존에 업로드된 이미지는 여전히 Cloudinary에서 제공됨
- 새로운 업로드만 R2로 저장됨
- 필요시 별도 마이그레이션 작업 필요

### Cloudinary 코드 보존
- `src/utils/cloudinary.ts`는 유지됨
- 기존 이미지 썸네일 처리를 위해 필요
- 완전히 마이그레이션 후 제거 가능

## 롤백 방법

만약 문제가 발생하면:

1. `.env`에서 R2 환경 변수 제거
2. Git revert로 이전 커밋으로 돌아가기:
   ```bash
   git revert HEAD
   ```
3. 또는 수동으로 import 변경:
   ```typescript
   // R2 사용 시
   import { uploadToR2 } from '../utils/r2Storage';

   // Cloudinary 사용 시
   import { uploadToCloudinary } from '../utils/cloudinary';
   ```

## 추가 최적화 아이디어

### 1. 여러 사이즈 썸네일 생성
현재는 300x300 한 가지만 생성하지만, 필요시 추가 가능:
- Small: 150x150
- Medium: 300x300
- Large: 600x600

### 2. 이미지 포맷 최적화
Sharp로 자동 WebP 변환:
```typescript
await sharp(buffer)
  .webp({ quality: 80 })
  .toBuffer()
```

### 3. CDN 캐싱 최적화
Cloudflare Workers에서 Cache-Control 헤더 설정

## 문의 및 이슈

문제 발생 시:
1. 브라우저 콘솔 로그 확인
2. Netlify Functions 로그 확인
3. Cloudflare R2 대시보드에서 파일 업로드 확인

---

**마이그레이션 완료 날짜**: 2026-03-30
**작업자**: Claude Sonnet 4.5
