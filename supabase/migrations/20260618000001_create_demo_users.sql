create table demo_users (
  tmp_number int primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  label text,
  created_at timestamptz default now()
);

alter table demo_users enable row level security;

-- 게스트 진입 시 익명도 lookup 가능해야 함
create policy "demo_users_select_all"
  on demo_users
  for select
  using (true);

-- 어드민만 INSERT/UPDATE/DELETE
create policy "demo_users_admin_write"
  on demo_users
  for all
  using (
    exists (
      select 1 from users
      where auth_id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from users
      where auth_id = auth.uid() and is_admin = true
    )
  );
