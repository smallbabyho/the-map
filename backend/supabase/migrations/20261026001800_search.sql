-- 검색: 공개 지도(제목 · 안에 든 장소 이름) / 사람(닉네임).
--   지도 필터: 용도(기록/계획) · 카테고리 · 지역(시 · 도, 핀이 하나라도 그 지역에 있으면) · 장소 수 · 모집 중인 성지순례 여부 · 정렬.
--   검색어는 지도 제목 · 장소 이름 · 직접 적은 카테고리 이름에, 그리고 화면이 넘긴 기본 카테고리(p_q_categories, 예: '카페' → cafe)에 맞춰 본다.

-- 직접 적은 카테고리 이름 (category = 'etc' 일 때 '기타' 대신 보인다)
alter table public.maps add column if not exists category_label text;
alter table public.maps drop constraint if exists maps_category_label_check;
alter table public.maps add constraint maps_category_label_check check (category_label is null or char_length(category_label) between 1 and 20);

-- 예전 모양으로 먼저 만들어 둔 경우 지운다
drop function if exists public.search_maps(text, text, text, double precision, double precision, double precision, double precision, int, boolean, text, int);
drop function if exists public.search_maps(text, text, text, double precision, double precision, double precision, double precision, int, boolean, text, int, text[]);

-- 좌표 → 시 · 도 id (근사). 화면 src/components/regions.ts 의 regionOf 와 숫자 · 순서를 똑같이 맞춘다.
--   특별 · 광역시는 중심에서 반경(km) 안이면 그 도시(가까운 것 먼저), 아니면 가장 가까운 도 중심.
create or replace function public.region_of(p_lat double precision, p_lng double precision)
returns text language sql immutable set search_path = ''
as $$
  with metro(id, lat, lng, radius) as (values
    ('seoul', 37.5665, 126.978, 16),
    ('busan', 35.18, 129.075, 16),
    ('daegu', 35.871, 128.601, 17),
    ('incheon', 37.456, 126.705, 15),
    ('gwangju', 35.16, 126.851, 13),
    ('daejeon', 36.35, 127.385, 14),
    ('ulsan', 35.539, 129.311, 20),
    ('sejong', 36.48, 127.289, 11)
  ), prov(id, lat, lng) as (values
    ('gyeonggi', 37.45, 127.2),
    ('gangwon', 37.75, 128.3),
    ('chungbuk', 36.75, 127.75),
    ('chungnam', 36.55, 126.85),
    ('jeonbuk', 35.72, 127.15),
    ('jeonnam', 34.85, 126.95),
    ('gyeongbuk', 36.35, 128.75),
    ('gyeongnam', 35.3, 128.25),
    ('jeju', 33.4, 126.55)
  )
  select coalesce(
    (select id from metro
      where sqrt(power((p_lat - lat) * 111.32, 2) + power((p_lng - lng) * 111.32 * cos(radians((p_lat + lat) / 2)), 2)) <= radius
      order by power((p_lat - lat) * 111.32, 2) + power((p_lng - lng) * 111.32 * cos(radians((p_lat + lat) / 2)), 2) limit 1),
    (select id from prov
      order by power((p_lat - lat) * 111.32, 2) + power((p_lng - lng) * 111.32 * cos(radians((p_lat + lat) / 2)), 2) limit 1)
  );
$$;

create or replace function public.search_maps(
  p_q text default null,
  p_purpose text default null,
  p_category text default null,
  p_region text default null,
  p_min_pins int default 0,
  p_has_meetup boolean default false,
  p_sort text default 'popular',
  p_limit int default 60,
  p_q_categories text[] default null
)
returns table (map_id uuid, users bigint, pin_count bigint, open_meetups bigint)
language sql stable security definer set search_path = ''
as $$
  with q as (
    -- % _ 는 글자 그대로 찾게
    select nullif('%' || replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%', '%%') as pat
  ),
  hits as (
    select m.id, m.updated_at,
           coalesce(r.users, 0) as users,
           -- 관련도: 제목 4 · 카테고리 3 · 안의 장소 이름 1
           case when q.pat is null then 0 else
             (case when m.title ilike q.pat then 4 else 0 end)
             + (case when m.category_label ilike q.pat or m.category = any(coalesce(p_q_categories, '{}')) then 3 else 0 end)
             + (case when exists (select 1 from public.pins p join public.places pl on pl.id = p.place_id where p.map_id = m.id and pl.name ilike q.pat) then 1 else 0 end)
           end as score,
           (select count(*) from public.pins p where p.map_id = m.id) as pin_count,
           (select count(*) from public.meetups mt
             where mt.map_id = m.id and mt.status = 'open' and mt.visibility = 'public' and mt.meet_at > now()) as open_meetups
    from public.maps m
    cross join q
    left join public.map_users_in_month(to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')) r on r.map_id = m.id
    where m.is_public
      and (q.pat is null or m.title ilike q.pat or m.category_label ilike q.pat or m.category = any(coalesce(p_q_categories, '{}'))
           or exists (select 1 from public.pins p join public.places pl on pl.id = p.place_id where p.map_id = m.id and pl.name ilike q.pat))
      and (p_purpose is null or m.purpose = p_purpose)
      and (p_category is null or m.category = p_category)
      and (p_region is null or exists (
            select 1 from public.pins p join public.places pl on pl.id = p.place_id
            where p.map_id = m.id and public.region_of(pl.lat, pl.lng) = p_region))
  )
  select id, users, pin_count, open_meetups from hits
  where pin_count >= greatest(coalesce(p_min_pins, 0), 0)
    and (not coalesce(p_has_meetup, false) or open_meetups > 0)
  -- relevance: 관련도 → 인기. recent: 최근 고친 순. pins: 장소 많은 순. 그 밖(popular): 이번 달 사용한 사람 수
  order by case when p_sort = 'relevance' then score else 0 end desc,
           case p_sort when 'recent' then 0 when 'pins' then pin_count else users end desc, updated_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
revoke all on function public.search_maps(text, text, text, text, int, boolean, text, int, text[]) from public;
grant execute on function public.search_maps(text, text, text, text, int, boolean, text, int, text[]) to anon, authenticated;

-- 사람: 닉네임으로. 공개 지도가 많은 사람 먼저. p_has_maps 면 공개 지도가 있는 사람만
create or replace function public.search_people(p_q text, p_has_maps boolean default false, p_limit int default 30)
returns table (user_id uuid, public_maps bigint)
language sql stable security definer set search_path = ''
as $$
  select pr.id, (select count(*) from public.maps m where m.owner_id = pr.id and m.is_public) as public_maps
  from public.profiles pr
  where btrim(coalesce(p_q, '')) <> ''
    and pr.nickname ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and (not coalesce(p_has_maps, false) or exists (select 1 from public.maps m where m.owner_id = pr.id and m.is_public))
  order by public_maps desc, pr.nickname
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;
revoke all on function public.search_people(text, boolean, int) from public;
grant execute on function public.search_people(text, boolean, int) to anon, authenticated;
