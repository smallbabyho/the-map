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
