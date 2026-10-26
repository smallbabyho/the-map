-- 프로필 사진: profiles.avatar_url + 공개 버킷 avatars.
--   파일 경로 규칙: {user_id}/{파일명}  →  본인 폴더에만 업로드·수정·삭제 가능
--   프로필 사진은 원래 누구나 보는 것이라 읽기는 공개 (public 버킷이라 URL 로 바로 보인다).
--   용량 2MB, 이미지 형식만 허용 (프론트가 400px 로 줄여서 올린다).

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: 본인 폴더 업로드" on storage.objects;
create policy "avatars: 본인 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: 본인 폴더 수정" on storage.objects;
create policy "avatars: 본인 폴더 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: 본인 폴더 삭제" on storage.objects;
create policy "avatars: 본인 폴더 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
