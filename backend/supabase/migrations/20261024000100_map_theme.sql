-- 지도 색 테마: 프리셋(default · pastel · vintage · neon · forest) 또는 직접 고른 색 '#rrggbb'.
-- 배경(라이트/다크)은 이제 보는 사람이 정하므로 예전 'dark' 테마는 색만 남겨 'neon' 으로.

alter table public.maps drop constraint if exists maps_theme_check;

update public.maps set theme = 'neon' where theme = 'dark';
update public.maps set theme = 'default'
  where theme !~ '^(default|pastel|vintage|neon|forest|#[0-9a-fA-F]{6})$';

alter table public.maps
  add constraint maps_theme_check check (theme ~ '^(default|pastel|vintage|neon|forest|#[0-9a-fA-F]{6})$');
