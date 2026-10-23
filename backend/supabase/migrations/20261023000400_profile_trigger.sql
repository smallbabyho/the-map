-- 가입하면 profiles 를 자동으로 만든다.
--   닉네임은 signUp 때 options.data.nickname 으로 넘긴 값 (src/auth 에서 처리).
--   이메일 인증을 켜면 가입 직후엔 세션이 없어 클라이언트에서 insert 할 수 없기 때문에 트리거로 처리한다.
--   닉네임이 비어 있거나 30자를 넘어도 가입 자체가 실패하지 않도록 보정한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
begin
  v_nickname := left(trim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), 30);
  if v_nickname = '' then
    v_nickname := left(coalesce(split_part(new.email, '@', 1), ''), 30);
  end if;
  if v_nickname = '' then
    v_nickname := '사용자';
  end if;

  insert into public.profiles (id, nickname)
  values (new.id, v_nickname)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
