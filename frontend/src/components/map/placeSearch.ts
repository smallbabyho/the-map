import type { Place } from '../../types'
import { hasKakaoKey, loadKakao } from './loadKakao'
import { SAMPLE_PLACES } from './samplePlaces'

export interface PlaceSearchResult extends Omit<Place, 'id'> {
  address: string
  category: string
  /** 지금 보는 지도 근처에서 찾았을 때: 지도 가운데에서 떨어진 거리(m) */
  distanceM?: number
}

/** 지금 화면에 보이는 지도 범위. 카카오맵이 움직일 때마다 알려 주고(KakaoMap), 장소 검색이 이 근처부터 찾는다 */
let viewArea: { lat: number; lng: number; radius: number } | null = null
export function setSearchArea(area: { lat: number; lng: number; radius: number } | null) {
  viewArea = area
}

/**
 * 장소 키워드 검색. 카카오 키가 없으면 내장 샘플 장소에서 찾는다.
 *
 * @example
 * const results = await searchPlaces('성수 카페')
 */
export async function searchPlaces(keyword: string, { nearView = false } = {}): Promise<PlaceSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []
  if (!hasKakaoKey) return searchSamples(q)

  // 지금 보는 지도 근처(최대 20km)에서 먼저, 없으면 전국에서
  const area = nearView ? viewArea : null
  if (area) {
    const near = await keywordSearch(q, area)
    if (near.length) return near
  }
  return keywordSearch(q, null)
}

async function keywordSearch(q: string, area: { lat: number; lng: number; radius: number } | null): Promise<PlaceSearchResult[]> {
  const k = await loadKakao()
  return new Promise((resolve, reject) => {
    new k.maps.services.Places().keywordSearch(
      q,
      (data, status) => {
        if (status === k.maps.services.Status.OK) {
          resolve(
            data.map((d) => ({
              externalId: d.id,
              name: d.place_name,
              lat: Number(d.y),
              lng: Number(d.x),
              address: d.road_address_name || d.address_name,
              category: d.category_group_name,
              ...(area && d.distance && { distanceM: Number(d.distance) }),
            })),
          )
        } else if (status === k.maps.services.Status.ZERO_RESULT) {
          resolve([])
        } else {
          reject(new Error('장소 검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'))
        }
      },
      area
        ? { size: 15, location: new k.maps.LatLng(area.lat, area.lng), radius: Math.round(Math.min(20000, Math.max(1500, area.radius))), sort: 'accuracy' }
        : { size: 15 },
    )
  })
}

function searchSamples(q: string): PlaceSearchResult[] {
  const words = q.toLowerCase().split(/\s+/)
  return SAMPLE_PLACES.filter((p) => {
    const hay = `${p.name} ${p.address} ${p.category}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** 직접 찍은 위치의 externalId. 카카오 장소 ID 와 겹치지 않도록 'custom:' 으로 시작한다. */
export const CUSTOM_PREFIX = 'custom:'
export const isCustomPlace = (externalId: string) => externalId.startsWith(CUSTOM_PREFIX)

/**
 * 좌표 → 이름/주소 (카카오 주소 변환). 키가 없거나 실패하면 '지정한 위치'.
 *
 * @example
 * const place = await describePoint(37.5446, 127.0559)
 * // { externalId: 'custom:37.544600,127.055900', name: '성수동 카페거리', address: '서울 성동구 …', … }
 */
export async function describePoint(lat: number, lng: number): Promise<PlaceSearchResult> {
  const base: PlaceSearchResult = {
    externalId: `${CUSTOM_PREFIX}${lat.toFixed(6)},${lng.toFixed(6)}`,
    name: '지정한 위치',
    lat,
    lng,
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    category: '직접 지정',
  }
  if (!hasKakaoKey) return base
  try {
    const k = await loadKakao()
    const result = await new Promise<kakao.maps.services.Coord2AddressResult | null>((resolve) => {
      new k.maps.services.Geocoder().coord2Address(lng, lat, (data, status) =>
        resolve(status === k.maps.services.Status.OK ? (data[0] ?? null) : null),
      )
    })
    if (!result) return base
    const address = result.road_address?.address_name || result.address?.address_name || base.address
    const name = result.road_address?.building_name || address
    return { ...base, name, address }
  } catch {
    return base
  }
}

// 근처 장소를 찾을 카테고리: 음식점 · 카페 · 관광명소 · 문화시설 · 편의점 · 마트 · 숙박 · 지하철역
const NEARBY_CATEGORIES = ['FD6', 'CE7', 'AT4', 'CT1', 'CS2', 'MT1', 'AD5', 'SW8']

/**
 * 찍은 지점 근처의 카카오 장소 (가까운 순, 최대 limit 개). building(그 자리 건물 이름)을 주면 그 이름으로도 찾아서 건물 자체가 장소면 같이 나온다.
 * 키가 없으면 내장 샘플 장소 중 가까운 것.
 *
 * @example
 * const places = await nearbyPlaces(37.5446, 127.0559, { building: '성수아이파크' }) // [{ name: '어니언 성수', distance: 12, … }, …]
 */
export async function nearbyPlaces(lat: number, lng: number, { radius = 80, limit = 8, building = '' } = {}): Promise<(PlaceSearchResult & { distance: number })[]> {
  if (!hasKakaoKey) {
    return SAMPLE_PLACES.map((p) => ({ ...p, distance: Math.round(distanceM(lat, lng, p.lat, p.lng)) }))
      .filter((p) => p.distance <= radius * 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
  }
  const k = await loadKakao()
  const places = new k.maps.services.Places()
  const location = new k.maps.LatLng(lat, lng)
  const options = { location, radius, sort: 'distance' as const, size: 5 }
  const collect = (run: (cb: (data: kakao.maps.services.PlaceResult[], status: kakao.maps.services.Status) => void) => void) =>
    new Promise<kakao.maps.services.PlaceResult[]>((resolve) => run((data, status) => resolve(status === k.maps.services.Status.OK ? data : [])))

  const found = await Promise.all([
    ...NEARBY_CATEGORIES.map((code) => collect((cb) => places.categorySearch(code, cb, options))),
    // 건물 이름이 있으면 그 이름으로도 (대형 건물 · 상가 자체가 장소인 경우)
    building ? collect((cb) => places.keywordSearch(building, cb, options)) : Promise.resolve([]),
  ])
  const byId = new Map<string, PlaceSearchResult & { distance: number }>()
  for (const d of found.flat()) {
    if (byId.has(d.id)) continue
    byId.set(d.id, {
      externalId: d.id,
      name: d.place_name,
      lat: Number(d.y),
      lng: Number(d.x),
      address: d.road_address_name || d.address_name,
      category: d.category_group_name,
      distance: Number(d.distance ?? distanceM(lat, lng, Number(d.y), Number(d.x))),
    })
  }
  return [...byId.values()].sort((a, b) => a.distance - b.distance).slice(0, limit)
}

/** 두 좌표 사이 거리(m), 가까운 거리용 근사 */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dy = (lat2 - lat1) * 111_320
  const dx = (lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180)
  return Math.hypot(dx, dy)
}
