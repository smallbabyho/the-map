-- 성지순례 모임 · 참여자 · 댓글 · 지도 사용 기록(순위) + 관련 함수.
--   meetups          : 공개 모집 / 친구끼리 비공개(초대 코드). 주최자는 만들 때 자동으로 참여자가 된다.
--   meetup_members   : 참여는 join_meetup() 으로만 (정원 · 상태 · 초대 코드 확인 + 사용 기록을 한 번에).
--   meetup_comments  : 대화 · 공지(주최자) · 후기(모임 시간이 지난 뒤). 비공개 모임은 참여자만 읽는다.
--   map_uses         : 지도 '사용' 기록 (가져오기 · 모임). 순위 · 둘러보기 인기순 계산용. 함수로만 쓴다.
--   초대 코드는 참여자만 보도록 meetups 의 invite_code 컬럼은 직접 읽을 수 없고 meetup_invite_code() 로만 준다.

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.meetups (
  id          uuid primary key default gen_random_uuid(),
  map_id      uuid not null references public.maps (id) on delete cascade,
  host_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  meet_at     timestamptz not null,
  meet_point  text not null check (char_length(meet_point) between 1 and 60),
  capacity    integer not null check (capacity between 2 and 50),
  status      text not null default 'open' check (status in ('open', 'closed', 'canceled')),
  visibility  text not null default 'public' check (visibility in ('public', 'private')),
  invite_code text unique check (invite_code is null or invite_code ~ '^[a-z0-9]{8}$'),
  created_at  timestamptz not null default now(),
  constraint meetups_private_has_code check (visibility = 'public' or invite_code is not null)
);
create index if not exists meetups_meet_at_idx on public.meetups (meet_at);
create index if not exists meetups_map_idx on public.meetups (map_id);

create table if not exists public.meetup_members (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index if not exists meetup_members_user_idx on public.meetup_members (user_id);

create table if not exists public.meetup_comments (
  id         uuid primary key default gen_random_uuid(),
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null default 'chat' check (kind in ('chat', 'notice', 'review')),
  body       text not null default '' check (char_length(body) <= 500),
  photo_url  text,
  created_at timestamptz not null default now(),
  constraint meetup_comments_not_empty check (char_length(body) > 0 or photo_url is not null)
);
create index if not exists meetup_comments_meetup_idx on public.meetup_comments (meetup_id, created_at);

create table if not exists public.map_uses (
  id      uuid primary key default gen_random_uuid(),
  map_id  uuid not null references public.maps (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind    text not null check (kind in ('copy', 'meetup')),
  used_at timestamptz not null default now()
);
create index if not exists map_uses_map_month_idx on public.map_uses (map_id, used_at);

-- ---------------------------------------------------------------------------
-- 헬퍼 (security definer: 정책끼리 서로 부르는 무한 반복 방지)
-- ---------------------------------------------------------------------------
create or replace function public.is_meetup_member(p_meetup_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.meetup_members where meetup_id = p_meetup_id and user_id = (select auth.uid()));
$$;

create or replace function public.can_view_meetup(p_meetup_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.meetups m
    where m.id = p_meetup_id and (m.visibility = 'public' or public.is_meetup_member(m.id))
  );
$$;

create or replace function public.is_meetup_host(p_meetup_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.meetups where id = p_meetup_id and host_id = (select auth.uid()));
$$;

/** 비공개 모임 초대 코드 (8자리, 헷갈리는 0 o 1 l i 제외) */
create or replace function public.new_invite_code()
returns text language sql volatile set search_path = ''
as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

revoke all on function public.is_meetup_member(uuid) from public;
revoke all on function public.can_view_meetup(uuid) from public;
revoke all on function public.is_meetup_host(uuid) from public;
grant execute on function public.is_meetup_member(uuid) to anon, authenticated;
grant execute on function public.can_view_meetup(uuid) to anon, authenticated;
grant execute on function public.is_meetup_host(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 트리거: 비공개면 초대 코드 채우기 · 주최자 자동 참여 + 사용 기록
-- ---------------------------------------------------------------------------
create or replace function public.meetups_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.visibility = 'private' and new.invite_code is null then
    new.invite_code := public.new_invite_code();
  elsif new.visibility = 'public' then
    new.invite_code := null;
  end if;
  if tg_op = 'INSERT' and new.meet_at < now() then
    raise exception '지난 시간으로는 모임을 만들 수 없어요.';
  end if;
  if tg_op = 'UPDATE' and new.capacity < (select count(*) from public.meetup_members where meetup_id = new.id) then
    raise exception '이미 참여한 사람보다 정원을 적게 할 수 없어요.';
  end if;
  return new;
end;
$$;
drop trigger if exists meetups_before_write on public.meetups;
create trigger meetups_before_write before insert or update on public.meetups for each row execute function public.meetups_before_write();

create or replace function public.meetups_after_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.meetup_members (meetup_id, user_id) values (new.id, new.host_id) on conflict do nothing;
  insert into public.map_uses (map_id, user_id, kind) values (new.map_id, new.host_id, 'meetup');
  return new;
end;
$$;
drop trigger if exists meetups_after_insert on public.meetups;
create trigger meetups_after_insert after insert on public.meetups for each row execute function public.meetups_after_insert();

-- ---------------------------------------------------------------------------
-- 권한
-- ---------------------------------------------------------------------------
alter table public.meetups enable row level security;
alter table public.meetup_members enable row level security;
alter table public.meetup_comments enable row level security;
alter table public.map_uses enable row level security;

-- invite_code 는 빼고 읽기 권한 (참여자는 meetup_invite_code() 로)
revoke all on public.meetups from anon, authenticated;
grant select (id, map_id, host_id, title, description, meet_at, meet_point, capacity, status, visibility, created_at) on public.meetups to anon, authenticated;
grant insert (map_id, title, description, meet_at, meet_point, capacity, visibility) on public.meetups to authenticated;
grant update (title, description, meet_at, meet_point, capacity, status, visibility) on public.meetups to authenticated;
grant select on public.meetup_members to anon, authenticated;
grant delete on public.meetup_members to authenticated;
grant select on public.meetup_comments to anon, authenticated;
grant insert (meetup_id, kind, body, photo_url) on public.meetup_comments to authenticated;
grant delete on public.meetup_comments to authenticated;
-- map_uses: 직접 권한 없음 (함수로만)

drop policy if exists "meetups: 공개 또는 참여자 읽기" on public.meetups;
-- 주최자 조건은 만드는 순간(참여자 등록 트리거보다 먼저) insert ... returning 이 통과하도록
create policy "meetups: 공개 또는 참여자 읽기" on public.meetups
  for select to anon, authenticated
  using (visibility = 'public' or host_id = (select auth.uid()) or public.is_meetup_member(id));

drop policy if exists "meetups: 볼 수 있는 지도로 만들기" on public.meetups;
create policy "meetups: 볼 수 있는 지도로 만들기" on public.meetups
  for insert to authenticated
  with check (host_id = (select auth.uid()) and public.can_read_map(map_id));

drop policy if exists "meetups: 주최자만 수정" on public.meetups;
create policy "meetups: 주최자만 수정" on public.meetups
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

drop policy if exists "meetup_members: 볼 수 있는 모임만" on public.meetup_members;
create policy "meetup_members: 볼 수 있는 모임만" on public.meetup_members
  for select to anon, authenticated
  using (public.can_view_meetup(meetup_id));

-- 나가기 (주최자는 못 나감: 모임 취소로)
drop policy if exists "meetup_members: 본인 나가기" on public.meetup_members;
create policy "meetup_members: 본인 나가기" on public.meetup_members
  for delete to authenticated
  using (user_id = (select auth.uid()) and not public.is_meetup_host(meetup_id));

drop policy if exists "meetup_comments: 볼 수 있는 모임 읽기" on public.meetup_comments;
create policy "meetup_comments: 볼 수 있는 모임 읽기" on public.meetup_comments
  for select to anon, authenticated
  using (public.can_view_meetup(meetup_id));

drop policy if exists "meetup_comments: 참여자 쓰기" on public.meetup_comments;
create policy "meetup_comments: 참여자 쓰기" on public.meetup_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_meetup_member(meetup_id)
    and (kind <> 'notice' or public.is_meetup_host(meetup_id))
    and (kind <> 'review' or exists (select 1 from public.meetups where id = meetup_id and meet_at <= now()))
  );

drop policy if exists "meetup_comments: 쓴 사람 · 주최자 지우기" on public.meetup_comments;
create policy "meetup_comments: 쓴 사람 · 주최자 지우기" on public.meetup_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_meetup_host(meetup_id));

-- ---------------------------------------------------------------------------
-- 함수: 비공개 모임 열람 · 참여 · 초대 코드
-- ---------------------------------------------------------------------------

-- 초대 코드가 맞으면 비공개 모임 id 를 돌려준다 (화면은 이걸로 '볼 수 있음'을 확인하고 meetup_by_invite 로 읽는다)
create or replace function public.meetup_by_invite(p_meetup_id uuid, p_code text)
returns setof public.meetups language sql stable security definer set search_path = ''
as $$
  select * from public.meetups where id = p_meetup_id and (visibility = 'public' or invite_code = p_code);
$$;

-- 참여자에게만 초대 코드
create or replace function public.meetup_invite_code(p_meetup_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select invite_code from public.meetups where id = p_meetup_id and public.is_meetup_member(id);
$$;

create or replace function public.join_meetup(p_meetup_id uuid, p_code text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  m public.meetups;
  v_count int;
begin
  if (select auth.uid()) is null then raise exception '로그인이 필요해요.'; end if;
  select * into m from public.meetups where id = p_meetup_id for update;
  if m.id is null then raise exception '모임을 찾을 수 없어요.'; end if;
  if m.visibility = 'private' and m.invite_code is distinct from p_code then raise exception '초대 링크로만 참여할 수 있는 모임이에요.'; end if;
  if m.status = 'canceled' then raise exception '취소된 모임이에요.'; end if;
  if m.status = 'closed' or m.meet_at < now() then raise exception '모집이 끝난 모임이에요.'; end if;
  if exists (select 1 from public.meetup_members where meetup_id = m.id and user_id = (select auth.uid())) then
    raise exception '이미 참여한 모임이에요.';
  end if;
  select count(*) into v_count from public.meetup_members where meetup_id = m.id;
  if v_count >= m.capacity then raise exception '정원이 다 찼어요.'; end if;
  insert into public.meetup_members (meetup_id, user_id) values (m.id, (select auth.uid()));
  insert into public.map_uses (map_id, user_id, kind) values (m.map_id, (select auth.uid()), 'meetup');
end;
$$;

revoke all on function public.meetup_by_invite(uuid, text) from public;
revoke all on function public.meetup_invite_code(uuid) from public;
revoke all on function public.join_meetup(uuid, text) from public;
grant execute on function public.meetup_by_invite(uuid, text) to anon, authenticated;
grant execute on function public.meetup_invite_code(uuid) to authenticated;
grant execute on function public.join_meetup(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 함수: 지도 가져오기 (복사 + 사용 기록)
-- ---------------------------------------------------------------------------
create or replace function public.copy_map(p_map_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  src public.maps;
  v_new uuid;
  v_me uuid := (select auth.uid());
begin
  if v_me is null then raise exception '로그인이 필요해요.'; end if;
  select * into src from public.maps where id = p_map_id;
  if src.id is null or not (src.is_public or src.owner_id = v_me or public.is_map_editor(src.id)) then
    raise exception '가져올 수 없는 지도예요.';
  end if;

  insert into public.maps (owner_id, title, theme, is_public, category, marker_shape, line_style, line_width, cover_url)
  values (v_me, case when src.owner_id = v_me then left(src.title || ' (복사본)', 60) else src.title end,
          src.theme, false, src.category, src.marker_shape, src.line_style, src.line_width, src.cover_url)
  returning id into v_new;

  -- 핀: 옛 id → 새 id 를 짝지어 두고 구간을 옮긴다
  create temporary table _pin_map (old_id uuid, new_id uuid) on commit drop;
  insert into _pin_map (old_id, new_id) select id, gen_random_uuid() from public.pins where map_id = src.id;
  insert into public.pins (id, map_id, place_id, sort_order, icon, color, memo, photo_url, visited_at)
  select pm.new_id, v_new, p.place_id, p.sort_order, p.icon, p.color, p.memo, p.photo_url, p.visited_at
  from public.pins p join _pin_map pm on pm.old_id = p.id;
  insert into public.legs (map_id, from_pin_id, to_pin_id, mode, duration_min, is_manual)
  select v_new, f.new_id, t.new_id, l.mode, l.duration_min, l.is_manual
  from public.legs l join _pin_map f on f.old_id = l.from_pin_id join _pin_map t on t.old_id = l.to_pin_id
  where l.map_id = src.id;

  if src.owner_id <> v_me then
    insert into public.map_uses (map_id, user_id, kind) values (src.id, v_me, 'copy');
  end if;
  return v_new;
end;
$$;
revoke all on function public.copy_map(uuid) from public;
grant execute on function public.copy_map(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 함수: 월간 순위 · 둘러보기 (공개 지도만, 주인 제외 · 한 사람 한 번)
-- ---------------------------------------------------------------------------
create or replace function public.map_users_in_month(p_month text)
returns table (map_id uuid, users bigint) language sql stable security definer set search_path = ''
as $$
  select u.map_id, count(distinct u.user_id)
  from public.map_uses u join public.maps m on m.id = u.map_id
  where m.is_public and u.user_id <> m.owner_id and to_char(u.used_at at time zone 'Asia/Seoul', 'YYYY-MM') = p_month
  group by u.map_id;
$$;

create or replace function public.monthly_ranking(p_month text default null, p_limit int default 30)
returns table (map_id uuid, users bigint, rank bigint) language sql stable security definer set search_path = ''
as $$
  select r.map_id, r.users, rank() over (order by r.users desc)
  from public.map_users_in_month(coalesce(p_month, to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'))) r
  where r.users > 0
  order by r.users desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- 둘러보기: 공개 지도 + 이번 달 사용자 수 + 핀 수 (차단한 사람 지도는 화면에서 거른다)
create or replace function public.explore_maps(p_category text default null, p_sort text default 'popular', p_limit int default 60)
returns table (map_id uuid, users bigint, pin_count bigint) language sql stable security definer set search_path = ''
as $$
  select m.id, coalesce(r.users, 0), (select count(*) from public.pins p where p.map_id = m.id)
  from public.maps m
  left join public.map_users_in_month(to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')) r on r.map_id = m.id
  where m.is_public and (p_category is null or m.category = p_category)
  order by case when p_sort = 'recent' then 0 else coalesce(r.users, 0) end desc, m.updated_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

revoke all on function public.map_users_in_month(text) from public;
revoke all on function public.monthly_ranking(text, int) from public;
revoke all on function public.explore_maps(text, text, int) from public;
grant execute on function public.monthly_ranking(text, int) to anon, authenticated;
grant execute on function public.explore_maps(text, text, int) to anon, authenticated;
