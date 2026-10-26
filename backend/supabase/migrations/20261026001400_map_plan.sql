-- 지도 일정: 이 코스를 언제 갈지 (날짜만). 비워 두면 일정 없음.
--   화면에서는 주인 · 같이 꾸미는 사람에게만 보여 준다 (공개 지도 화면에는 안 나옴).

alter table public.maps add column if not exists planned_date date;
