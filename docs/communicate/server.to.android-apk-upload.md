# Android 앱 작업 요청 — APK 빌드 및 배포

## 웹서버 처리 완료 내역

- `/download` 페이지 구현 완료 (로그인 불필요, 누구나 접근 가능)
- `app_releases` 테이블에서 최신 버전 자동 조회
- APK URL은 Supabase Storage 고정 URL 사용

---

## Android 측 요청 사항

### 빌드마다 아래 두 가지 처리 부탁드립니다

#### 1. APK → Supabase Storage 업로드

버킷: `apk`  
파일명 고정: `cardio-latest.apk` (덮어쓰기)

업로드 후 공개 URL:
```
https://xfgxanikgdtriytfcrxr.supabase.co/storage/v1/object/public/apk/cardio-latest.apk
```

#### 2. `app_releases` 테이블 upsert

```python
# 예시 (Python)
supabase.table("app_releases").upsert({
    "platform": "android",
    "version": "6.x",       # 실제 버전으로
    "url": "https://xfgxanikgdtriytfcrxr.supabase.co/storage/v1/object/public/apk/cardio-latest.apk",
    "released_at": datetime.utcnow().isoformat()
}, on_conflict="platform").execute()
```

---

## 결과

업로드 완료되면 웹 `/download` 페이지에 버전·다운로드 버튼 자동 반영됩니다.  
Vercel 재배포 불필요.
