-- 프로필 꾸미기 (다이어리처럼): 속지 · 글꼴 · 소개글 · 스티커 · 대표 지도.
-- 한 사람에 한 줄. 꾸민 적 없으면 줄이 없고, 프론트가 기본값을 쓴다.
-- 공개 프로필이라 누구나 읽고, 쓰기는 본인만.

create table if not exists public.profile_decos (
  user_id        uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  paper          text not null default 'plain' check (paper in ('plain', 'lined', 'grid', 'dot', 'kraft', 'cream')),
  color          text not null default '#ffffff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  font           text not null default 'basic' check (font in ('basic', 'hand', 'round', 'serif', 'pen')),
  bio            text not null default '' check (char_length(bio) <= 150),
  mood           text not null default '' check (char_length(mood) <= 40),
  -- [{ id, emoji, x, y, size, rotate }] (x · y 는 %)
  stickers       jsonb not null default '[]' check (jsonb_typeof(stickers) = 'array' and jsonb_array_length(stickers) <= 30),
  -- 고른 순서대로. 비공개가 된 지도는 읽을 때 빠진다.
  pinned_map_ids uuid[] not null default '{}' check (cardinality(pinned_map_ids) <= 6),
  map_style      text not null default 'polaroid' check (map_style in ('polaroid', 'tape')),
  -- { intro, stickers, maps }: 꾸미기 요소별로 보일지 말지
  sections       jsonb not null default '{"intro": true, "stickers": true, "maps": true}' check (jsonb_typeof(sections) = 'object'),
  updated_at     timestamptz not null default now()
);

drop trigger if exists profile_decos_set_updated_at on public.profile_decos;
create trigger profile_decos_set_updated_at
  before update on public.profile_decos
  for each row execute function public.set_updated_at();

alter table public.profile_decos enable row level security;

grant select on public.profile_decos to anon, authenticated;
grant insert, update on public.profile_decos to authenticated;

drop policy if exists "profile_decos: 누구나 읽기" on public.profile_decos;
create policy "profile_decos: 누구나 읽기" on public.profile_decos
  for select to anon, authenticated
  using (true);

drop policy if exists "profile_decos: 본인만 만들기" on public.profile_decos;
create policy "profile_decos: 본인만 만들기" on public.profile_decos
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "profile_decos: 본인만 수정" on public.profile_decos;
create policy "profile_decos: 본인만 수정" on public.profile_decos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
