-- 카카오 · 네이버 · 구글로 시작하기: 가입할 때 받아 온 별명 · 프로필 사진을 profiles 에 채운다.
--   이메일 가입: options.data.nickname (예전과 같음)
--   구글 · 카카오: Supabase 가 raw_user_meta_data 에 name · full_name · avatar_url · picture 를 넣어 준다
--   네이버: 우리 서버(app/api/auth/naver/callback)가 nickname · avatar_url 을 넣어 준다
--   사진 주소가 http 로 오면(카카오) https 로 바꾼다. 닉네임이 없으면 예전처럼 이메일 앞부분 → '사용자'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nickname text;
  v_avatar   text;
begin
  v_nickname := left(trim(coalesce(
    nullif(trim(v_meta ->> 'nickname'), ''),
    nullif(trim(v_meta ->> 'name'), ''),
    nullif(trim(v_meta ->> 'full_name'), ''),
    nullif(trim(v_meta ->> 'user_name'), ''),
    ''
  )), 30);
  if v_nickname = '' then
    v_nickname := left(coalesce(split_part(new.email, '@', 1), ''), 30);
  end if;
  if v_nickname = '' then
    v_nickname := '사용자';
  end if;

  v_avatar := nullif(trim(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', '')), '');
  if v_avatar is not null then
    v_avatar := regexp_replace(v_avatar, '^http://', 'https://');
    if v_avatar !~ '^https://' then
      v_avatar := null;
    end if;
  end if;

  insert into public.profiles (id, nickname, avatar_url)
  values (new.id, v_nickname, v_avatar)
  on conflict (id) do nothing;

  return new;
end;
$$;
