-- 대댓글(답글) 알림: 지금까지는 댓글이 달리면 운동 작성자에게만 알림이 갔다.
-- B가 A의 운동에 댓글을 달고, 거기에 A(또는 다른 사람 C)가 답글을 달면
-- 원댓글 작성자 B는 아무 알림도 못 받았음 — parent_id가 있는 경우 부모 댓글
-- 작성자에게도 알림을 추가한다. 답글의 답글도 "바로 위 댓글 작성자"에게만
-- 알리면 체인 전체가 자연스럽게 커버된다 (재귀 처리 불필요).
--
-- 본인 알림 제외, 운동 작성자와 부모 댓글 작성자가 같은 사람이면 중복 알림 방지.

CREATE OR REPLACE FUNCTION "public"."create_comment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  workout_owner_id UUID;
  parent_author_id UUID;
BEGIN
  SELECT user_id INTO workout_owner_id
  FROM workouts
  WHERE id = NEW.workout_id;

  IF workout_owner_id IS NOT NULL AND workout_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type, comment_text, comment_id)
    VALUES (workout_owner_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'comment', NEW.comment, NEW.id);
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author_id
    FROM workout_comments
    WHERE id = NEW.parent_id;

    IF parent_author_id IS NOT NULL
       AND parent_author_id != NEW.user_id
       AND parent_author_id != workout_owner_id THEN
      INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type, comment_text, comment_id)
      VALUES (parent_author_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'comment', NEW.comment, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
