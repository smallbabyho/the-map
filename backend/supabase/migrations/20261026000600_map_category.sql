-- 지도 카테고리 (둘러보기에서 나눠 보기).
alter table public.maps add column if not exists category text not null default 'etc';
alter table public.maps drop constraint if exists maps_category_check;
alter table public.maps add constraint maps_category_check
  check (category in ('food', 'cafe', 'date', 'trip', 'daytrip', 'walk', 'culture', 'fandom', 'etc'));
create index if not exists maps_public_category_idx on public.maps (category, updated_at desc) where is_public;
