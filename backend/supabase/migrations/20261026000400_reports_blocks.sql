-- 신고 · 문제 제보 · 차단.
--   reports : 로그인 사용자는 사람·콘텐츠 신고, 누구나(비로그인 포함) 문제 제보(target = 'bug').
--             보낸 사람도 자기 신고를 다시 볼 수 없고, 관리자만 읽고 처리한다.
--   blocks  : 내가 누구를 차단했는지는 나만 본다.
--   관리자 구분용으로 profiles.role 을 둔다 (프론트 mock 의 role 과 같은 값).

alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  target          text not null check (target in ('user', 'meetup', 'map', 'comment', 'bug')),
  target_id       uuid,
  target_label    text not null default '' check (char_length(target_label) <= 80),
  target_user_id  uuid references public.profiles (id) on delete set null,
  reason          text not null check (reason in ('spam', 'abuse', 'inappropriate', 'scam', 'privacy', 'broken', 'map', 'display', 'suggestion', 'other')),
  detail          text not null default '' check (char_length(detail) <= 1000),
  page_url        text not null default '' check (char_length(page_url) <= 300),
  user_agent      text not null default '' check (char_length(user_agent) <= 300),
  status          text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note      text not null default '' check (char_length(admin_note) <= 500),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  -- 문제 제보는 내용 필수
  constraint reports_bug_detail check (target <> 'bug' or char_length(detail) > 0)
);

create index if not exists reports_open_idx on public.reports (created_at desc) where status = 'open';

create table if not exists public.blocks (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, blocked_id),
  constraint blocks_not_self check (user_id <> blocked_id)
);

alter table public.reports enable row level security;
alter table public.blocks  enable row level security;

grant insert on public.reports to anon, authenticated;
grant select, update on public.reports to authenticated;
grant select, insert, delete on public.blocks to authenticated;

-- 신고 보내기: 로그인 사용자는 본인 이름으로, 비로그인은 문제 제보만
drop policy if exists "reports: 보내기" on public.reports;
create policy "reports: 보내기" on public.reports
  for insert to anon, authenticated
  with check (
    status = 'open'
    and (
      (reporter_id = (select auth.uid()))
      or (reporter_id is null and target = 'bug')
    )
  );

drop policy if exists "reports: 관리자 읽기" on public.reports;
create policy "reports: 관리자 읽기" on public.reports
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "reports: 관리자 처리" on public.reports;
create policy "reports: 관리자 처리" on public.reports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "blocks: 본인 것만" on public.blocks;
create policy "blocks: 본인 것만" on public.blocks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
