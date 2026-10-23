-- 권한(RLS)
--   maps / pins / legs : 공개 지도는 누구나 읽기, 비공개는 주인만. 쓰기는 항상 주인만.
--   places             : 누구나 읽기 (공개 지도를 비로그인으로 볼 때 장소가 비지 않도록),
--                        로그인 사용자만 추가. 수정·삭제 불가.
--   profiles           : 닉네임은 누구나 읽기 (공개 지도 작성자 표시), 수정은 본인만.
-- auth.uid() 를 (select auth.uid()) 로 감싼 건 행마다 다시 계산하지 않게 하는 Supabase 권장 방식이다.

alter table public.profiles enable row level security;
alter table public.maps     enable row level security;
alter table public.places   enable row level security;
alter table public.pins     enable row level security;
alter table public.legs     enable row level security;

-- 프로젝트 설정에 따라 기본 권한이 없을 수 있어서 명시적으로 부여한다. (실제 제한은 RLS 가 한다)
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.maps, public.places, public.pins, public.legs to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.maps, public.pins, public.legs to authenticated;
grant insert on public.places to authenticated;

-- ---------------------------------------------------------------------------
-- 헬퍼 함수: 정책마다 같은 서브쿼리를 반복하지 않도록 묶었다.
--   security definer 라서 maps 의 RLS 를 다시 타지 않는다 (함수 안에서 직접 조건을 검사함).
-- ---------------------------------------------------------------------------
create or replace function public.can_read_map(p_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.maps m
    where m.id = p_map_id
      and (m.is_public or m.owner_id = (select auth.uid()))
  );
$$;

create or replace function public.owns_map(p_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.maps m
    where m.id = p_map_id
      and m.owner_id = (select auth.uid())
  );
$$;

-- 이동구간의 양쪽 핀이 모두 같은 지도에 속하는지 확인 (남의 지도 핀을 잇는 것 방지)
create or replace function public.pins_in_map(p_map_id uuid, p_from uuid, p_to uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.pins p
    where p.map_id = p_map_id and p.id in (p_from, p_to)
  ) = 2;
$$;

revoke all on function public.can_read_map(uuid) from public;
revoke all on function public.owns_map(uuid) from public;
revoke all on function public.pins_in_map(uuid, uuid, uuid) from public;
grant execute on function public.can_read_map(uuid) to anon, authenticated;
grant execute on function public.owns_map(uuid) to anon, authenticated;
grant execute on function public.pins_in_map(uuid, uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: 누구나 읽기" on public.profiles;
create policy "profiles: 누구나 읽기" on public.profiles
  for select to anon, authenticated
  using (true);

drop policy if exists "profiles: 본인만 수정" on public.profiles;
create policy "profiles: 본인만 수정" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- insert 정책은 없음: 가입 트리거(security definer)가 만든다.

-- ---------------------------------------------------------------------------
-- maps
-- ---------------------------------------------------------------------------
drop policy if exists "maps: 공개 또는 주인 읽기" on public.maps;
create policy "maps: 공개 또는 주인 읽기" on public.maps
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));

drop policy if exists "maps: 주인만 생성" on public.maps;
create policy "maps: 주인만 생성" on public.maps
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "maps: 주인만 수정" on public.maps;
create policy "maps: 주인만 수정" on public.maps
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "maps: 주인만 삭제" on public.maps;
create policy "maps: 주인만 삭제" on public.maps
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
drop policy if exists "places: 누구나 읽기" on public.places;
create policy "places: 누구나 읽기" on public.places
  for select to anon, authenticated
  using (true);

drop policy if exists "places: 로그인 사용자 추가" on public.places;
create policy "places: 로그인 사용자 추가" on public.places
  for insert to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- pins
-- ---------------------------------------------------------------------------
drop policy if exists "pins: 지도 읽기 권한 따라감" on public.pins;
create policy "pins: 지도 읽기 권한 따라감" on public.pins
  for select to anon, authenticated
  using (public.can_read_map(map_id));

drop policy if exists "pins: 지도 주인만 생성" on public.pins;
create policy "pins: 지도 주인만 생성" on public.pins
  for insert to authenticated
  with check (public.owns_map(map_id));

drop policy if exists "pins: 지도 주인만 수정" on public.pins;
create policy "pins: 지도 주인만 수정" on public.pins
  for update to authenticated
  using (public.owns_map(map_id))
  with check (public.owns_map(map_id));

drop policy if exists "pins: 지도 주인만 삭제" on public.pins;
create policy "pins: 지도 주인만 삭제" on public.pins
  for delete to authenticated
  using (public.owns_map(map_id));

-- ---------------------------------------------------------------------------
-- legs
-- ---------------------------------------------------------------------------
drop policy if exists "legs: 지도 읽기 권한 따라감" on public.legs;
create policy "legs: 지도 읽기 권한 따라감" on public.legs
  for select to anon, authenticated
  using (public.can_read_map(map_id));

drop policy if exists "legs: 지도 주인만 생성" on public.legs;
create policy "legs: 지도 주인만 생성" on public.legs
  for insert to authenticated
  with check (public.owns_map(map_id) and public.pins_in_map(map_id, from_pin_id, to_pin_id));

drop policy if exists "legs: 지도 주인만 수정" on public.legs;
create policy "legs: 지도 주인만 수정" on public.legs
  for update to authenticated
  using (public.owns_map(map_id))
  with check (public.owns_map(map_id) and public.pins_in_map(map_id, from_pin_id, to_pin_id));

drop policy if exists "legs: 지도 주인만 삭제" on public.legs;
create policy "legs: 지도 주인만 삭제" on public.legs
  for delete to authenticated
  using (public.owns_map(map_id));
