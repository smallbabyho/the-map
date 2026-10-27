-- 순례방에서 코스 고치기 + 주최자의 강제 퇴장.
--   1) 모임 참여자는 그 모임 코스(지도)를 고칠 수 있다: can_edit_map 에 '이 지도로 열린 모임의 참여자' 를 더한다.
--      단, 주최자 본인의 지도일 때만. 남의 공개 지도로 연 모임은 public.meetup_course_map 이 처음 고칠 때
--      주최자 소유의 모임 전용 코스로 복사해서 그쪽을 고친다 (원래 주인의 지도 · 다른 모임 코스는 그대로).
--   2) 강제 퇴장: 주최자만. 내보낸 사람은 그 모임에 다시 참여할 수 없다 (meetup_kicks).
--      퇴장하면 참여자 명단에서 빠지므로 코스 고치기 권한도 같이 사라진다.

-- ---------------------------------------------------------------------------
-- 1) 코스 고치기 권한
-- ---------------------------------------------------------------------------
create or replace function public.is_meetup_course_editor(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.meetups mt
    join public.maps m on m.id = mt.map_id and m.owner_id = mt.host_id
    join public.meetup_members mm on mm.meetup_id = mt.id and mm.user_id = (select auth.uid())
    where mt.map_id = p_map_id and mt.status <> 'canceled'
  );
$$;
revoke all on function public.is_meetup_course_editor(uuid) from public;
grant execute on function public.is_meetup_course_editor(uuid) to anon, authenticated;

create or replace function public.can_edit_map(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.maps m
    where m.id = p_map_id
      and (m.owner_id = (select auth.uid()) or public.is_map_editor(m.id) or public.is_meetup_course_editor(m.id))
  );
$$;

-- 지도 이름 · 꾸미기 저장도 (편집 화면은 저장할 때 지도 정보도 같이 쓴다)
drop policy if exists "maps: 주인 · 편집자 수정" on public.maps;
create policy "maps: 주인 · 편집자 수정" on public.maps
  for update to authenticated
  using (public.can_edit_map(id))
  with check (public.can_edit_map(id));

-- 주인이 아니면 지도를 공개로 바꿀 수 없다 (공동 편집자 · 모임 참여자 모두). 비공개로 돌리기(관리자 신고 처리 등)는 그대로
create or replace function public.keep_map_visibility()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_public and not old.is_public and old.owner_id is distinct from (select auth.uid()) and not public.is_admin() then
    new.is_public := false;
  end if;
  return new;
end;
$$;
drop trigger if exists maps_keep_visibility on public.maps;
create trigger maps_keep_visibility before update on public.maps
  for each row execute function public.keep_map_visibility();

-- ---------------------------------------------------------------------------
-- 순례방에서 '코스 고치기' 를 누르면: 고칠 지도 id. 남의 지도로 연 모임이면 모임 전용 코스로 복사해서 돌려준다
-- ---------------------------------------------------------------------------
create or replace function public.meetup_course_map(p_meetup_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  mt public.meetups;
  src public.maps;
  v_new uuid;
begin
  if (select auth.uid()) is null then raise exception '로그인이 필요해요.'; end if;
  select * into mt from public.meetups where id = p_meetup_id for update;
  if mt.id is null then raise exception '모임을 찾을 수 없어요.'; end if;
  if mt.status = 'canceled' then raise exception '취소된 모임이에요.'; end if;
  if not public.is_meetup_member(mt.id) then raise exception '모임에 참여한 사람만 코스를 고칠 수 있어요.'; end if;

  select * into src from public.maps where id = mt.map_id;
  if src.owner_id = mt.host_id then
    return src.id;
  end if;

  -- 주최자 소유의 비공개 '계획' 으로 복사 (참여자는 모임을 통해 본다)
  insert into public.maps (owner_id, title, theme, is_public, category, marker_shape, line_style, line_width, cover_url, purpose, category_label)
  values (mt.host_id, left(src.title || ' · ' || mt.title, 60), src.theme, false, src.category, src.marker_shape, src.line_style, src.line_width, src.cover_url, 'plan', src.category_label)
  returning id into v_new;

  create temporary table _course_pins (old_id uuid, new_id uuid) on commit drop;
  insert into _course_pins (old_id, new_id) select id, gen_random_uuid() from public.pins where map_id = src.id;
  insert into public.pins (id, map_id, place_id, sort_order, icon, color, memo, photo_url, visited_at)
  select cp.new_id, v_new, p.place_id, p.sort_order, p.icon, p.color, p.memo, p.photo_url, null
  from public.pins p join _course_pins cp on cp.old_id = p.id;
  insert into public.legs (map_id, from_pin_id, to_pin_id, mode, duration_min, is_manual)
  select v_new, f.new_id, t.new_id, l.mode, l.duration_min, l.is_manual
  from public.legs l join _course_pins f on f.old_id = l.from_pin_id join _course_pins t on t.old_id = l.to_pin_id
  where l.map_id = src.id;

  -- 이미 찍은 도착 인증은 새 코스의 같은 장소로 옮긴다
  update public.meetup_checkins c set pin_id = cp.new_id
  from _course_pins cp where c.meetup_id = mt.id and c.pin_id = cp.old_id;

  update public.meetups set map_id = v_new where id = mt.id;
  return v_new;
end;
$$;
revoke all on function public.meetup_course_map(uuid) from public;
grant execute on function public.meetup_course_map(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) 강제 퇴장
-- ---------------------------------------------------------------------------
create table if not exists public.meetup_kicks (
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
alter table public.meetup_kicks enable row level security;
-- 직접 읽고 쓰지 않는다 (아래 함수 · 트리거로만)

create or replace function public.kick_meetup_member(p_meetup_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_meetup_host(p_meetup_id) then raise exception '주최자만 내보낼 수 있어요.'; end if;
  if p_user_id = (select auth.uid()) then raise exception '주최자는 자신을 내보낼 수 없어요.'; end if;
  delete from public.meetup_members where meetup_id = p_meetup_id and user_id = p_user_id;
  delete from public.meetup_checkins where meetup_id = p_meetup_id and user_id = p_user_id;
  insert into public.meetup_kicks (meetup_id, user_id) values (p_meetup_id, p_user_id) on conflict do nothing;
end;
$$;
revoke all on function public.kick_meetup_member(uuid, uuid) from public;
grant execute on function public.kick_meetup_member(uuid, uuid) to authenticated;

-- 내보낸 사람은 다시 못 들어온다
create or replace function public.check_meetup_kick()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.meetup_kicks where meetup_id = new.meetup_id and user_id = new.user_id) then
    raise exception '주최자가 내보낸 모임이라 다시 참여할 수 없어요.';
  end if;
  return new;
end;
$$;
drop trigger if exists meetup_members_kick_block on public.meetup_members;
create trigger meetup_members_kick_block before insert on public.meetup_members
  for each row execute function public.check_meetup_kick();
