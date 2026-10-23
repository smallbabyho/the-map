import type { Place } from '../../types'
import { hasKakaoKey, loadKakao } from './loadKakao'
import { SAMPLE_PLACES } from './samplePlaces'

export interface PlaceSearchResult extends Omit<Place, 'id'> {
  address: string
  category: string
}

/**
 * 장소 키워드 검색. 카카오 키가 없으면 내장 샘플 장소에서 찾는다.
 *
 * @example
 * const results = await searchPlaces('성수 카페')
 */
export async function searchPlaces(keyword: string): Promise<PlaceSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []
  if (!hasKakaoKey) return searchSamples(q)

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
            })),
          )
        } else if (status === k.maps.services.Status.ZERO_RESULT) {
          resolve([])
        } else {
          reject(new Error('장소 검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'))
        }
      },
      { size: 15 },
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
