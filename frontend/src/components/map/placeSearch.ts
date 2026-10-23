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
