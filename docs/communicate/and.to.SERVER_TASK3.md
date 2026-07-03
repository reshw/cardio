# 웹서버 작업 협업 요청서 3 — APK 다운로드 페이지

## Supabase 준비 완료 사항 (Android 측에서 처리)

- `storage.buckets`: `apk` 버킷 생성 (public)
- `storage.objects` 정책: public read, allow upload, allow overwrite
- `app_releases` 테이블 생성
- `app_releases` 정책: public read

---

## app_releases 테이블 구조

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial | PK |
| platform | text | 'android' / 'ios' |
| version | text | '6.4' |
| url | text | 다운로드 URL |
| released_at | timestamptz | 배포 시각 |

Android 빌드마다 `platform='android'` row를 upsert로 업데이트.
iOS도 동일한 테이블에 `platform='ios'`로 관리.

---

## 작업 목록

### 1. Vercel 다운로드 페이지

`/download` 경로 (또는 적절한 경로)에 페이지 추가.

```tsx
// pages/download.tsx (또는 app/download/page.tsx)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function DownloadPage() {
  const { data: releases } = await supabase
    .from('app_releases')
    .select('*')
    .order('released_at', { ascending: false })

  const android = releases?.find(r => r.platform === 'android')
  const ios     = releases?.find(r => r.platform === 'ios')

  return (
    <div>
      <h1>Cardio 앱 다운로드</h1>

      {android && (
        <div>
          <span>Android</span>
          <span>v{android.version}</span>
          <a href={android.url} download>다운로드</a>
        </div>
      )}

      {ios && (
        <div>
          <span>iOS</span>
          <span>v{ios.version}</span>
          <a href={ios.url}>App Store</a>
        </div>
      )}
    </div>
  )
}
```

- 스타일은 기존 웹앱 디자인 시스템에 맞게 적용
- 페이지 접근 제한 없음 (누구나 접근 가능)

---

### 2. Android 빌드 시 자동 업로드 (Android 측 처리 예정)

빌드할 때마다 아래 두 작업을 Python 스크립트로 자동화:

1. `cardio-latest.apk` → Supabase Storage `apk` 버킷에 upsert
2. `app_releases` 테이블 android row upsert (version, url, released_at 갱신)

APK 고정 URL:
```
https://xfgxanikgdtriytfcrxr.supabase.co/storage/v1/object/public/apk/cardio-latest.apk
```

---

## 작업 우선순위

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | `/download` 페이지 구현 | Supabase 연동, 스타일 적용 |
| 2 | Vercel 배포 | 이후 추가 배포 불필요 |
