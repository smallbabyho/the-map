-- 노쇼 방지: 주최자가 끝난 모임의 참여자를 '노쇼'로 표시한다.
--   30일 안에(모임 날짜 기준) 노쇼가 2번 쌓이면, 마지막 노쇼 표시부터 14일 동안 새 모임에 참여할 수 없다 (DB 가 막는다).
--   노쇼 기록은 주최자와 본인만 본다.

create table if not exists public.meetup_noshows (
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index if not exists meetup_noshows_user_idx on public.meetup_noshows (user_id);
alter table public.meetup_noshows enable row level security;
grant select, insert, delete on public.meetup_noshows to authenticated;

-- 끝난 내 모임(주최자)의 참여자인가
create or replace function public.can_mark_noshow(p_meetup_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.meetups m
    join public.meetup_members mm on mm.meetup_id = m.id and mm.user_id = p_user_id
    where m.id = p_meetup_id and m.host_id = (select auth.uid()) and m.meet_at < now() and p_user_id <> m.host_id
  );
$$;
revoke all on function public.can_mark_noshow(uuid, uuid) from public;
grant execute on function public.can_mark_noshow(uuid, uuid) to authenticated;

drop policy if exists "meetup_noshows: 주최자 · 본인 읽기" on public.meetup_noshows;
create policy "meetup_noshows: 주최자 · 본인 읽기" on public.meetup_noshows
  for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = (select auth.uid())));

drop policy if exists "meetup_noshows: 주최자 표시" on public.meetup_noshows;
create policy "meetup_noshows: 주최자 표시" on public.meetup_noshows
  for insert to authenticated with check (public.can_mark_noshow(meetup_id, user_id));

drop policy if exists "meetup_noshows: 주최자 취소" on public.meetup_noshows;
create policy "meetup_noshows: 주최자 취소" on public.meetup_noshows
  for delete to authenticated using (public.can_mark_noshow(meetup_id, user_id));

-- 언제까지 참여가 막혔나 (안 막혔으면 null)
create or replace function public.noshow_blocked_until(p_user_id uuid)
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select case when count(*) >= 2 and max(n.created_at) + interval '14 days' > now() then max(n.created_at) + interval '14 days' end
  from public.meetup_noshows n join public.meetups m on m.id = n.meetup_id
  where n.user_id = p_user_id and m.meet_at > now() - interval '30 days';
$$;
revoke all on function public.noshow_blocked_until(uuid) from public, anon, authenticated;

-- 내 노쇼 상태 (화면 안내용)
create or replace function public.my_noshow_status()
returns table (recent_count int, blocked_until timestamptz) language sql stable security definer set search_path = ''
as $$
  select (select count(*)::int from public.meetup_noshows n join public.meetups m on m.id = n.meetup_id
          where n.user_id = (select auth.uid()) and m.meet_at > now() - interval '30 days'),
         public.noshow_blocked_until((select auth.uid()));
$$;
revoke all on function public.my_noshow_status() from public;
grant execute on function public.my_noshow_status() to authenticated;

-- 참여할 때 막기 (주최자 본인이 자기 모임에 들어가는 건 그대로)
create or replace function public.check_noshow_block()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if exists (select 1 from public.meetups m where m.id = new.meetup_id and m.host_id = new.user_id) then
    return new;
  end if;
  v_until := public.noshow_blocked_until(new.user_id);
  if v_until is not null then
    raise exception '노쇼가 2번 쌓여서 %까지 새 모임에 참여할 수 없어요.', to_char(v_until at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"');
  end if;
  return new;
end;
$$;
drop trigger if exists meetup_members_noshow_block on public.meetup_members;
create trigger meetup_members_noshow_block before insert on public.meetup_members
  for each row execute function public.check_noshow_block();
