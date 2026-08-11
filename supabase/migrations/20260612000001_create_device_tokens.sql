create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  fcm_token text not null,
  platform text default 'android',
  updated_at timestamptz default now(),
  unique (user_id, platform)
);

alter table device_tokens enable row level security;

-- 본인 토큰만 upsert 가능
create policy "users can upsert own token"
  on device_tokens
  for all
  using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));
