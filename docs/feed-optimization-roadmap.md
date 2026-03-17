# 피드 최적화 로드맵: Instagram vs 우리 앱

## 📊 Executive Summary

이 문서는 소셜 피드 기능의 성능 최적화 전략을 Instagram과 같은 대형 플랫폼과 비교하며, 우리 앱의 현재 아키텍처와 성장 단계별 확장 계획을 설명합니다.

**현재 구현**: Client-side Caching + Optimistic Updates
**목표**: 사용자 경험 개선 및 서버 부하 최소화
**확장성**: 단계별 마일스톤 기반 아키텍처 진화

---

## 🏗️ 아키텍처 비교

### 1. Instagram의 아키텍처

Instagram은 월 20억 사용자를 지원하는 글로벌 소셜 플랫폼으로, 다층 캐싱과 분산 시스템을 활용합니다.

#### 핵심 구성 요소

**1) Feed Fanout (피드 팬아웃)**
- **Push Model**: 새 게시물 작성 시, 팔로워들의 피드에 미리 배포
- **Pre-computation**: 사용자가 앱을 열기 전에 피드가 이미 준비됨
- **Trade-off**: 쓰기 시 부하 증가, 읽기 시 속도 극대화

```
게시물 작성 → [Fanout Worker] → 팔로워 1,000명의 피드에 삽입
사용자가 앱 열기 → 이미 준비된 피드 즉시 표시 (< 100ms)
```

**2) Multi-level Caching (다층 캐싱)**
- **L1 Cache (Memcached)**: 인메모리 캐시, 수 밀리초 응답
- **L2 Cache (Redis)**: 영구 캐시, 수십 밀리초 응답
- **L3 Database (Cassandra)**: 최종 저장소, 백업용

**3) CDN (Content Delivery Network)**
- **이미지/비디오**: Akamai, Cloudflare 등을 통해 전 세계 배포
- **Edge Caching**: 사용자와 가까운 서버에서 미디어 제공
- **압축 및 최적화**: WebP, AVIF 등 최신 포맷 자동 전환

**4) Read/Write Separation**
- **Master DB**: 쓰기 전용 (게시물 작성, 좋아요, 댓글)
- **Replica DB**: 읽기 전용 (피드 조회, 프로필 조회)
- **Read Replicas**: 지역별 여러 개 배치하여 읽기 부하 분산

**5) Real-time Infrastructure**
- **WebSocket**: 새 게시물, 좋아요, 댓글 실시간 푸시
- **Event Stream (Kafka)**: 사용자 행동 로그 수집 및 분석
- **ML Recommendation**: 사용자 관심사 기반 피드 순서 조정

#### Instagram의 성능 지표

| 지표 | 값 |
|------|------|
| 피드 로딩 시간 | < 1초 |
| 좋아요 응답 시간 | < 100ms (optimistic) |
| 일일 활성 사용자 | 5억+ |
| 초당 요청 수 (QPS) | 수백만 |
| 인프라 비용 | 연간 수억 달러 |

---

### 2. 우리 앱의 현재 아키텍처

**Phase 1: Client-side Caching + Optimistic Updates** (현재)

#### 구현 세부사항

**1) Client-side Feed Cache**
```typescript
// 캐시 구조: { "clubId-dateString": WorkoutFeedItem[] }
const [feedCache, setFeedCache] = useState<Record<string, WorkoutFeedItem[]>>({});

// 캐시 키 생성
const cacheKey = `${clubId}-${date.toDateString()}`;

// 캐시 조회 → 있으면 반환, 없으면 서버 요청
if (!forceReload && feedCache[cacheKey]) {
  console.log('📦 캐시에서 피드 로드:', cacheKey);
  setFeedItems(feedCache[cacheKey]);
  return;
}

// 서버에서 가져온 후 캐시 저장
const items = await clubService.getClubWorkoutFeed(clubId, date, user.id);
setFeedCache(prev => ({ ...prev, [cacheKey]: items }));
```

**2) Optimistic Updates**
```typescript
// 좋아요 버튼 클릭 → UI 즉시 업데이트
const handleLikeToggle = async () => {
  // 1. UI 즉시 업데이트 (사용자는 즉시 피드백)
  onOptimisticLike(workout.id, item.is_liked_by_me);

  try {
    // 2. 백그라운드에서 서버 요청
    await feedService.toggleLike(workout.id, clubId, user.id, item.is_liked_by_me);
  } catch (error) {
    // 3. 실패 시 롤백
    onOptimisticLike(workout.id, !item.is_liked_by_me);
    alert('좋아요 처리에 실패했습니다.');
  }
};
```

**3) 캐시 무효화 전략**
- **날짜 변경 시**: 새 날짜의 피드를 서버에서 가져옴
- **수동 새로고침**: 사용자가 명시적으로 요청 시 (`forceReload=true`)
- **새 운동 추가**: 해당 날짜의 캐시만 무효화
- **댓글/좋아요**: 캐시된 데이터의 카운트만 업데이트 (서버 재요청 X)

#### 현재 아키텍처의 장점

✅ **구현 간단**: 추가 인프라 없이 React state만으로 구현
✅ **비용 절감**: 서버 요청 수 감소 (약 70-80% 예상)
✅ **즉각적인 UX**: Optimistic updates로 반응성 개선
✅ **브라우저 세션 유지**: 앱 사용 중 네트워크 요청 최소화

#### 현재 아키텍처의 한계

⚠️ **메모리 제한**: 브라우저 메모리에만 저장, 앱 새로고침 시 캐시 초기화
⚠️ **다중 기기 미지원**: 폰에서 본 피드 ≠ 태블릿에서 본 피드
⚠️ **실시간 동기화 부족**: 다른 사용자의 새 게시물을 자동으로 가져오지 않음
⚠️ **확장성 제약**: 100+ 명 동시 접속 시 DB 부하 발생 가능

---

## 📈 성장 단계별 마일스톤

### Milestone 1: **100명 이하** (MVP 단계) ✅ 현재

**사용자 행동**
- 클럽당 평균 10-20명
- 일일 활성 사용자 20-50명
- 피드 조회: 하루 100-200회

**적합한 아키텍처**
- ✅ **Client-side Caching** (현재 구현)
- ✅ **Optimistic Updates** (현재 구현)
- ✅ **Supabase 무료 플랜** (500MB DB, 2GB 전송량)

**예상 성능**
- 피드 로딩: 평균 1-2초 (첫 로드), < 100ms (캐시 히트)
- 좋아요 응답: < 50ms (optimistic)
- 서버 요청: 하루 50-100회 (캐싱으로 감소)

**비용**
- **인프라**: $0/월 (Supabase 무료 플랜)
- **개발 시간**: 이미 완료

---

### Milestone 2: **100-500명** (성장기)

**사용자 행동**
- 클럽당 평균 30-50명
- 일일 활성 사용자 100-200명
- 피드 조회: 하루 500-1,000회

**필요한 개선사항**

**1) Server-side Cache 추가** (우선순위: 중간)
```typescript
// Supabase Edge Function에 Redis 추가
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// 피드 조회 시 서버 캐시 확인
const cacheKey = `feed:${clubId}:${dateString}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return new Response(JSON.stringify(cached), { status: 200 });
}

// 캐시 미스 시 DB 조회 후 저장 (TTL 10분)
const feedItems = await queryDatabase();
await redis.setex(cacheKey, 600, JSON.stringify(feedItems));
```

**2) Database Indexing 최적화**
```sql
-- 피드 조회 쿼리 최적화
CREATE INDEX idx_workouts_club_date ON workouts(club_id, created_at);
CREATE INDEX idx_club_members_feed ON club_members(club_id, show_in_feed) WHERE show_in_feed = true;

-- 좋아요/댓글 조회 최적화 (이미 완료)
CREATE INDEX idx_workout_likes_workout_club ON workout_likes(workout_id, club_id);
CREATE INDEX idx_workout_comments_workout_club ON workout_comments(workout_id, club_id);
```

**3) 이미지 최적화**
- Cloudinary 또는 Supabase Storage CDN 활용
- WebP 자동 변환
- Thumbnail 생성 (프로필 이미지, 인증 사진)

**예상 성능**
- 피드 로딩: 평균 0.5-1초 (서버 캐시 히트)
- DB 부하: 50% 감소 (Redis 캐싱)
- 동시 접속: 50-100명 처리 가능

**비용**
- **Supabase**: $25/월 (Pro 플랜)
- **Upstash Redis**: $10/월 (무료 플랜 초과 시)
- **Cloudinary**: $0-$10/월 (무료 플랜 25GB)
- **총 비용**: $35-$45/월

**개발 시간**: 1-2주

---

### Milestone 3: **500-1,000명** (확장기)

**사용자 행동**
- 클럽당 평균 50-100명
- 일일 활성 사용자 300-500명
- 피드 조회: 하루 2,000-5,000회

**필요한 개선사항**

**1) Read Replica 추가**
```sql
-- Supabase에서 읽기 전용 복제본 생성
-- 피드 조회는 Replica, 쓰기는 Primary

-- Application Layer에서 분기
const db = isReadQuery ? replicaDB : primaryDB;
```

**2) Partial Feed Fanout (하이브리드 모델)**
```typescript
// VIP 사용자 (팔로워 < 100명) → Push Model (미리 계산)
// 일반 사용자 (팔로워 >= 100명) → Pull Model (실시간 조회)

if (followerCount < 100) {
  // 게시물 작성 시 팔로워 피드에 미리 삽입
  await Promise.all(
    followers.map(f => redis.lpush(`feed:${f.id}`, postId))
  );
} else {
  // 조회 시점에 계산 (캐싱 활용)
  const feedItems = await buildFeedRealtime(userId);
}
```

**3) WebSocket 실시간 알림**
```typescript
// 새 게시물, 좋아요, 댓글 시 실시간 푸시
const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});

supabase
  .channel(`club:${clubId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'workouts' },
    (payload) => {
      // 새 운동 추가 시 피드 상단에 표시
      setFeedItems(prev => [payload.new, ...prev]);
    }
  )
  .subscribe();
```

**4) Advanced Analytics**
- 사용자 행동 패턴 분석 (어느 시간대에 가장 활발한가?)
- 인기 운동 타입 추천
- 푸시 알림 최적화 (사용자가 앱을 열 확률이 높은 시간)

**예상 성능**
- 피드 로딩: 평균 0.3-0.5초
- 실시간 업데이트: < 1초 (WebSocket)
- 동시 접속: 200-300명 처리 가능

**비용**
- **Supabase**: $100-$200/월 (Pro + Add-ons)
- **Upstash Redis**: $30-$50/월
- **Cloudinary**: $50-$100/월
- **Monitoring (Sentry, LogRocket)**: $50/월
- **총 비용**: $230-$400/월

**개발 시간**: 3-4주

---

### Milestone 4: **1,000명 이상** (성숙기)

**사용자 행동**
- 클럽당 평균 100-200명
- 일일 활성 사용자 500-1,000명
- 피드 조회: 하루 10,000+ 회

**필요한 개선사항**

**1) Microservices 분리**
```
[User Service]  → 프로필, 인증
[Feed Service]  → 피드 조회, 생성
[Social Service] → 좋아요, 댓글
[Media Service] → 이미지 업로드, 처리
[Notification Service] → 푸시, 이메일
```

**2) Full Feed Fanout (Instagram 모델)**
- 모든 게시물을 팔로워 피드에 미리 삽입
- Redis Sorted Set으로 피드 관리
- 타임라인 조회 시 O(1) 성능

**3) ML 기반 추천 시스템**
- 사용자가 좋아할 만한 운동 추천
- 비슷한 목표를 가진 사람 추천
- 개인화된 피드 순서 조정

**4) CDN 및 Edge Computing**
- Cloudflare Workers로 정적 콘텐츠 캐싱
- 지역별 서버 배치 (서울, 도쿄, 싱가포르)

**5) Auto-scaling Infrastructure**
- Kubernetes로 컨테이너 오케스트레이션
- 트래픽에 따라 서버 자동 확장/축소

**예상 성능**
- 피드 로딩: 평균 0.2-0.3초
- 실시간 업데이트: < 500ms
- 동시 접속: 1,000+ 명 처리 가능

**비용**
- **Database (RDS/Aurora)**: $300-$500/월
- **Redis Cluster**: $200-$300/월
- **CDN (Cloudflare)**: $100-$200/월
- **Container Hosting (ECS/GKE)**: $500-$1,000/월
- **Monitoring & Logging**: $100-$200/월
- **총 비용**: $1,200-$2,200/월

**개발 시간**: 2-3개월

---

## 🔄 마이그레이션 전략

### Phase 1 → Phase 2 (100→500명)

**단계적 도입**
1. **Week 1-2**: Redis 캐시 추가 (기존 로직과 병행)
2. **Week 3**: A/B 테스트 (50% 사용자만 Redis 사용)
3. **Week 4**: 성능 모니터링 후 100% 전환

**롤백 계획**
- Redis 장애 시 자동으로 DB 직접 조회로 폴백
- Feature Flag로 즉시 구버전 복원 가능

### Phase 2 → Phase 3 (500→1,000명)

**단계적 도입**
1. **Week 1-2**: Read Replica 설정 및 테스트
2. **Week 3-4**: WebSocket 인프라 구축
3. **Week 5**: 읽기 트래픽 50% → Replica로 전환
4. **Week 6**: 실시간 알림 베타 테스트
5. **Week 7-8**: 전체 트래픽 전환 및 모니터링

---

## 📊 비용 대비 효과 분석

| 단계 | 사용자 수 | 월 비용 | 사용자당 비용 | 피드 로딩 시간 |
|------|----------|---------|-------------|-------------|
| Phase 1 (현재) | 100명 | $0 | $0 | 1-2초 |
| Phase 2 | 500명 | $40 | $0.08 | 0.5-1초 |
| Phase 3 | 1,000명 | $300 | $0.30 | 0.3-0.5초 |
| Phase 4 | 5,000명 | $1,500 | $0.30 | 0.2-0.3초 |

**ROI 분석**
- Phase 2에서 서버 요청 50% 감소 → DB 비용 절감
- Phase 3에서 사용자 만족도 향상 → 리텐션 증가
- Phase 4에서 프리미엄 기능 출시 가능 (월 $5 구독)

---

## 🎯 실행 가능한 다음 단계

### 즉시 실행 (현재 Phase 1 완료 상태)

✅ **Client-side Caching** - 완료
✅ **Optimistic Updates** - 완료
✅ **기본 인덱싱** - 완료

### 3개월 내 (사용자 100명 돌파 시)

🔲 **Database Index 추가 검증**
```sql
-- 실행 계획 확인
EXPLAIN ANALYZE SELECT * FROM workouts WHERE club_id = '...' AND created_at > '...';
```

🔲 **Monitoring 대시보드 구축**
- Supabase Analytics로 쿼리 성능 추적
- Sentry로 에러 모니터링

### 6개월 내 (사용자 300명 돌파 시)

🔲 **Redis 캐싱 도입**
- Upstash Redis 계정 생성
- Supabase Edge Function에 캐시 레이어 추가
- 캐시 히트율 70% 이상 목표

🔲 **이미지 최적화**
- Cloudinary 연동
- 자동 WebP 변환
- Lazy loading 적용

### 1년 내 (사용자 1,000명 돌파 시)

🔲 **Read Replica 추가**
🔲 **WebSocket 실시간 알림**
🔲 **ML 기반 추천 시스템 프로토타입**

---

## 💡 핵심 교훈

### Instagram에서 배운 것

1. **조기 최적화는 피하라**: 사용자가 없을 때 Fanout 구현은 과잉
2. **측정 가능한 지표**: 추측이 아닌 데이터 기반 의사결정
3. **단계적 확장**: 10배 성장할 때마다 아키텍처 재검토

### 우리 앱의 강점

1. **가벼운 시작**: 복잡한 인프라 없이 MVP 검증 완료
2. **명확한 로드맵**: 사용자 수에 따른 구체적 마일스톤
3. **비용 효율성**: 초기 단계에서 $0/월로 100명 지원 가능

### 성공 지표 (KPI)

- **사용자 리텐션**: 주간 활성 사용자 비율
- **피드 로딩 시간**: 95 percentile < 2초 유지
- **서버 비용**: 사용자당 월 $0.50 이하 유지
- **에러율**: 전체 요청의 0.1% 미만

---

## 📚 참고 자료

- [Instagram Engineering Blog - Feed Ranking](https://engineering.fb.com/2021/01/26/ml-applications/news-feed-ranking/)
- [Scaling Instagram Infrastructure](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad)
- [Supabase Performance Best Practices](https://supabase.com/docs/guides/platform/performance)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)

---

**작성일**: 2024년 (현재)
**다음 리뷰**: 사용자 100명 돌파 시 또는 3개월 후
**담당자**: Development Team

---

## 🚀 결론

우리는 **Client-side Caching + Optimistic Updates**로 시작하여, Instagram 수준의 성능을 향한 명확한 로드맵을 가지고 있습니다. 각 마일스톤은 실제 사용자 수와 연동되어 있으며, 과도한 조기 최적화를 피하면서도 성장에 대비할 수 있는 구조입니다.

핵심은 **"측정 → 분석 → 개선"** 사이클을 반복하며, 사용자 경험을 최우선으로 하는 것입니다. Instagram처럼 거대한 인프라는 나중 문제이고, 지금은 사용자들이 우리 앱을 사랑하게 만드는 것이 더 중요합니다. 🎯
