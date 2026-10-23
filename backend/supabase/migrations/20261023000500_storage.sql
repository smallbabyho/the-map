-- 핀 사진 버킷 pin-photos
--   파일 경로 규칙: {user_id}/{파일명}  →  본인 폴더에만 업로드·수정·삭제 가능
--   public 버킷이라 photo_url 에 영구 공개 URL 을 저장할 수 있다.
--   (주의: 비공개 지도의 사진도 URL 을 알면 볼 수 있다. 파일명은 추측 불가능한 uuid 로 만든다.)
--   용량 5MB, 이미지 형식만 허용.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pin-photos',
  'pin-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pin-photos: 본인 폴더 읽기" on storage.objects;
create policy "pin-photos: 본인 폴더 읽기" on storage.objects
  for select to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "pin-photos: 본인 폴더 업로드" on storage.objects;
create policy "pin-photos: 본인 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "pin-photos: 본인 폴더 수정" on storage.objects;
create policy "pin-photos: 본인 폴더 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "pin-photos: 본인 폴더 삭제" on storage.objects;
create policy "pin-photos: 본인 폴더 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
