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

-- 기본 데모 계정 시드
-- 참조하는 user_id 가 아직 없는 DB(예: 데이터 없이 마이그레이션만 돌리는 fresh reset)에서
-- FK 위반으로 멈추지 않도록 존재하는 경우에만 삽입. 이후 실제 데이터를 덮어써도(같은 행) 충돌 없게 on conflict.
insert into demo_users (tmp_number, user_id, label)
select v.tmp_number, v.user_id, v.label
from (values
  (0, '9a753212-83f1-41d2-84c2-ef6fc6347154'::uuid, '데모 체험하기'),
  (1, 'f0f85a33-5198-45d3-ab8a-0a8d5471b4c5'::uuid, '임시 체험')
) as v(tmp_number, user_id, label)
where exists (select 1 from public.users where users.id = v.user_id)
on conflict (tmp_number) do nothing;
