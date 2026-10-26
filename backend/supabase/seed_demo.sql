-- ============================================================================
-- 체험용 예시 데이터 (둘러보기 · 순위 · 성지순례 화면이 비어 보이지 않게)
--   - 작성자 계정 3개(빵순이 · 드라마덕후 · 카페투어러) + 순위용 손님 계정 20개. 비밀번호가 없어 로그인은 안 된다.
--   - 공개 지도 7개(카테고리 골고루) · 핀 · 경로 · 공개 모임 4개 · 이번 달/지난 달 사용 기록.
--   - id 를 고정해 두어서 여러 번 실행해도 한 번만 들어간다.
--   - 지우기: 맨 아래 '예시 데이터 지우기' 주석을 풀고 실행.
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run (setup_all.sql 을 먼저 실행해 둔 상태에서)
-- ============================================================================

-- ---- 계정 (가입 트리거가 profiles 를 만든다) ----
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email, '', now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('nickname', v.nickname),
       now() - (v.days || ' days')::interval, now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001', 'demo-bread@example.com', '빵순이', 41),
  ('d0000000-0000-4000-8000-000000000002', 'demo-drama@example.com', '드라마덕후', 25),
  ('d0000000-0000-4000-8000-000000000003', 'demo-cafe@example.com', '카페투어러', 12)
) as v(id, email, nickname, days)
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select ('d1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'demo-guest' || i || '@example.com', '', now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('nickname', '순례자' || i),
       now() - interval '60 days', now(), '', '', '', ''
from generate_series(1, 20) as i
on conflict (id) do nothing;

-- ---- 장소 ----
insert into public.places (id, external_id, name, lat, lng) values
  ('e0000000-0000-4000-8000-000000000001', 'sample-16', '성수 베이커리 카페', 37.542, 127.056),
  ('e0000000-0000-4000-8000-000000000002', 'sample-1', '성수 카페거리', 37.5446, 127.0559),
  ('e0000000-0000-4000-8000-000000000003', 'sample-2', '서울숲', 37.5444, 127.0374),
  ('e0000000-0000-4000-8000-000000000004', 'sample-6', '경복궁', 37.5796, 126.977),
  ('e0000000-0000-4000-8000-000000000005', 'sample-7', '북촌 한옥마을', 37.5826, 126.9831),
  ('e0000000-0000-4000-8000-000000000006', 'sample-5', '익선동 한옥거리', 37.5741, 126.9895),
  ('e0000000-0000-4000-8000-000000000007', 'sample-12', '한남동 카페 골목', 37.5378, 127.001),
  ('e0000000-0000-4000-8000-000000000008', 'sample-9', '이태원 베이커리 골목', 37.5345, 126.9946),
  ('e0000000-0000-4000-8000-000000000009', 'sample-4', '망원시장', 37.556, 126.906),
  ('e0000000-0000-4000-8000-000000000010', 'sample-3', '연남동 경의선숲길', 37.56, 126.923),
  ('e0000000-0000-4000-8000-000000000011', 'sample-21', '창경궁', 37.5788, 126.9949),
  ('e0000000-0000-4000-8000-000000000012', 'sample-22', '낙산공원 성곽길', 37.5806, 127.0076),
  ('e0000000-0000-4000-8000-000000000013', 'sample-23', '강릉역', 37.7637, 128.8996),
  ('e0000000-0000-4000-8000-000000000014', 'sample-24', '안목해변 커피거리', 37.7722, 128.9472),
  ('e0000000-0000-4000-8000-000000000015', 'sample-25', '경포대', 37.7955, 128.9086),
  ('e0000000-0000-4000-8000-000000000016', 'sample-26', '주문진 수산시장', 37.8933, 128.8306),
  ('e0000000-0000-4000-8000-000000000017', 'sample-27', '국립현대미술관 서울', 37.5788, 126.98),
  ('e0000000-0000-4000-8000-000000000018', 'sample-28', '리움미술관', 37.5384, 126.999)
on conflict (external_id) do nothing;

-- ---- 공개 지도 ----
insert into public.maps (id, owner_id, title, theme, is_public, category, created_at, updated_at) values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '성수 빵지순례 🥐', 'pastel', true, 'food', now() - interval '30 days', now() - interval '2 days'),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', '도깨비 촬영지 투어', 'vintage', true, 'fandom', now() - interval '30 days', now() - interval '3 days'),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', '한남·이태원 카페 산책', 'default', true, 'cafe', now() - interval '20 days', now() - interval '1 days'),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', '망원·연남 먹방 코스', 'neon', true, 'food', now() - interval '15 days', now() - interval '4 days'),
  ('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', '종로 한옥 데이트 💕', '#ec4899', true, 'date', now() - interval '10 days', now() - interval '1 days'),
  ('f0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002', '강릉 1박 2일 바다 여행 🌊', 'forest', true, 'trip', now() - interval '8 days', now() - interval '5 days'),
  ('f0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000003', '주말 미술관 투어 🎨', 'default', true, 'culture', now() - interval '6 days', now() - interval '6 days')
on conflict (id) do nothing;

-- ---- 핀 (지도 번호 · 순서 · 장소 · 이모지 · 색 · 메모) ----
insert into public.pins (id, map_id, place_id, sort_order, icon, color, memo)
select ('a' || lpad(v.n::text, 7, '0') || '-0000-4000-8000-000000000000')::uuid,
       ('f0000000-0000-4000-8000-00000000000' || v.m)::uuid,
       (select id from public.places where external_id = v.ext), v.ord, v.icon, v.color, v.memo
from (values
  (1, 1, 0, 'sample-16', '🍞', '#f9a8d4', '소금빵 필수'),
  (2, 1, 1, 'sample-1', '☕', '#a5b4fc', ''),
  (3, 1, 2, 'sample-2', '🌳', '#86efac', '빵 들고 피크닉'),
  (4, 2, 0, 'sample-6', '🏛️', '#b45309', ''),
  (5, 2, 1, 'sample-7', '🎬', '#7c2d12', '2화 그 골목'),
  (6, 2, 2, 'sample-5', '📸', '#4d7c0f', ''),
  (7, 3, 0, 'sample-12', '☕', '#f97316', ''),
  (8, 3, 1, 'sample-9', '🍰', '#ef4444', ''),
  (9, 4, 0, 'sample-4', '🍜', '#facc15', ''),
  (10, 4, 1, 'sample-3', '🍺', '#22d3ee', ''),
  (11, 5, 0, 'sample-6', '🍡', '#ec4899', '한복 대여하고 시작'),
  (12, 5, 1, 'sample-21', '🌸', '#f472b6', ''),
  (13, 5, 2, 'sample-22', '🌙', '#a855f7', '노을 · 야경 명소'),
  (14, 6, 0, 'sample-23', '🚄', '#16a34a', 'KTX 2시간'),
  (15, 6, 1, 'sample-24', '☕', '#65a30d', '바다 보며 커피'),
  (16, 6, 2, 'sample-25', '🌊', '#0d9488', '일몰'),
  (17, 6, 3, 'sample-26', '🦀', '#ca8a04', '둘째 날 아침 대게'),
  (18, 7, 0, 'sample-27', '🖼️', '#f97316', ''),
  (19, 7, 1, 'sample-28', '🎨', '#3b82f6', '')
) as v(n, m, ord, ext, icon, color, memo)
on conflict (id) do nothing;

-- ---- 경로 (이웃한 핀끼리) ----
insert into public.legs (map_id, from_pin_id, to_pin_id, mode, duration_min, is_manual)
select a.map_id, a.id, b.id, v.mode, v.minutes, false
from (values
  (1, 2, 'walk', 10), (2, 3, 'walk', 15),
  (4, 5, 'walk', 15), (5, 6, 'transit', 12),
  (7, 8, 'walk', 10),
  (9, 10, 'walk', 18),
  (11, 12, 'walk', 14), (12, 13, 'walk', 20),
  (14, 15, 'transit', 25), (15, 16, 'car', 15), (16, 17, 'car', 30),
  (18, 19, 'transit', 35)
) as v(f, t, mode, minutes)
join public.pins a on a.id = ('a' || lpad(v.f::text, 7, '0') || '-0000-4000-8000-000000000000')::uuid
join public.pins b on b.id = ('a' || lpad(v.t::text, 7, '0') || '-0000-4000-8000-000000000000')::uuid
on conflict (map_id, from_pin_id, to_pin_id) do nothing;

-- ---- 공개 모임 (주최자는 트리거가 참여자로 넣고 사용 기록도 남긴다) ----
insert into public.meetups (id, map_id, host_id, title, description, meet_at, meet_point, capacity, status, visibility)
select v.id::uuid, v.map_id::uuid, v.host::uuid, v.title, v.descr, date_trunc('hour', now()) + (v.days || ' days')::interval, v.point, v.cap, v.status, 'public'
from (values
  ('b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '성수 빵지순례 같이 돌아요 🥐',
   '오픈런부터 서울숲 피크닉까지! 빵 좋아하시는 분 누구나 환영해요. 각자 먹고 싶은 빵 하나씩 사서 나눠 먹어요 🥐', 3, '성수역 3번 출구', 6, 'open'),
  ('b0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', '도깨비 촬영지 정주행 투어',
   '경복궁에서 시작해서 북촌, 익선동까지 걸어요. 드라마 장면 사진 들고 오시면 똑같이 찍어 드려요 📸', 8, '경복궁역 5번 출구', 4, 'open'),
  ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', '한남동 카페 3곳 도장깨기',
   '커피 3잔 각오하고 오세요. 디카페인도 있어요!', 1, '한강진역 1번 출구', 3, 'closed'),
  ('b0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', '망원시장 먹방 번개',
   '시장 한 바퀴 돌고 연남동에서 마무리', 12, '망원역 2번 출구', 8, 'open')
) as v(id, map_id, host, title, descr, days, point, cap, status)
on conflict (id) do nothing;

-- 참여자 (주최자 말고)
insert into public.meetup_members (meetup_id, user_id)
select v.mt::uuid, v.u::uuid from (values
  ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002')
) as v(mt, u)
on conflict do nothing;

-- ---- 지도 사용 기록 (순위 · 둘러보기 인기순). 손님 계정 i번이 이번 달 / 지난 달에 사용 ----
-- 이미 넣었으면 건너뛴다 (예시 손님 기록이 하나라도 있으면)
insert into public.map_uses (map_id, user_id, kind, used_at)
select ('f0000000-0000-4000-8000-00000000000' || v.m)::uuid,
       ('d1000000-0000-4000-8000-0000000000' || lpad(g.i::text, 2, '0'))::uuid,
       case when g.i % 3 = 0 then 'meetup' else 'copy' end,
       case when v.last_month then date_trunc('month', now()) - interval '10 days' + (g.i || ' hours')::interval
            else now() - (g.i || ' minutes')::interval end
from (values (1, 14, false), (2, 9, false), (3, 9, false), (4, 4, false), (5, 7, false), (6, 5, false), (7, 3, false),
             (2, 17, true), (1, 11, true), (3, 6, true)) as v(m, n, last_month)
join lateral generate_series(1, v.n) as g(i) on true
where not exists (select 1 from public.map_uses where user_id = 'd1000000-0000-4000-8000-000000000001');

-- ============================================================================
-- 예시 데이터 지우기 (필요할 때 아래 주석을 풀고 실행 — 지도 · 모임 · 기록이 함께 지워진다)
-- delete from auth.users where email like 'demo-%@example.com';
-- delete from public.places where external_id like 'sample-%' and id not in (select place_id from public.pins);
-- ============================================================================
