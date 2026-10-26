-- 프로필 배너 사진 (트위터처럼 프로필 맨 위). pin-photos 버킷 본인 폴더에 올리고 공개 URL 을 저장한다.
alter table public.profile_decos add column if not exists banner_url text;
