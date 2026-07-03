-- pg_net is pre-installed in Supabase Cloud
-- Enable it if not already active (Database > Extensions > pg_net)

create or replace function public.handle_workout_inserted()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.source in ('google_health', 'apple_health') and NEW.proof_image is null then
    begin
      perform net.http_post(
        url     := 'https://cardio.scnd.kr/api/webhooks/workout-inserted',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer silversh13'
        ),
        body    := jsonb_build_object(
          'type',   'INSERT',
          'table',  'workouts',
          'schema', 'public',
          'record', to_jsonb(NEW)
        )
      );
    exception when others then
      null; -- INSERT는 webhook 실패와 무관하게 성공
    end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_workout_inserted on public.workouts;
create trigger on_workout_inserted
  after insert on public.workouts
  for each row
  execute function public.handle_workout_inserted();
