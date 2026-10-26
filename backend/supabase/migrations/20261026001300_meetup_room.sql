-- 순례방: 모임 참여자끼리만 쓰는 방 (/meetups/[id]/room)
--   meetup_comments : 공개 댓글 → 참여자 전용 채팅으로 (읽기도 참여자만). 공지(주최자) · 후기(모임 뒤) 구분은 그대로.
--   meetup_checkins : 코스 도착 체크. 누가 몇 번째 장소까지 왔는지 서로 본다.
--   두 표 모두 실시간(supabase_realtime)으로 바뀐 걸 바로 받는다. 실시간도 읽기 권한(RLS)을 따른다.

-- ---------------------------------------------------------------------------
-- 채팅: 참여자만 읽기
-- ---------------------------------------------------------------------------
drop policy if exists "meetup_comments: 볼 수 있는 모임 읽기" on public.meetup_comments;
drop policy if exists "meetup_comments: 참여자만 읽기" on public.meetup_comments;
create policy "meetup_comments: 참여자만 읽기" on public.meetup_comments
  for select to authenticated
  using (public.is_meetup_member(meetup_id));
revoke select on public.meetup_comments from anon;

-- ---------------------------------------------------------------------------
-- 도착 체크: (모임, 사람, 핀) 하나씩
-- ---------------------------------------------------------------------------
create table if not exists public.meetup_checkins (
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pin_id     uuid not null references public.pins (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id, pin_id)
);

alter table public.meetup_checkins enable row level security;
grant select, insert, delete on public.meetup_checkins to authenticated;

drop policy if exists "meetup_checkins: 참여자 읽기" on public.meetup_checkins;
create policy "meetup_checkins: 참여자 읽기" on public.meetup_checkins
  for select to authenticated
  using (public.is_meetup_member(meetup_id));

drop policy if exists "meetup_checkins: 내 도착 체크" on public.meetup_checkins;
create policy "meetup_checkins: 내 도착 체크" on public.meetup_checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_meetup_member(meetup_id));

drop policy if exists "meetup_checkins: 내 체크 풀기" on public.meetup_checkins;
create policy "meetup_checkins: 내 체크 풀기" on public.meetup_checkins
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 실시간: 이미 들어 있으면 건너뛴다
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetup_comments') then
    alter publication supabase_realtime add table public.meetup_comments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetup_checkins') then
    alter publication supabase_realtime add table public.meetup_checkins;
  end if;
end;
$$;
