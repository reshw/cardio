alter table workouts
add constraint workouts_user_source_unique
unique (user_id, source_activity_id);
