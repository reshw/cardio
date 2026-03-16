-- Club Dashboard Widget System Migration
-- Allows club owners to customize widget order and visibility

-- Add dashboard_config column to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS dashboard_config JSONB DEFAULT jsonb_build_object(
  'widgets', jsonb_build_array(
    jsonb_build_object('id', 'live_ticker', 'type', 'live_ticker', 'visible', true, 'order', 0),
    jsonb_build_object('id', 'hall_of_fame', 'type', 'hall_of_fame', 'visible', true, 'order', 1),
    jsonb_build_object('id', 'daily_squad', 'type', 'daily_squad', 'visible', true, 'order', 2),
    jsonb_build_object('id', 'leaderboard_cardio', 'type', 'leaderboard', 'visible', true, 'order', 3, 'config', jsonb_build_object('metricType', 'cardio')),
    jsonb_build_object('id', 'leaderboard_strength', 'type', 'leaderboard', 'visible', true, 'order', 4, 'config', jsonb_build_object('metricType', 'strength')),
    jsonb_build_object('id', 'leaderboard_snowboard', 'type', 'leaderboard', 'visible', true, 'order', 5, 'config', jsonb_build_object('metricType', 'snowboard'))
  )
);

-- Add comment
COMMENT ON COLUMN clubs.dashboard_config IS 'Dashboard widget configuration: widget types, visibility, and order';

-- Example dashboard_config structure:
-- {
--   "widgets": [
--     {
--       "id": "live_ticker",
--       "type": "live_ticker",
--       "visible": true,
--       "order": 0
--     },
--     {
--       "id": "hall_of_fame",
--       "type": "hall_of_fame",
--       "visible": true,
--       "order": 1
--     },
--     {
--       "id": "daily_squad",
--       "type": "daily_squad",
--       "visible": true,
--       "order": 2
--     },
--     {
--       "id": "leaderboard_cardio",
--       "type": "leaderboard",
--       "visible": true,
--       "order": 3,
--       "config": {
--         "metricType": "cardio"
--       }
--     },
--     {
--       "id": "leaderboard_strength",
--       "type": "leaderboard",
--       "visible": true,
--       "order": 4,
--       "config": {
--         "metricType": "strength"
--       }
--     },
--     {
--       "id": "leaderboard_snowboard",
--       "type": "leaderboard",
--       "visible": true,
--       "order": 5,
--       "config": {
--         "metricType": "snowboard"
--       }
--     }
--   ]
-- }
