-- 장소 리뷰 악성 방지
--   1. 신고: reports.target 에 'review' 추가. 서로 다른 3명이 신고하면 리뷰를 자동으로 숨긴다 (별점 평균에서도 빠짐).
--      관리자가 신고를 '기각'하면 다시 보이고, '콘텐츠 내리기'면 지운다.
--   2. 가입하고 24시간이 지나야 리뷰를 쓸 수 있다 (관리자 제외).
--   3. 한 사람이 24시간 동안 새 리뷰는 10개까지.
--   4. 금지어가 들어간 후기는 저장하지 않는다 (띄어쓰기 · 기호를 빼고 비교). 목록은 frontend/src/lib/bannedWords.ts 와 같게 유지.

-- ---------------------------------------------------------------------------
-- 1. 신고 대상에 리뷰 추가 + 숨김 표시
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_target_check;
alter table public.reports add constraint reports_target_check check (target in ('user', 'meetup', 'map', 'comment', 'bug', 'review'));

alter table public.place_reviews add column if not exists hidden boolean not null default false;

-- 숨긴 리뷰는 쓴 사람과 관리자만 본다
drop policy if exists "place_reviews: 누구나 읽기" on public.place_reviews;
create policy "place_reviews: 누구나 읽기" on public.place_reviews
  for select to anon, authenticated
  using (not hidden or user_id = (select auth.uid()) or (select public.is_admin()));

-- 신고가 3명 이상 모이면 숨기기
create or replace function public.reports_autohide_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.target = 'review' and new.target_id is not null then
    if (select count(distinct reporter_id) from public.reports
        where target = 'review' and target_id = new.target_id and status = 'open' and reporter_id is not null) >= 3 then
      update public.place_reviews set hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists reports_autohide_review on public.reports;
create trigger reports_autohide_review
  after insert on public.reports
  for each row execute function public.reports_autohide_review();

-- ---------------------------------------------------------------------------
-- 2~4. 쓰기 제한 (가입 하루 · 하루 10개 · 금지어) + 숨김 표시는 관리자만 바꾼다
-- ---------------------------------------------------------------------------
create or replace function public.has_banned_word(p_text text)
returns boolean language sql immutable set search_path = ''
as $$
  select exists (
    select 1
    from unnest(array[
      '시발', '씨발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', '개새끼', '개새', '미친놈', '미친년',
      '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '엿먹', '썅', '염병', '등신', '창녀', '니애미', '느금마', '애미뒤', '애비뒤',
      'fuck', 'shit', 'bitch'
    ]) as w
    -- 한글 · 자모 · 영문 · 숫자만 남기고 비교 (띄어쓰기 · 기호로 피하는 것 막기)
    where position(w in regexp_replace(lower(coalesce(p_text, '')), '[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]', '', 'g')) > 0
  );
$$;

create or replace function public.place_reviews_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
begin
  -- 숨김은 신고 · 관리자만 바꾼다 (쓴 사람이 풀 수 없게)
  if tg_op = 'INSERT' then
    new.hidden := false;
  elsif not v_admin then
    new.hidden := old.hidden;
  end if;

  if public.has_banned_word(new.body) then
    raise exception '후기에 쓸 수 없는 말이 들어 있어요. 바르고 고운 말로 써 주세요.';
  end if;

  -- 새 리뷰일 때만. upsert 로 고칠 때도 INSERT 트리거가 먼저 불리므로 이미 쓴 리뷰가 있으면 건너뛴다
  if tg_op = 'INSERT' and not v_admin
     and not exists (select 1 from public.place_reviews where place_id = new.place_id and user_id = new.user_id) then
    if (select created_at from public.profiles where id = new.user_id) > now() - interval '24 hours' then
      raise exception '가입하고 하루가 지나면 리뷰를 남길 수 있어요.';
    end if;
    if (select count(*) from public.place_reviews where user_id = new.user_id and created_at > now() - interval '24 hours') >= 10 then
      raise exception '리뷰는 하루에 10개까지 남길 수 있어요. 내일 다시 남겨 주세요.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists place_reviews_guard on public.place_reviews;
create trigger place_reviews_guard
  before insert or update on public.place_reviews
  for each row execute function public.place_reviews_guard();

-- ---------------------------------------------------------------------------
-- 장소 통계: 숨긴 리뷰는 리뷰 수 · 평균 별점에서 뺀다
-- ---------------------------------------------------------------------------
create or replace function public.place_stats(p_external_ids text[])
returns table (external_id text, place_id uuid, map_count bigint, review_count bigint, avg_rating numeric)
language sql stable security definer set search_path = ''
as $$
  select pl.external_id, pl.id,
    (select count(distinct p.map_id) from public.pins p where p.place_id = pl.id),
    (select count(*) from public.place_reviews r where r.place_id = pl.id and not r.hidden),
    (select round(avg(r.rating), 1) from public.place_reviews r where r.place_id = pl.id and not r.hidden)
  from public.places pl
  where pl.external_id = any (p_external_ids[1:100]);
$$;

-- ---------------------------------------------------------------------------
-- 신고 처리: 리뷰는 '콘텐츠 내리기'면 삭제, '기각'이면 다시 보이게
-- ---------------------------------------------------------------------------
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
    elsif r.target = 'review' then delete from public.place_reviews where id = r.target_id;
    end if;
  elsif r.target = 'review' and p_status = 'dismissed' and r.target_id is not null then
    update public.place_reviews set hidden = false where id = r.target_id;
  end if;
  update public.reports set
    status = p_status,
    admin_note = left(coalesce(p_note, ''), 500),
    resolved_at = case when p_status = 'open' then null else now() end
  where id = p_report_id;
end;
$$;
