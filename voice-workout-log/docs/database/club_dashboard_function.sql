-- ============================================
-- Club Dashboard Function (2026-01-21 v3)
-- Change Log:
-- 1. Remove: 입력 시간 기반 배지 삭제 (미라클모닝, 올빼미)
-- 2. Add: '연속 출석(Streak)' & '육각형 멤버(Variety)' 추가
-- 3. Fix: 워커홀릭 공정성 유지 (출석 일수 기준)
-- ============================================

CREATE OR REPLACE FUNCTION get_club_dashboard(p_club_id UUID, p_current_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_badges JSONB;
  v_squad JSONB;
  v_leaderboards JSONB;
BEGIN

  -- 1. 🏆 Hall of Fame (배지 계산)
  WITH member_logs AS (
    SELECT
      wl.user_id, wl.created_at, wl.date,
      w.type, w.category, w.name, w.volume_kg, w.distance_km, w.adjusted_dist_km, w.run_count
    FROM workout_logs wl
    JOIN workouts w ON w.workout_log_id = wl.id
    WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id)
      AND wl.is_private = false
      AND wl.created_at >= NOW() - INTERVAL '30 days'
  ),
  -- Streak(연속 출석) 계산을 위한 CTE
  daily_logs AS (
    SELECT DISTINCT user_id, date FROM member_logs
  ),
  streaks AS (
    SELECT user_id, COUNT(*) as days
    FROM (
        SELECT user_id, date,
               -- 날짜에서 행번호를 빼서 그룹핑 (연속된 날짜면 같은 그룹이 됨)
               date - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date) || ' days' AS INTERVAL) as grp
        FROM daily_logs
    ) t
    GROUP BY user_id, grp
    -- 어제나 오늘 기록이 있어야 '현재 진행중인' 스트릭으로 인정
    HAVING MAX(date) >= CURRENT_DATE - INTERVAL '1 day' 
  ),
  badge_winners AS (
    -- 🔥 워커홀릭 (월간 최다 출석)
    (SELECT user_id, 'effort' as type, '워커홀릭' as title, '🔥' as icon, 
            count(distinct date) as val, '일 출석' as unit
     FROM member_logs GROUP BY user_id ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- ⚡ 작심삼일 타파 (현재 연속 출석 1위) - NEW
    (SELECT user_id, 'effort' as type, '멈추지 않는 기관차' as title, '🚂' as icon, 
            days as val, '일 연속' as unit
     FROM streaks ORDER BY days DESC LIMIT 1)

    UNION ALL
    
    -- 🎨 육각형 멤버 (종목 다양성 1위) - NEW
    (SELECT user_id, 'effort' as type, '육각형 멤버' as title, '💎' as icon, 
            count(DISTINCT COALESCE(type, category)) as val, '개 종목' as unit
     FROM member_logs 
     GROUP BY user_id 
     HAVING count(DISTINCT COALESCE(type, category)) >= 2 -- 최소 2개 종목 이상
     ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- 🏋️ 3대 500 꿈나무 (볼륨 킹)
    (SELECT user_id, 'strength' as type, '3대 500 꿈나무' as title, '🦍' as icon, sum(volume_kg)::int as val, 'kg 볼륨' as unit
     FROM member_logs WHERE type = 'strength' GROUP BY user_id HAVING sum(volume_kg) > 0 ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- 🏃 강철 심장 (거리 킹) - 환산 거리 적용
    (SELECT user_id, 'cardio' as type, '지칠 줄 모르는 심장' as title, '🫀' as icon,
            round(sum(calculate_adjusted_distance(distance_km, adjusted_dist_km, name))::numeric, 1) as val, 'km 환산' as unit
     FROM member_logs WHERE type = 'cardio' GROUP BY user_id
     HAVING sum(calculate_adjusted_distance(distance_km, adjusted_dist_km, name)) > 0 ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- 🏂 설원의 지배자 (스노보드 킹)
    (SELECT user_id, 'snowboard' as type, '설원의 지배자' as title, '❄️' as icon, sum(run_count)::int as val, '런' as unit
     FROM member_logs WHERE category = 'snowboard' GROUP BY user_id HAVING sum(run_count) > 0 ORDER BY val DESC LIMIT 1)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', u.id,
      'userName', u.display_name,
      'userProfile', u.profile_image,
      'type', bw.type,
      'title', bw.title,
      'icon', bw.icon,
      'description', bw.val || bw.unit,
      'isMe', (u.id = p_current_user_id)
    ) ORDER BY (u.id = p_current_user_id) DESC, random()
  ) INTO v_badges
  FROM badge_winners bw
  JOIN users u ON u.id = bw.user_id;


  -- 2. 👥 Active Squad (유지)
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', user_id,
      'displayName', display_name,
      'profileImage', profile_image,
      'mainActivity', workout_name,
      'workoutCount', workout_count,
      'activityType', activity_type,
      'lastActiveDate', last_active_date
    ) ORDER BY 
      CASE WHEN activity_type = 'today' THEN 1 ELSE 2 END,
      last_active_date DESC
  ) INTO v_squad
  FROM (
    SELECT DISTINCT ON (wl.user_id)
      wl.user_id,
      u.display_name,
      u.profile_image,
      w.name as workout_name,
      COUNT(*) OVER (PARTITION BY wl.user_id) as workout_count,
      CASE 
        WHEN wl.date = CURRENT_DATE THEN 'today'
        ELSE 'yesterday'
      END as activity_type,
      wl.created_at as last_active_date
    FROM workout_logs wl
    JOIN users u ON u.id = wl.user_id
    JOIN workouts w ON w.workout_log_id = wl.id
    WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id)
      AND wl.is_private = false
      AND wl.date >= CURRENT_DATE - 1
    ORDER BY wl.user_id, wl.created_at DESC
  ) squad_sub;


  -- 3. 📊 Leaderboards (유지 - 로직 동일하므로 생략 없이 포함)
  v_leaderboards := jsonb_build_object(
    'cardio', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'displayName', display_name, 'profileImage', profile_image, 'value', total_val) ORDER BY total_val DESC), '[]'::jsonb)
        FROM (
            SELECT wl.user_id, u.display_name, u.profile_image,
                   ROUND(SUM(calculate_adjusted_distance(w.distance_km, w.adjusted_dist_km, w.name))::numeric, 1) as total_val
            FROM workout_logs wl JOIN users u ON u.id = wl.user_id JOIN workouts w ON w.workout_log_id = wl.id
            WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id)
              AND wl.is_private = false
              AND wl.created_at >= NOW() - INTERVAL '30 days'
              AND w.type = 'cardio'
            GROUP BY wl.user_id, u.display_name, u.profile_image
            HAVING SUM(calculate_adjusted_distance(w.distance_km, w.adjusted_dist_km, w.name)) > 0
            LIMIT 10
        ) t
    ),
    'strength', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'displayName', display_name, 'profileImage', profile_image, 'value', total_val) ORDER BY total_val DESC), '[]'::jsonb)
        FROM (
            SELECT wl.user_id, u.display_name, u.profile_image, ROUND(SUM(COALESCE(w.volume_kg, w.sets * w.reps * w.weight_kg, 0))::numeric, 0) as total_val
            FROM workout_logs wl JOIN users u ON u.id = wl.user_id JOIN workouts w ON w.workout_log_id = wl.id
            WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id) AND wl.is_private = false AND wl.created_at >= NOW() - INTERVAL '30 days' AND (w.type = 'strength' OR w.category IN ('gym', 'home'))
            GROUP BY wl.user_id, u.display_name, u.profile_image HAVING SUM(COALESCE(w.volume_kg, 0)) > 0 LIMIT 10
        ) t
    ),
    'snowboard', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'displayName', display_name, 'profileImage', profile_image, 'value', total_val) ORDER BY total_val DESC), '[]'::jsonb)
        FROM (
            SELECT wl.user_id, u.display_name, u.profile_image, SUM(COALESCE(w.run_count, 0)) as total_val
            FROM workout_logs wl JOIN users u ON u.id = wl.user_id JOIN workouts w ON w.workout_log_id = wl.id
            WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id) AND wl.is_private = false AND wl.created_at >= NOW() - INTERVAL '30 days' AND w.category = 'snowboard'
            GROUP BY wl.user_id, u.display_name, u.profile_image HAVING SUM(COALESCE(w.run_count, 0)) > 0 LIMIT 10
        ) t
    )
  );

  RETURN jsonb_build_object(
    'badges', COALESCE(v_badges, '[]'::jsonb),
    'squad', COALESCE(v_squad, '[]'::jsonb),
    'leaderboards', v_leaderboards
  );
END;
$$ LANGUAGE plpgsql STABLE;