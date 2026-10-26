-- 함께 꾸미기 (공동 편집).
--   map_members : 지도 주인이 아닌 공동 편집자 (최대 10명). 핀 · 구간 · 제목 · 꾸미기를 고칠 수 있다.
--   map_invites : 지도마다 초대 코드 1개. 링크 /maps/{id}/join?code=… 로 들어와 join_map_by_invite() 로 참여.
--   공개 여부(is_public) · 주인(owner_id) 변경과 지도 삭제는 계속 주인만.
--   초대 코드는 남이 읽을 수 없어서 미리보기 · 참여는 security definer 함수로만 한다.

create table if not exists public.map_members (
  map_id     uuid not null references public.maps (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (map_id, user_id)
);
create index if not exists map_members_user_idx on public.map_members (user_id);

create table if not exists public.map_invites (
  map_id  uuid primary key references public.maps (id) on delete cascade,
  code    text not null unique check (code ~ '^[a-z0-9]{8}$')
);

-- 헬퍼: security definer 라서 maps · map_members 의 RLS 를 다시 타지 않는다 (정책끼리 서로 부르는 무한 반복 방지)
create or replace function public.is_map_editor(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.map_members where map_id = p_map_id and user_id = (select auth.uid()));
$$;

create or replace function public.can_edit_map(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.maps m
    where m.id = p_map_id
      and (m.owner_id = (select auth.uid()) or public.is_map_editor(m.id))
  );
$$;

-- 읽기 권한에 공동 편집자 추가 (핀 · 구간 읽기 정책이 이 함수를 쓴다)
create or replace function public.can_read_map(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.maps m
    where m.id = p_map_id
      and (m.is_public or m.owner_id = (select auth.uid()) or public.is_map_editor(m.id))
  );
$$;

revoke all on function public.is_map_editor(uuid) from public;
revoke all on function public.can_edit_map(uuid) from public;
grant execute on function public.is_map_editor(uuid) to anon, authenticated;
grant execute on function public.can_edit_map(uuid) to anon, authenticated;

-- ---- maps: 공동 편집자도 읽고 고친다 (공개 여부 · 주인은 아래 트리거가 막음) ----
drop policy if exists "maps: 공개 또는 주인 읽기" on public.maps;
drop policy if exists "maps: 공개 · 주인 · 편집자 읽기" on public.maps;
create policy "maps: 공개 · 주인 · 편집자 읽기" on public.maps
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()) or public.is_map_editor(id));

drop policy if exists "maps: 주인만 수정" on public.maps;
drop policy if exists "maps: 주인 · 편집자 수정" on public.maps;
create policy "maps: 주인 · 편집자 수정" on public.maps
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_map_editor(id))
  with check (owner_id = (select auth.uid()) or public.is_map_editor(id));

create or replace function public.maps_editor_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.owner_id <> (select auth.uid()) and (new.is_public is distinct from old.is_public or new.owner_id is distinct from old.owner_id) then
    raise exception '공개 여부와 주인은 지도 주인만 바꿀 수 있어요.';
  end if;
  return new;
end;
$$;
drop trigger if exists maps_editor_guard on public.maps;
create trigger maps_editor_guard before update on public.maps for each row execute function public.maps_editor_guard();

-- ---- pins · legs: 주인 → 주인 또는 편집자 ----
drop policy if exists "pins: 지도 주인만 생성" on public.pins;
drop policy if exists "pins: 지도 주인만 수정" on public.pins;
drop policy if exists "pins: 지도 주인만 삭제" on public.pins;
drop policy if exists "pins: 주인 · 편집자 생성" on public.pins;
drop policy if exists "pins: 주인 · 편집자 수정" on public.pins;
drop policy if exists "pins: 주인 · 편집자 삭제" on public.pins;
create policy "pins: 주인 · 편집자 생성" on public.pins for insert to authenticated with check (public.can_edit_map(map_id));
create policy "pins: 주인 · 편집자 수정" on public.pins for update to authenticated using (public.can_edit_map(map_id)) with check (public.can_edit_map(map_id));
create policy "pins: 주인 · 편집자 삭제" on public.pins for delete to authenticated using (public.can_edit_map(map_id));

drop policy if exists "legs: 지도 주인만 생성" on public.legs;
drop policy if exists "legs: 지도 주인만 수정" on public.legs;
drop policy if exists "legs: 지도 주인만 삭제" on public.legs;
drop policy if exists "legs: 주인 · 편집자 생성" on public.legs;
drop policy if exists "legs: 주인 · 편집자 수정" on public.legs;
drop policy if exists "legs: 주인 · 편집자 삭제" on public.legs;
create policy "legs: 주인 · 편집자 생성" on public.legs for insert to authenticated
  with check (public.can_edit_map(map_id) and public.pins_in_map(map_id, from_pin_id, to_pin_id));
create policy "legs: 주인 · 편집자 수정" on public.legs for update to authenticated
  using (public.can_edit_map(map_id))
  with check (public.can_edit_map(map_id) and public.pins_in_map(map_id, from_pin_id, to_pin_id));
create policy "legs: 주인 · 편집자 삭제" on public.legs for delete to authenticated using (public.can_edit_map(map_id));

-- ---- map_members: 같은 지도 사람끼리 서로 보고, 주인은 빼고, 편집자는 나간다 (추가는 함수로만) ----
alter table public.map_members enable row level security;
alter table public.map_invites enable row level security;
grant select, delete on public.map_members to authenticated;
grant select, insert, update on public.map_invites to authenticated;

drop policy if exists "map_members: 같은 지도 사람 읽기" on public.map_members;
create policy "map_members: 같은 지도 사람 읽기" on public.map_members
  for select to authenticated using (public.can_edit_map(map_id));

drop policy if exists "map_members: 주인이 빼기 · 본인이 나가기" on public.map_members;
create policy "map_members: 주인이 빼기 · 본인이 나가기" on public.map_members
  for delete to authenticated using (public.owns_map(map_id) or user_id = (select auth.uid()));

-- 초대 코드: 주인 · 편집자만 읽고, 주인만 만들고 바꾼다
drop policy if exists "map_invites: 주인 · 편집자 읽기" on public.map_invites;
create policy "map_invites: 주인 · 편집자 읽기" on public.map_invites
  for select to authenticated using (public.can_edit_map(map_id));
drop policy if exists "map_invites: 주인 만들기" on public.map_invites;
create policy "map_invites: 주인 만들기" on public.map_invites
  for insert to authenticated with check (public.owns_map(map_id));
drop policy if exists "map_invites: 주인 바꾸기" on public.map_invites;
create policy "map_invites: 주인 바꾸기" on public.map_invites
  for update to authenticated using (public.owns_map(map_id)) with check (public.owns_map(map_id));

-- ---- 초대 링크: 미리보기 · 참여 (코드가 맞을 때만) ----
create or replace function public.map_invite_preview(p_map_id uuid, p_code text)
returns table (map_id uuid, title text, owner_id uuid, owner_nickname text, pin_count bigint, editor_count bigint)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.title, m.owner_id, p.nickname,
         (select count(*) from public.pins where map_id = m.id),
         (select count(*) from public.map_members where map_id = m.id)
  from public.maps m
  join public.map_invites i on i.map_id = m.id and i.code = p_code
  join public.profiles p on p.id = m.owner_id
  where m.id = p_map_id;
$$;

create or replace function public.join_map_by_invite(p_map_id uuid, p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if (select auth.uid()) is null then raise exception '로그인이 필요해요.'; end if;
  select m.owner_id into v_owner
  from public.maps m join public.map_invites i on i.map_id = m.id and i.code = p_code
  where m.id = p_map_id;
  if v_owner is null then raise exception '초대 링크가 바뀌었거나 없어졌어요. 다시 받아 주세요.'; end if;
  if v_owner = (select auth.uid()) then return; end if;
  if (select count(*) from public.map_members where map_id = p_map_id) >= 10 then
    raise exception '함께 꾸미는 사람은 10명까지예요.';
  end if;
  insert into public.map_members (map_id, user_id) values (p_map_id, (select auth.uid())) on conflict do nothing;
end;
$$;

revoke all on function public.map_invite_preview(uuid, text) from public;
revoke all on function public.join_map_by_invite(uuid, text) from public;
grant execute on function public.map_invite_preview(uuid, text) to anon, authenticated;
grant execute on function public.join_map_by_invite(uuid, text) to authenticated;
