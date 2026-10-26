-- 지도 꾸미기: 마커 모양 · 코스 선 모양/굵기 · 커버 이미지.
--   line_style 'auto' 는 이동수단별 선 (도보 점선 · 대중교통 대시 · 자동차 실선).
--   커버 이미지는 pin-photos 버킷의 본인 폴더에 올리고 공개 URL 을 저장한다.

alter table public.maps add column if not exists marker_shape text not null default 'pin';
alter table public.maps add column if not exists line_style   text not null default 'auto';
alter table public.maps add column if not exists line_width   text not null default 'normal';
alter table public.maps add column if not exists cover_url    text;

alter table public.maps drop constraint if exists maps_marker_shape_check;
alter table public.maps add constraint maps_marker_shape_check check (marker_shape in ('pin', 'circle', 'square', 'emoji'));
alter table public.maps drop constraint if exists maps_line_style_check;
alter table public.maps add constraint maps_line_style_check check (line_style in ('auto', 'solid', 'dash', 'dot'));
alter table public.maps drop constraint if exists maps_line_width_check;
alter table public.maps add constraint maps_line_width_check check (line_width in ('thin', 'normal', 'bold'));
