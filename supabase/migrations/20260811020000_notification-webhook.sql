-- 좋아요·댓글 알림 발생 시 FCM 푸시 발송 웹훅.
--
-- public.workouts 의 on_workout_inserted 트리거와 완전히 동일한 패턴
-- (net.http_post → Vercel 함수, SUPABASE_WEBHOOK_SECRET Bearer 인증).
-- 발송 자체의 필터링(본인 알림 제외, type 검증, device_tokens 조회)은
-- api/webhooks/notification-inserted.ts 에서 처리하므로 여기선 INSERT 마다
-- 무조건 웹훅을 호출한다 — 실패해도 notifications INSERT 자체는 항상 성공해야
-- 하므로 on_workout_inserted 처럼 예외를 삼킨다.

CREATE OR REPLACE FUNCTION public.handle_notification_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  begin
    perform net.http_post(
      url     := 'https://cardio.scnd.kr/api/webhooks/notification-inserted',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer silversh13'
      ),
      body    := jsonb_build_object(
        'type',   TG_OP,
        'table',  'notifications',
        'schema', 'public',
        'record', to_jsonb(NEW)
      )
    );
  exception when others then
    null; -- notifications INSERT는 웹훅 실패와 무관하게 성공
  end;
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS on_notification_inserted ON public.notifications;

CREATE TRIGGER on_notification_inserted
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.handle_notification_inserted();
