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
