-- 지도 용도: 기록(record, 다녀온 곳) / 계획(plan, 갈 곳).
--   기록은 공유돼서 다른 사람의 계획이 된다 (가져오기 → 내 계획). 계획은 다녀온 뒤 [다녀왔어요]로 기록이 된다.
--   기존 지도는 칸을 처음 만들 때 한 번만 나눈다: 공개 = 기록, 비공개 = 계획. 여러 번 실행해도 다시 나누지 않는다.

-- 가는 날 (20261026001400_map_plan.sql 과 같음. 그 파일을 건너뛰었어도 되게)
alter table public.maps add column if not exists planned_date date;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'maps' and column_name = 'purpose') then
    alter table public.maps add column purpose text not null default 'record';
    update public.maps set purpose = 'plan' where not is_public;
  end if;
end $$;

alter table public.maps drop constraint if exists maps_purpose_check;
alter table public.maps add constraint maps_purpose_check check (purpose in ('record', 'plan'));

-- 가져오기: 내 계획으로
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

  -- 가져온 지도는 내 '계획' (비공개, 가는 날은 비움)
  insert into public.maps (owner_id, title, theme, is_public, category, marker_shape, line_style, line_width, cover_url, purpose)
  values (v_me, case when src.owner_id = v_me then left(src.title || ' (복사본)', 60) else src.title end,
          src.theme, false, src.category, src.marker_shape, src.line_style, src.line_width, src.cover_url, 'plan')
  returning id into v_new;

  -- 핀: 옛 id → 새 id 를 짝지어 두고 구간을 옮긴다
  create temporary table _pin_map (old_id uuid, new_id uuid) on commit drop;
  insert into _pin_map (old_id, new_id) select id, gen_random_uuid() from public.pins where map_id = src.id;
  insert into public.pins (id, map_id, place_id, sort_order, icon, color, memo, photo_url, visited_at)
  select pm.new_id, v_new, p.place_id, p.sort_order, p.icon, p.color, p.memo, p.photo_url, null -- 남이 다녀온 날은 안 가져온다
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
