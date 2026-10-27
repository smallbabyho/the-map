-- 성지순례 도착 인증: '도착 체크' 는 그 장소 가까이(300m) 있을 때만.
--   화면이 위치를 보낸다 → GPS(지금 위치) 또는 사진(촬영 위치, EXIF). 거리는 여기서 잰다.
--   예전 방식(바로 insert)은 막고 public.checkin_meetup_pin 으로만 체크한다. 체크 풀기(delete)는 그대로.
--   verified_by 가 null 인 줄은 인증 기능 전에 체크한 것.

alter table public.meetup_checkins add column if not exists verified_by text check (verified_by in ('gps', 'photo'));
alter table public.meetup_checkins add column if not exists distance_m integer;

drop policy if exists "meetup_checkins: 내 도착 체크" on public.meetup_checkins;
revoke insert on public.meetup_checkins from authenticated;

create or replace function public.checkin_meetup_pin(p_meetup_id uuid, p_pin_id uuid, p_lat double precision, p_lng double precision, p_method text)
returns integer -- 장소까지 거리(m)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lat double precision;
  v_lng double precision;
  v_dist integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_method not in ('gps', 'photo') then
    raise exception '인증 방법이 올바르지 않아요.';
  end if;
  if not public.is_meetup_member(p_meetup_id) then
    raise exception '모임에 참여한 사람만 체크할 수 있어요.';
  end if;

  -- 이 모임 코스의 핀인지 + 장소 좌표
  select pl.lat, pl.lng into v_lat, v_lng
  from public.meetups mt
  join public.pins p on p.map_id = mt.map_id and p.id = p_pin_id
  join public.places pl on pl.id = p.place_id
  where mt.id = p_meetup_id;
  if v_lat is null then
    raise exception '이 모임 코스의 장소가 아니에요.';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup_id and status = 'canceled') then
    raise exception '취소된 모임이에요.';
  end if;

  v_dist := round(sqrt(power((p_lat - v_lat) * 111320, 2) + power((p_lng - v_lng) * 111320 * cos(radians((p_lat + v_lat) / 2)), 2)));
  if v_dist > 300 then
    raise exception '장소에서 %m 떨어져 있어요. 300m 안에서 인증해 주세요.', v_dist;
  end if;

  insert into public.meetup_checkins (meetup_id, user_id, pin_id, verified_by, distance_m)
  values (p_meetup_id, v_uid, p_pin_id, p_method, v_dist)
  on conflict (meetup_id, user_id, pin_id) do update set verified_by = excluded.verified_by, distance_m = excluded.distance_m;

  return v_dist;
end;
$$;

revoke all on function public.checkin_meetup_pin(uuid, uuid, double precision, double precision, text) from public;
grant execute on function public.checkin_meetup_pin(uuid, uuid, double precision, double precision, text) to authenticated;
