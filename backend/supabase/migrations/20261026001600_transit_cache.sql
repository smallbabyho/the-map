-- 대중교통 길찾기 결과를 모두가 같이 쓰는 저장소.
--   ODsay 무료 키는 하루 호출 수가 적어서(구간 하나 = 경로 검색 + 노선 모양 2번), 한 번 찾은 구간은 2주 동안 다시 부르지 않는다.
--   key: '출발 lat,lng>도착 lat,lng' (소수 5자리). result: 화면용으로 정리한 결과(JSON).
--   읽기는 누구나, 쓰기는 로그인한 사람만 (크기 · key 모양 제한).

create table if not exists public.transit_cache (
  key        text primary key check (key ~ '^-?[0-9]+\.[0-9]{5},-?[0-9]+\.[0-9]{5}>-?[0-9]+\.[0-9]{5},-?[0-9]+\.[0-9]{5}$'),
  result     jsonb not null check (octet_length(result::text) < 300000),
  created_at timestamptz not null default now()
);
alter table public.transit_cache enable row level security;

grant select on public.transit_cache to anon, authenticated;
grant insert, update on public.transit_cache to authenticated;

drop policy if exists "transit_cache: 2주 안의 것 읽기" on public.transit_cache;
create policy "transit_cache: 2주 안의 것 읽기" on public.transit_cache
  for select to anon, authenticated
  using (created_at > now() - interval '14 days');

drop policy if exists "transit_cache: 로그인 쓰기" on public.transit_cache;
create policy "transit_cache: 로그인 쓰기" on public.transit_cache
  for insert to authenticated with check (true);

drop policy if exists "transit_cache: 로그인 고쳐 쓰기" on public.transit_cache;
create policy "transit_cache: 로그인 고쳐 쓰기" on public.transit_cache
  for update to authenticated using (true) with check (true);
