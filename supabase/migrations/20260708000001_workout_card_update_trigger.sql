-- dedup UPDATE-in-place 지원: 내용 필드 변경 시에도 카드 재생성 웹훅 발화
-- (app 스레드 #24 — id 보존 정책. proof_image 단독 변경은 비발화 → 재생성 루프 차단)

create or replace function public.handle_workout_inserted()
returns trigger
language plpgsql
security definer
as $$
declare
  should_fire boolean := false;
begin
  if NEW.source not in ('google_health', 'apple_health') then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    should_fire := NEW.proof_image is null;
  else -- UPDATE
    should_fire := (
      NEW.value is distinct from OLD.value or
      NEW.unit is distinct from OLD.unit or
      NEW.elapsed_seconds is distinct from OLD.elapsed_seconds or
      NEW.moving_seconds is distinct from OLD.moving_seconds or
      NEW.average_speed is distinct from OLD.average_speed or
      NEW.average_heartrate is distinct from OLD.average_heartrate or
      NEW.max_heartrate is distinct from OLD.max_heartrate or
      NEW.calories is distinct from OLD.calories or
      NEW.steps is distinct from OLD.steps or
      NEW.elevation_gain is distinct from OLD.elevation_gain or
      NEW.route is distinct from OLD.route or
      NEW.category is distinct from OLD.category or
      NEW.sub_type is distinct from OLD.sub_type or
      NEW.workout_time is distinct from OLD.workout_time
    );
  end if;

  if should_fire then
    begin
      perform net.http_post(
        url     := 'https://cardio.scnd.kr/api/webhooks/workout-inserted',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer silversh13'
        ),
        body    := jsonb_build_object(
          'type',   TG_OP,
          'table',  'workouts',
          'schema', 'public',
          'record', to_jsonb(NEW)
        )
      );
    exception when others then
      null; -- INSERT/UPDATE는 webhook 실패와 무관하게 성공
    end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_workout_inserted on public.workouts;
create trigger on_workout_inserted
  after insert or update on public.workouts
  for each row
  execute function public.handle_workout_inserted();
