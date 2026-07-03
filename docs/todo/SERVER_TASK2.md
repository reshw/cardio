# 웹서버 작업 협업 요청서 2 — 중복 운동 기록 방지

## 배경

Android 다중 기기 허용 시, 두 기기가 동시에 SyncWorker를 실행하면
앱 레벨 중복 체크를 둘 다 통과해 동일한 운동 기록이 중복 삽입될 수 있음.

앱 레벨 체크는 최적화(불필요한 API 호출 감소) 용도이며,
실제 중복 방지는 DB 제약으로 보장해야 함.

---

## 작업

### workouts 테이블 유니크 제약 추가

```sql
alter table workouts
add constraint workouts_user_source_unique
unique (user_id, source_activity_id);
```

- `source_activity_id`: Health Connect 메타데이터 ID (삼성헬스/가민/갤럭시워치 → Google 서버 동기화 시 기기 간 동일한 값)
- 동시에 여러 기기가 동일 레코드 INSERT 시도 시 DB가 하나만 허용, 나머지 에러 반환
- 앱은 에러를 무시하고 `Result.success()` 처리하므로 사용자 영향 없음

---

## 주의

- `source_activity_id`가 null인 수동 입력 레코드는 제약 대상 아님 (null은 unique 제약 적용 안 됨)
- 기존 데이터 중 중복 row가 있을 경우 제약 추가 전 정리 필요:

```sql
-- 중복 확인
select user_id, source_activity_id, count(*)
from workouts
where source_activity_id is not null
group by user_id, source_activity_id
having count(*) > 1;

-- 중복 정리 (최신 1건만 유지)
delete from workouts
where id in (
  select id from (
    select id,
           row_number() over (partition by user_id, source_activity_id order by created_at desc) as rn
    from workouts
    where source_activity_id is not null
  ) t
  where rn > 1
);
```
