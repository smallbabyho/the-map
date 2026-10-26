-- 이동수단을 4가지로: 도보(walk) · 대중교통(transit) · 자동차(car) · 자전거(bike)
-- 예전 버스(bus) · 지하철(subway) 은 대중교통으로 합친다.

alter table public.legs drop constraint if exists legs_mode_check;

update public.legs set mode = 'transit' where mode in ('bus', 'subway');

alter table public.legs
  add constraint legs_mode_check check (mode in ('walk', 'transit', 'car', 'bike'));
