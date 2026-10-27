-- 🏅 배지: 프로필 주인이 세상을 누빈 기록을 숫자로 모은다. 배지 이름 · 단계는 프론트(src/components/badges.ts)가 정한다.
--   여행 기록장처럼 공개 지도만 센다 (비공개 기록이 남에게 드러나지 않게). 숫자만 돌려주고 어떤 지도인지는 안 알려 준다.
--   places · regions: 공개 '기록' 지도에 담은 서로 다른 장소 (같은 곳을 여러 지도에 담아도 1곳)
--   regions: 시 · 도별 장소 수 (public.region_of, 행정 경계가 아니라 근사)
--   categories: 공개 기록 지도의 카테고리별 지도 수
--   meetups: 체크인한 성지순례 수 · 연 모임 수(취소 제외) · copied: 남이 내 공개 지도를 가져간 횟수
create or replace function public.profile_badge_stats(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with rec as (
    select m.id, m.category from public.maps m
    where m.owner_id = p_user and m.is_public and m.purpose = 'record'
  ),
  spots as (
    select distinct pl.id, public.region_of(pl.lat, pl.lng) as region
    from rec join public.pins p on p.map_id = rec.id join public.places pl on pl.id = p.place_id
  )
  select jsonb_build_object(
    'record_maps', (select count(*) from rec),
    'places', (select count(*) from spots),
    'regions', coalesce((select jsonb_object_agg(region, n) from (select region, count(*) as n from spots group by region) r), '{}'::jsonb),
    'categories', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) as n from rec group by category) c), '{}'::jsonb),
    'reviews', (select count(*) from public.place_reviews r where r.user_id = p_user and not r.hidden),
    'meetups_joined', (select count(distinct c.meetup_id) from public.meetup_checkins c where c.user_id = p_user),
    'meetups_hosted', (select count(*) from public.meetups mt where mt.host_id = p_user and mt.status <> 'canceled'),
    'copied', (
      select count(*) from public.map_uses u join public.maps m on m.id = u.map_id
      where m.owner_id = p_user and m.is_public and u.kind = 'copy' and u.user_id <> p_user
    )
  );
$$;

revoke all on function public.profile_badge_stats(uuid) from public;
grant execute on function public.profile_badge_stats(uuid) to anon, authenticated;
