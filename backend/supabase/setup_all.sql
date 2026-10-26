-- ============================================================================
-- 컨셉지도 DB 전체 설정 (자동 생성 파일 — 직접 고치지 말고 migrations/ 를 고친 뒤 다시 만든다)
-- migrations/ 의 SQL 17개를 파일 이름 순서대로 이어 붙인 것.
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여 넣고 Run. 여러 번 실행해도 괜찮다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- migrations/20261023000100_tables.sql
-- ---------------------------------------------------------------------------
-- 컨셉지도 기본 테이블
-- 적용: `supabase db push` 또는 대시보드 SQL Editor 에서 파일 순서대로 실행 (backend/README.md 참고)
-- 여러 번 실행해도 에러가 나지 않도록 if not exists / or replace 로 작성했다.

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신용 공용 트리거 함수
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: auth.users 1:1. 가입 시 트리거(20261023000400)가 자동 생성한다.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 30),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- maps: 사용자가 만든 컨셉지도
--   owner_id 기본값이 auth.uid() 라서 프론트는 owner_id 를 안 보내도 된다.
-- ---------------------------------------------------------------------------
create table if not exists public.maps (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title      text not null default '',
  theme      text not null default 'default',
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maps_owner_id_idx on public.maps (owner_id);
create index if not exists maps_public_idx on public.maps (created_at desc) where is_public;

drop trigger if exists maps_set_updated_at on public.maps;
create trigger maps_set_updated_at
  before update on public.maps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- places: 카카오 장소. 같은 external_id 는 한 줄만 존재하고 모든 지도가 공유한다.
--   새로 만들 때는 get_or_create_place() 함수를 쓴다 (아래).
-- ---------------------------------------------------------------------------
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pins: 지도 위 핀
--   "order" 는 SQL 예약어라 컬럼명은 sort_order. src/db/index.ts 에서 order 로 변환한다.
--   순서 변경 중 값이 잠깐 겹쳐도 에러가 나지 않도록 sort_order 에 unique 를 걸지 않았다.
-- ---------------------------------------------------------------------------
create table if not exists public.pins (
  id         uuid primary key default gen_random_uuid(),
  map_id     uuid not null references public.maps (id) on delete cascade,
  place_id   uuid not null references public.places (id) on delete restrict,
  sort_order integer not null default 0,
  icon       text,
  color      text,
  memo       text,
  photo_url  text,
  visited_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pins_map_id_sort_idx on public.pins (map_id, sort_order);
create index if not exists pins_place_id_idx on public.pins (place_id);

drop trigger if exists pins_set_updated_at on public.pins;
create trigger pins_set_updated_at
  before update on public.pins
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- legs: 핀과 핀 사이 이동구간
--   핀이 지워지면 연결된 구간도 같이 지워진다.
--   (map_id, from_pin_id, to_pin_id) 가 unique 라서 같은 구간은 upsert 로 덮어쓸 수 있다.
-- ---------------------------------------------------------------------------
create table if not exists public.legs (
  id           uuid primary key default gen_random_uuid(),
  map_id       uuid not null references public.maps (id) on delete cascade,
  from_pin_id  uuid not null references public.pins (id) on delete cascade,
  to_pin_id    uuid not null references public.pins (id) on delete cascade,
  mode         text not null default 'walk' check (mode in ('walk', 'bus', 'subway', 'car')),
  duration_min integer check (duration_min is null or duration_min >= 0),
  is_manual    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint legs_not_self check (from_pin_id <> to_pin_id),
  constraint legs_pair_unique unique (map_id, from_pin_id, to_pin_id)
);

create index if not exists legs_from_pin_idx on public.legs (from_pin_id);
create index if not exists legs_to_pin_idx on public.legs (to_pin_id);

drop trigger if exists legs_set_updated_at on public.legs;
create trigger legs_set_updated_at
  before update on public.legs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- migrations/20261023000200_rls.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- migrations/20261023000300_place_upsert.sql
-- ---------------------------------------------------------------------------
-- get_or_create_place: 같은 external_id(카카오 장소 ID)가 있으면 그 id 를, 없으면 새로 만들어 id 를 돌려준다.
--   두 사람이 같은 장소를 동시에 추가해도 중복이나 unique 에러가 나지 않는다.
--   places 에는 update 권한이 없어서 클라이언트의 upsert 대신 이 함수를 쓴다.
--
-- 사용 예 (src/db/index.ts 에서):
--   const { data: placeId } = await supabase.rpc('get_or_create_place', {
--     p_external_id: '8134820', p_name: '카페 어니언 성수', p_lat: 37.5446, p_lng: 127.0583,
--   })
create or replace function public.get_or_create_place(
  p_external_id text,
  p_name        text,
  p_lat         double precision,
  p_lng         double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  insert into public.places (external_id, name, lat, lng)
  values (p_external_id, p_name, p_lat, p_lng)
  on conflict (external_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.places where external_id = p_external_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_place(text, text, double precision, double precision) from public, anon;
grant execute on function public.get_or_create_place(text, text, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- migrations/20261023000400_profile_trigger.sql
-- ---------------------------------------------------------------------------
-- 가입하면 profiles 를 자동으로 만든다.
--   닉네임은 signUp 때 options.data.nickname 으로 넘긴 값 (src/auth 에서 처리).
--   이메일 인증을 켜면 가입 직후엔 세션이 없어 클라이언트에서 insert 할 수 없기 때문에 트리거로 처리한다.
--   닉네임이 비어 있거나 30자를 넘어도 가입 자체가 실패하지 않도록 보정한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
begin
  v_nickname := left(trim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), 30);
  if v_nickname = '' then
    v_nickname := left(coalesce(split_part(new.email, '@', 1), ''), 30);
  end if;
  if v_nickname = '' then
    v_nickname := '사용자';
  end if;

  insert into public.profiles (id, nickname)
  values (new.id, v_nickname)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- migrations/20261023000500_storage.sql
-- ---------------------------------------------------------------------------
-- 핀 사진 버킷 pin-photos
--   파일 경로 규칙: {user_id}/{파일명}  →  본인 폴더에만 업로드·수정·삭제 가능
--   public 버킷이라 photo_url 에 영구 공개 URL 을 저장할 수 있다.
--   (주의: 비공개 지도의 사진도 URL 을 알면 볼 수 있다. 파일명은 추측 불가능한 uuid 로 만든다.)
--   용량 5MB, 이미지 형식만 허용.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pin-photos',
  'pin-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pin-photos: 본인 폴더 읽기" on storage.objects;
create policy "pin-photos: 본인 폴더 읽기" on storage.objects
  for select to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "pin-photos: 본인 폴더 업로드" on storage.objects;
create policy "pin-photos: 본인 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "pin-photos: 본인 폴더 수정" on storage.objects;
create policy "pin-photos: 본인 폴더 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "pin-photos: 본인 폴더 삭제" on storage.objects;
create policy "pin-photos: 본인 폴더 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- migrations/20261023000600_leg_modes.sql
-- ---------------------------------------------------------------------------
-- 이동수단을 4가지로: 도보(walk) · 대중교통(transit) · 자동차(car) · 자전거(bike)
-- 예전 버스(bus) · 지하철(subway) 은 대중교통으로 합친다.

alter table public.legs drop constraint if exists legs_mode_check;

update public.legs set mode = 'transit' where mode in ('bus', 'subway');

alter table public.legs
  add constraint legs_mode_check check (mode in ('walk', 'transit', 'car', 'bike'));

-- ---------------------------------------------------------------------------
-- migrations/20261024000100_map_theme.sql
-- ---------------------------------------------------------------------------
-- 지도 색 테마: 프리셋(default · pastel · vintage · neon · forest) 또는 직접 고른 색 '#rrggbb'.
-- 배경(라이트/다크)은 이제 보는 사람이 정하므로 예전 'dark' 테마는 색만 남겨 'neon' 으로.

alter table public.maps drop constraint if exists maps_theme_check;

update public.maps set theme = 'neon' where theme = 'dark';
update public.maps set theme = 'default'
  where theme !~ '^(default|pastel|vintage|neon|forest|#[0-9a-fA-F]{6})$';

alter table public.maps
  add constraint maps_theme_check check (theme ~ '^(default|pastel|vintage|neon|forest|#[0-9a-fA-F]{6})$');

-- ---------------------------------------------------------------------------
-- migrations/20261026000100_profile_deco.sql
-- ---------------------------------------------------------------------------
-- 프로필 꾸미기 (다이어리처럼): 속지 · 글꼴 · 소개글 · 스티커 · 대표 지도.
-- 한 사람에 한 줄. 꾸민 적 없으면 줄이 없고, 프론트가 기본값을 쓴다.
-- 공개 프로필이라 누구나 읽고, 쓰기는 본인만.

create table if not exists public.profile_decos (
  user_id        uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  paper          text not null default 'plain' check (paper in ('plain', 'lined', 'grid', 'dot', 'kraft', 'cream')),
  color          text not null default '#ffffff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  font           text not null default 'basic' check (font in ('basic', 'hand', 'round', 'serif', 'pen')),
  bio            text not null default '' check (char_length(bio) <= 150),
  mood           text not null default '' check (char_length(mood) <= 40),
  -- [{ id, emoji, x, y, size, rotate }] (x · y 는 %)
  stickers       jsonb not null default '[]' check (jsonb_typeof(stickers) = 'array' and jsonb_array_length(stickers) <= 30),
  -- 고른 순서대로. 비공개가 된 지도는 읽을 때 빠진다.
  pinned_map_ids uuid[] not null default '{}' check (cardinality(pinned_map_ids) <= 6),
  map_style      text not null default 'polaroid' check (map_style in ('polaroid', 'tape')),
  -- { intro, stickers, maps }: 꾸미기 요소별로 보일지 말지
  sections       jsonb not null default '{"intro": true, "stickers": true, "maps": true}' check (jsonb_typeof(sections) = 'object'),
  updated_at     timestamptz not null default now()
);

drop trigger if exists profile_decos_set_updated_at on public.profile_decos;
create trigger profile_decos_set_updated_at
  before update on public.profile_decos
  for each row execute function public.set_updated_at();

alter table public.profile_decos enable row level security;

grant select on public.profile_decos to anon, authenticated;
grant insert, update on public.profile_decos to authenticated;

drop policy if exists "profile_decos: 누구나 읽기" on public.profile_decos;
create policy "profile_decos: 누구나 읽기" on public.profile_decos
  for select to anon, authenticated
  using (true);

drop policy if exists "profile_decos: 본인만 만들기" on public.profile_decos;
create policy "profile_decos: 본인만 만들기" on public.profile_decos
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "profile_decos: 본인만 수정" on public.profile_decos;
create policy "profile_decos: 본인만 수정" on public.profile_decos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- migrations/20261026000200_avatar.sql
-- ---------------------------------------------------------------------------
-- 프로필 사진: profiles.avatar_url + 공개 버킷 avatars.
--   파일 경로 규칙: {user_id}/{파일명}  →  본인 폴더에만 업로드·수정·삭제 가능
--   프로필 사진은 원래 누구나 보는 것이라 읽기는 공개 (public 버킷이라 URL 로 바로 보인다).
--   용량 2MB, 이미지 형식만 허용 (프론트가 400px 로 줄여서 올린다).

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: 본인 폴더 업로드" on storage.objects;
create policy "avatars: 본인 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: 본인 폴더 수정" on storage.objects;
create policy "avatars: 본인 폴더 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: 본인 폴더 삭제" on storage.objects;
create policy "avatars: 본인 폴더 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- migrations/20261026000300_map_look.sql
-- ---------------------------------------------------------------------------
-- 지도 꾸미기: 마커 모양 · 코스 선 모양/굵기 · 커버 이미지.
--   line_style 'auto' 는 이동수단별 선 (도보 점선 · 대중교통 대시 · 자동차 실선).
--   커버 이미지는 pin-photos 버킷의 본인 폴더에 올리고 공개 URL 을 저장한다.

alter table public.maps add column if not exists marker_shape text not null default 'pin';
alter table public.maps add column if not exists line_style   text not null default 'auto';
alter table public.maps add column if not exists line_width   text not null default 'normal';
alter table public.maps add column if not exists cover_url    text;

alter table public.maps drop constraint if exists maps_marker_shape_check;
alter table public.maps add constraint maps_marker_shape_check check (marker_shape in ('pin', 'circle', 'square', 'emoji'));
alter table public.maps drop constraint if exists maps_line_style_check;
alter table public.maps add constraint maps_line_style_check check (line_style in ('auto', 'solid', 'dash', 'dot'));
alter table public.maps drop constraint if exists maps_line_width_check;
alter table public.maps add constraint maps_line_width_check check (line_width in ('thin', 'normal', 'bold'));

-- ---------------------------------------------------------------------------
-- migrations/20261026000400_reports_blocks.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- migrations/20261026000500_profile_banner.sql
-- ---------------------------------------------------------------------------
-- 프로필 배너 사진 (트위터처럼 프로필 맨 위). pin-photos 버킷 본인 폴더에 올리고 공개 URL 을 저장한다.
alter table public.profile_decos add column if not exists banner_url text;

-- ---------------------------------------------------------------------------
-- migrations/20261026000600_map_category.sql
-- ---------------------------------------------------------------------------
-- 지도 카테고리 (둘러보기에서 나눠 보기).
alter table public.maps add column if not exists category text not null default 'etc';
alter table public.maps drop constraint if exists maps_category_check;
alter table public.maps add constraint maps_category_check
  check (category in ('food', 'cafe', 'date', 'trip', 'daytrip', 'walk', 'culture', 'fandom', 'etc'));
create index if not exists maps_public_category_idx on public.maps (category, updated_at desc) where is_public;

-- ---------------------------------------------------------------------------
-- migrations/20261026000700_map_collab.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- migrations/20261026000800_meetups.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- migrations/20261026000900_admin.sql
-- ---------------------------------------------------------------------------
-- 관리자 기능 (관리자 화면 /customers). 모두 is_admin() 을 확인하는 security definer 함수라서
-- 서버 비밀 키(service_role) 없이 브라우저에서 바로 부를 수 있다. 관리자가 아니면 에러.
--   정지: profiles.suspended + auth.users.banned_until 을 먼 미래로 → 로그인 · 토큰 갱신이 막힌다.
--   탈퇴: auth.users 에서 지우면 profiles 부터 지도 · 모임까지 on delete cascade 로 같이 지워진다.

alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.require_admin() from public;

-- 회원 목록 + 활동 수 (가입 최신순)
create or replace function public.admin_list_users()
returns table (id uuid, email text, nickname text, avatar_url text, role text, suspended boolean, created_at timestamptz, map_count bigint, meetup_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select p.id, u.email::text, p.nickname, p.avatar_url, p.role, p.suspended, u.created_at,
           (select count(*) from public.maps m where m.owner_id = p.id),
           (select count(*) from public.meetups mt where mt.host_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;

-- 현황 숫자
create or replace function public.admin_stats()
returns table (reports_open bigint, users bigint, suspended bigint, maps bigint, public_maps bigint, meetups_open bigint, uses_this_month bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  return query select
    (select count(*) from public.reports where status = 'open'),
    (select count(*) from public.profiles),
    (select count(*) from public.profiles p where p.suspended),
    (select count(*) from public.maps),
    (select count(*) from public.maps where is_public),
    (select count(*) from public.meetups where status = 'open' and meet_at >= now()),
    (select count(*) from public.map_uses where to_char(used_at at time zone 'Asia/Seoul', 'YYYY-MM') = to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'));
end;
$$;

-- 닉네임 · 권한 · 정지 바꾸기 (null 이면 그대로). 내 계정의 권한 · 정지는 못 바꾼다.
create or replace function public.admin_update_user(p_user_id uuid, p_nickname text default null, p_role text default null, p_suspended boolean default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_user_id = (select auth.uid()) and (p_role = 'user' or p_suspended) then
    raise exception '내 계정의 관리자 권한이나 상태는 바꿀 수 없어요.';
  end if;
  if p_nickname is not null and char_length(trim(p_nickname)) = 0 then raise exception '닉네임을 입력해 주세요.'; end if;
  update public.profiles set
    nickname  = coalesce(left(trim(p_nickname), 30), nickname),
    role      = coalesce(p_role, role),
    suspended = coalesce(p_suspended, suspended)
  where id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없어요.'; end if;
  if p_suspended is not null then
    update auth.users set banned_until = case when p_suspended then 'infinity'::timestamptz else null end where id = p_user_id;
  end if;
end;
$$;

-- 탈퇴 처리 (되돌릴 수 없음)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_user_id = (select auth.uid()) then raise exception '내 계정은 여기서 삭제할 수 없어요.'; end if;
  delete from auth.users where id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없어요.'; end if;
end;
$$;

-- 신고 처리 + 콘텐츠 내리기 (댓글 삭제 · 모임 취소 · 지도 비공개)
create or replace function public.admin_resolve_report(p_report_id uuid, p_status text, p_note text default '', p_remove_content boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r public.reports;
begin
  perform public.require_admin();
  select * into r from public.reports where id = p_report_id;
  if r.id is null then raise exception '신고를 찾을 수 없어요.'; end if;
  if p_remove_content and r.target_id is not null then
    if r.target = 'comment' then delete from public.meetup_comments where id = r.target_id;
    elsif r.target = 'meetup' then update public.meetups set status = 'canceled' where id = r.target_id;
    elsif r.target = 'map' then update public.maps set is_public = false where id = r.target_id;
    end if;
  end if;
  update public.reports set
    status = p_status,
    admin_note = left(coalesce(p_note, ''), 500),
    resolved_at = case when p_status = 'open' then null else now() end
  where id = p_report_id;
end;
$$;

revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_stats() from public;
revoke all on function public.admin_update_user(uuid, text, text, boolean) from public;
revoke all on function public.admin_delete_user(uuid) from public;
revoke all on function public.admin_resolve_report(uuid, text, text, boolean) from public;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text, boolean) to authenticated;

-- 일반 사용자가 profiles 를 고칠 때 role · suspended 는 못 바꾸게 (관리자 함수는 security definer 라 통과)
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.suspended is distinct from old.suspended) and current_user = 'authenticated' then
    raise exception '권한 · 정지 상태는 관리자만 바꿀 수 있어요.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------
-- migrations/20261026001000_meetup_map_access.sql
-- ---------------------------------------------------------------------------
-- 모임에 쓰인 지도는 그 모임을 볼 수 있는 사람에게 보인다 (주최자의 비공개 지도로 연 모임도 코스가 보이게).
--   공개 모임 → 누구나 · 비공개 모임 → 참여자만. 보기만 가능하고 고치기는 그대로 주인 · 공동 편집자만.

create or replace function public.map_in_visible_meetup(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.meetups mt
    where mt.map_id = p_map_id and mt.status <> 'canceled'
      and (mt.visibility = 'public' or public.is_meetup_member(mt.id))
  );
$$;
revoke all on function public.map_in_visible_meetup(uuid) from public;
grant execute on function public.map_in_visible_meetup(uuid) to anon, authenticated;

-- 핀 · 구간 읽기 정책이 쓰는 함수
create or replace function public.can_read_map(p_map_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.maps m
    where m.id = p_map_id
      and (m.is_public or m.owner_id = (select auth.uid()) or public.is_map_editor(m.id) or public.map_in_visible_meetup(m.id))
  );
$$;

drop policy if exists "maps: 공개 · 주인 · 편집자 읽기" on public.maps;
drop policy if exists "maps: 공개 · 주인 · 편집자 · 모임 읽기" on public.maps;
create policy "maps: 공개 · 주인 · 편집자 · 모임 읽기" on public.maps
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()) or public.is_map_editor(id) or public.map_in_visible_meetup(id));
