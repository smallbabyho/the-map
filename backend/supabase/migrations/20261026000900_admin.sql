-- 관리자 기능 (관리자 화면 /customers). 모두 is_admin() 을 확인하는 security definer 함수라서
-- 서버 비밀 키(service_role) 없이 브라우저에서 바로 부를 수 있다. 관리자가 아니면 에러.
--   정지: profiles.suspended + auth.users.banned_until 을 먼 미래로 → 로그인 · 토큰 갱신이 막힌다.
--   탈퇴: auth.users 에서 지우면 profiles 부터 지도 · 모임까지 on delete cascade 로 같이 지워진다.

alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.require_admin() from public;

-- 회원 목록 + 활동 수 (가입 최신순)
create or replace function public.admin_list_users()
returns table (id uuid, email text, nickname text, avatar_url text, role text, suspended boolean, created_at timestamptz, map_count bigint, meetup_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select p.id, u.email::text, p.nickname, p.avatar_url, p.role, p.suspended, u.created_at,
           (select count(*) from public.maps m where m.owner_id = p.id),
           (select count(*) from public.meetups mt where mt.host_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;

-- 현황 숫자
create or replace function public.admin_stats()
returns table (reports_open bigint, users bigint, suspended bigint, maps bigint, public_maps bigint, meetups_open bigint, uses_this_month bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  return query select
    (select count(*) from public.reports where status = 'open'),
    (select count(*) from public.profiles),
    (select count(*) from public.profiles p where p.suspended),
    (select count(*) from public.maps),
    (select count(*) from public.maps where is_public),
    (select count(*) from public.meetups where status = 'open' and meet_at >= now()),
    (select count(*) from public.map_uses where to_char(used_at at time zone 'Asia/Seoul', 'YYYY-MM') = to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'));
end;
$$;

-- 닉네임 · 권한 · 정지 바꾸기 (null 이면 그대로). 내 계정의 권한 · 정지는 못 바꾼다.
create or replace function public.admin_update_user(p_user_id uuid, p_nickname text default null, p_role text default null, p_suspended boolean default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_user_id = (select auth.uid()) and (p_role = 'user' or p_suspended) then
    raise exception '내 계정의 관리자 권한이나 상태는 바꿀 수 없어요.';
  end if;
  if p_nickname is not null and char_length(trim(p_nickname)) = 0 then raise exception '닉네임을 입력해 주세요.'; end if;
  update public.profiles set
    nickname  = coalesce(left(trim(p_nickname), 30), nickname),
    role      = coalesce(p_role, role),
    suspended = coalesce(p_suspended, suspended)
  where id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없어요.'; end if;
  if p_suspended is not null then
    update auth.users set banned_until = case when p_suspended then 'infinity'::timestamptz else null end where id = p_user_id;
  end if;
end;
$$;

-- 탈퇴 처리 (되돌릴 수 없음)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_user_id = (select auth.uid()) then raise exception '내 계정은 여기서 삭제할 수 없어요.'; end if;
  delete from auth.users where id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없어요.'; end if;
end;
$$;

-- 신고 처리 + 콘텐츠 내리기 (댓글 삭제 · 모임 취소 · 지도 비공개)
create or replace function public.admin_resolve_report(p_report_id uuid, p_status text, p_note text default '', p_remove_content boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r public.reports;
begin
  perform public.require_admin();
  select * into r from public.reports where id = p_report_id;
  if r.id is null then raise exception '신고를 찾을 수 없어요.'; end if;
  if p_remove_content and r.target_id is not null then
    if r.target = 'comment' then delete from public.meetup_comments where id = r.target_id;
    elsif r.target = 'meetup' then update public.meetups set status = 'canceled' where id = r.target_id;
    elsif r.target = 'map' then update public.maps set is_public = false where id = r.target_id;
    end if;
  end if;
  update public.reports set
    status = p_status,
    admin_note = left(coalesce(p_note, ''), 500),
    resolved_at = case when p_status = 'open' then null else now() end
  where id = p_report_id;
end;
$$;

revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_stats() from public;
revoke all on function public.admin_update_user(uuid, text, text, boolean) from public;
revoke all on function public.admin_delete_user(uuid) from public;
revoke all on function public.admin_resolve_report(uuid, text, text, boolean) from public;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text, boolean) to authenticated;

-- 일반 사용자가 profiles 를 고칠 때 role · suspended 는 못 바꾸게 (관리자 함수는 security definer 라 통과)
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.suspended is distinct from old.suspended) and current_user = 'authenticated' then
    raise exception '권한 · 정지 상태는 관리자만 바꿀 수 있어요.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();
