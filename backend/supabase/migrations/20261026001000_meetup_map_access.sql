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
