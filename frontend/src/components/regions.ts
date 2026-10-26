// 검색 지역 필터: 시 · 도 17곳. 핀 좌표가 어느 시 · 도인지 대략 나눈다 (행정 경계가 아니라 근사).
//   1) 특별 · 광역시: 도시 중심에서 radiusKm 안이면 그 도시 (가까운 도시 먼저)
//   2) 나머지: 가장 가까운 도 중심
// ⚠️ DB 함수 public.region_of (backend/supabase/migrations/20261026001800_search.sql) 와 숫자 · 순서를 똑같이 맞춘다.

export interface Region {
  id: string
  label: string
  lat: number
  lng: number
  /** 특별 · 광역시만: 이 거리 안이면 그 도시 */
  radiusKm?: number
}

export const REGIONS: Region[] = [
  { id: 'seoul', label: '서울', lat: 37.5665, lng: 126.978, radiusKm: 16 },
  { id: 'busan', label: '부산', lat: 35.18, lng: 129.075, radiusKm: 16 },
  { id: 'daegu', label: '대구', lat: 35.871, lng: 128.601, radiusKm: 17 },
  { id: 'incheon', label: '인천', lat: 37.456, lng: 126.705, radiusKm: 15 },
  { id: 'gwangju', label: '광주', lat: 35.16, lng: 126.851, radiusKm: 13 },
  { id: 'daejeon', label: '대전', lat: 36.35, lng: 127.385, radiusKm: 14 },
  { id: 'ulsan', label: '울산', lat: 35.539, lng: 129.311, radiusKm: 20 },
  { id: 'sejong', label: '세종', lat: 36.48, lng: 127.289, radiusKm: 11 },
  { id: 'gyeonggi', label: '경기', lat: 37.45, lng: 127.2 },
  { id: 'gangwon', label: '강원', lat: 37.75, lng: 128.3 },
  { id: 'chungbuk', label: '충북', lat: 36.75, lng: 127.75 },
  { id: 'chungnam', label: '충남', lat: 36.55, lng: 126.85 },
  { id: 'jeonbuk', label: '전북', lat: 35.72, lng: 127.15 },
  { id: 'jeonnam', label: '전남', lat: 34.85, lng: 126.95 },
  { id: 'gyeongbuk', label: '경북', lat: 36.35, lng: 128.75 },
  { id: 'gyeongnam', label: '경남', lat: 35.3, lng: 128.25 },
  { id: 'jeju', label: '제주', lat: 33.4, lng: 126.55 },
]

export const regionById = (id: string | undefined) => REGIONS.find((r) => r.id === id)

/** 두 좌표 사이 거리(km), 가까운 거리용 근사 */
function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dy = (lat2 - lat1) * 111.32
  const dx = (lng2 - lng1) * 111.32 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

/**
 * 좌표 → 시 · 도 id
 *
 * @example
 * regionOf(37.5446, 127.0559) // 'seoul'
 * regionOf(37.7637, 128.8996) // 'gangwon' (강릉)
 */
export function regionOf(lat: number, lng: number): string {
  const metro = REGIONS.filter((r) => r.radiusKm != null)
    .map((r) => ({ r, d: km(lat, lng, r.lat, r.lng) }))
    .filter(({ r, d }) => d <= r.radiusKm!)
    .sort((a, b) => a.d - b.d)[0]
  if (metro) return metro.r.id
  return REGIONS.filter((r) => r.radiusKm == null)
    .map((r) => ({ r, d: km(lat, lng, r.lat, r.lng) }))
    .sort((a, b) => a.d - b.d)[0].r.id
}
