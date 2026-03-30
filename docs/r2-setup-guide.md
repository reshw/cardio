# Cloudflare R2 설정 가이드

이 가이드는 Cloudinary에서 Cloudflare R2로 마이그레이션하기 위한 설정 방법을 설명합니다.

## 1. Cloudflare R2 버킷 생성

### 1.1 Cloudflare 대시보드 접속
1. https://dash.cloudflare.com 접속 및 로그인
2. 좌측 메뉴에서 **R2** 클릭

### 1.2 버킷 생성
1. **Create bucket** 버튼 클릭
2. 버킷 이름 입력: `cardio-images` (또는 원하는 이름)
3. 리전 선택: **Automatic** (권장)
4. **Create bucket** 클릭

### 1.3 Public Access 설정
1. 생성한 버킷 클릭
2. **Settings** 탭 이동
3. **Public Access** 섹션에서:
   - **Allow Access** 활성화
   - 또는 **Custom Domain** 연결 (권장)

#### Custom Domain 연결 (권장)
1. **Settings** > **Custom Domains** 클릭
2. **Connect Domain** 클릭
3. 본인 소유 도메인 입력 (예: `images.yourdomain.com`)
4. DNS 설정 따라하기 (자동으로 CNAME 레코드 추가)

> **참고**: Custom Domain을 사용하면 더 깔끔한 URL과 브랜딩이 가능합니다.

## 2. API 토큰 생성

### 2.1 R2 API 토큰 생성
1. R2 대시보드에서 **Manage R2 API Tokens** 클릭
2. **Create API Token** 클릭
3. 설정:
   - **Token name**: `cardio-app-upload`
   - **Permissions**:
     - ✅ Object Read & Write
   - **TTL**: Never expire (또는 원하는 기간)
   - **Bucket**: `cardio-images` 선택
4. **Create API Token** 클릭
5. **중요**: 생성된 정보를 안전하게 복사:
   - Access Key ID
   - Secret Access Key
   - (다시 볼 수 없으니 반드시 저장!)

### 2.2 Account ID 확인
1. Cloudflare 대시보드 우측 상단에서 계정 클릭
2. **Account ID** 복사

## 3. 환경 변수 설정

### 3.1 로컬 개발 환경 (.env)
`.env` 파일에 다음 환경 변수 추가:

```env
# Cloudflare R2 Storage (for Netlify Functions)
R2_ACCOUNT_ID=your_r2_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=cardio-images
R2_PUBLIC_URL=https://your-custom-domain.com
# 또는 R2 기본 URL: https://pub-xxxxx.r2.dev
```

**값 채우기:**
- `R2_ACCOUNT_ID`: 위 2.2에서 복사한 Account ID
- `R2_ACCESS_KEY_ID`: 위 2.1에서 생성한 Access Key ID
- `R2_SECRET_ACCESS_KEY`: 위 2.1에서 생성한 Secret Access Key
- `R2_BUCKET_NAME`: 생성한 버킷 이름 (예: `cardio-images`)
- `R2_PUBLIC_URL`: Custom Domain 또는 R2 Public URL

### 3.2 Netlify 배포 환경 설정
1. Netlify 대시보드 접속
2. 해당 사이트 선택
3. **Site settings** > **Environment variables** 클릭
4. 다음 변수들을 **Key-Value** 형식으로 추가:

| Key | Value |
|-----|-------|
| `R2_ACCOUNT_ID` | (Cloudflare Account ID) |
| `R2_ACCESS_KEY_ID` | (R2 Access Key ID) |
| `R2_SECRET_ACCESS_KEY` | (R2 Secret Access Key) |
| `R2_BUCKET_NAME` | `cardio-images` |
| `R2_PUBLIC_URL` | (Custom Domain 또는 R2 Public URL) |

5. **Save** 클릭

## 4. 테스트

### 4.1 로컬 테스트
```bash
# 로컬 개발 서버 시작
npm run dev

# Netlify Functions도 함께 실행하려면
netlify dev
```

### 4.2 업로드 테스트
1. 앱에서 이미지 업로드 기능 실행
2. 브라우저 콘솔에서 로그 확인:
   - `📤 R2 업로드 시작`
   - `✅ 업로드 성공`
3. 반환된 URL로 이미지 접근 가능한지 확인

## 5. 마이그레이션 체크리스트

- [ ] R2 버킷 생성 완료
- [ ] Public Access 또는 Custom Domain 설정 완료
- [ ] API 토큰 생성 완료
- [ ] 로컬 `.env` 파일 설정 완료
- [ ] Netlify 환경 변수 설정 완료
- [ ] 로컬에서 업로드 테스트 성공
- [ ] 배포 후 프로덕션 테스트 성공

## 6. 예상 비용

### Cloudflare R2 요금제
- **스토리지**: $0.015/GB/month
- **Class A 작업** (업로드): $4.50 per million requests
- **Class B 작업** (다운로드): $0.36 per million requests
- **Egress (다운로드 대역폭)**: **무료** 🎉

### 비용 예시
- 10GB 저장: $0.15/month
- 10,000회 업로드: $0.045
- 100,000회 조회: $0.036
- **총 월 예상 비용**: ~$0.25 🔥

> **Cloudinary 무료 티어**: 25GB 저장, 25GB 대역폭/month
> **R2 장점**: 용량 무제한, Egress 무료, 훨씬 저렴!

## 7. 문제 해결

### 업로드 실패 (403 Forbidden)
- API 토큰 권한 확인
- 버킷 이름 확인
- Account ID 확인

### 이미지가 보이지 않음 (404)
- Public Access 활성화 확인
- R2_PUBLIC_URL 올바른지 확인
- Custom Domain DNS 전파 대기 (최대 24시간)

### CORS 에러
- Netlify Function이 CORS 헤더를 자동으로 설정하므로 문제없음
- 만약 발생 시, R2 버킷의 CORS 설정 확인

## 8. 다음 단계

설정이 완료되면:
1. 기존 페이지들의 업로드 로직을 R2로 교체
2. 썸네일 처리 로직 테스트
3. 기존 Cloudinary 이미지 마이그레이션 (선택사항)
4. Cloudinary 관련 코드 제거

자세한 내용은 `docs/cloudinarymodi.md` 참조.
