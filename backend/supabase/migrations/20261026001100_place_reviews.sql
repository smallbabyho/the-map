-- 장소 리뷰 · 장소 통계 (인기 장소)
--   place_reviews : 장소마다 한 사람당 리뷰 1개 (별점 1~5 + 한 줄 후기). 그 장소를 자기 지도(주인 · 공동 편집자)에 담은 사람만 쓸 수 있다.
--   place_stats() : 장소별 '담긴 지도 수'(비공개 지도 포함) · 리뷰 수 · 평균 별점. 어느 지도인지는 알려주지 않고 숫자만 준다.

create table if not exists public.place_reviews (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text not null default '' check (char_length(body) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_reviews_one_per_user unique (place_id, user_id)
);
create index if not exists place_reviews_place_idx on public.place_reviews (place_id, created_at desc);

drop trigger if exists place_reviews_set_updated_at on public.place_reviews;
create trigger place_reviews_set_updated_at
  before update on public.place_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 헬퍼: 내가 고칠 수 있는 지도(주인 · 공동 편집자)에 이 장소가 핀으로 있나
-- ---------------------------------------------------------------------------
create or replace function public.has_pinned_place(p_place_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pins p
    join public.maps m on m.id = p.map_id
    where p.place_id = p_place_id
      and (m.owner_id = (select auth.uid()) or public.is_map_editor(m.id))
  );
$$;
revoke all on function public.has_pinned_place(uuid) from public;
grant execute on function public.has_pinned_place(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 권한: 읽기는 누구나, 쓰기는 담은 사람 본인만, 지우기는 본인 또는 관리자
-- ---------------------------------------------------------------------------
alter table public.place_reviews enable row level security;

drop policy if exists "place_reviews: 누구나 읽기" on public.place_reviews;
create policy "place_reviews: 누구나 읽기" on public.place_reviews
  for select to anon, authenticated using (true);

drop policy if exists "place_reviews: 담은 사람만 작성" on public.place_reviews;
create policy "place_reviews: 담은 사람만 작성" on public.place_reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_pinned_place(place_id));

drop policy if exists "place_reviews: 본인만 수정" on public.place_reviews;
create policy "place_reviews: 본인만 수정" on public.place_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_pinned_place(place_id));

drop policy if exists "place_reviews: 본인 또는 관리자 삭제" on public.place_reviews;
create policy "place_reviews: 본인 또는 관리자 삭제" on public.place_reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- 장소 통계: 카카오 장소 ID 목록 → 담긴 지도 수 · 리뷰 수 · 평균 별점
--   비공개 지도도 세야 해서 security definer. 아직 아무도 담지 않은 장소는 결과에 없다.
--
--   select * from place_stats(array['8134820', '27531028']);
-- ---------------------------------------------------------------------------
create or replace function public.place_stats(p_external_ids text[])
returns table (external_id text, place_id uuid, map_count bigint, review_count bigint, avg_rating numeric)
language sql stable security definer set search_path = ''
as $$
  select pl.external_id, pl.id,
    (select count(distinct p.map_id) from public.pins p where p.place_id = pl.id),
    (select count(*) from public.place_reviews r where r.place_id = pl.id),
    (select round(avg(r.rating), 1) from public.place_reviews r where r.place_id = pl.id)
  from public.places pl
  where pl.external_id = any (p_external_ids[1:100]);
$$;
revoke all on function public.place_stats(text[]) from public;
grant execute on function public.place_stats(text[]) to anon, authenticated;
