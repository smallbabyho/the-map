// 🔗 링크로 한 번에 채우기: 서버(app/api/places/from-link)가 글에서 장소 이름을 뽑고, 여기서 카카오 장소 검색으로 위치를 찾는다.
import { hasSupabase, supabase } from '../../lib/supabase'
import { distanceMeters } from '../../lib/arrival'
import { searchPlaces, type PlaceSearchResult } from '../map'
import { CUSTOM_PREFIX } from '../map/placeSearch'

export interface FoundPlace {
  name: string
  area: string
  memo: string
  /** 블로그 장소 카드에서 읽었으면 주소 · 좌표 */
  address?: string
  lat?: number
  lng?: number
  /** 장소 검색으로 찾은 실제 장소. 못 찾았으면 null */
  match: PlaceSearchResult | null
}

/** AI(글에서 장소 찾기)를 쓸 수 있는지. 없으면 링크의 장소 카드만 읽는다 */
export async function linkImportHasAi(): Promise<boolean> {
  try {
    const res = await fetch('/api/places/from-link')
    return ((await res.json()) as { ai?: boolean }).ai === true
  } catch {
    return false
  }
}

const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distanceMeters(a, b) <= 300

/**
 * 이름(+ 지역)으로 카카오 장소를 찾는다. 좌표를 알면 그 근처(300m)의 결과만, 없으면 그 좌표에 그 이름으로 직접 지정한 위치.
 */
async function resolve(p: Omit<FoundPlace, 'match'>): Promise<PlaceSearchResult | null> {
  const first = await searchPlaces(`${p.area} ${p.name}`.trim()).catch(() => [])
  const list = first.length ? first : await searchPlaces(p.name).catch(() => [])
  if (p.lat == null || p.lng == null) return list[0] ?? null
  const at = { lat: p.lat, lng: p.lng }
  const hit = list.filter((r) => near(r, at)).sort((a, b) => distanceMeters(a, at) - distanceMeters(b, at))[0]
  return (
    hit ?? {
      externalId: `${CUSTOM_PREFIX}${p.lat.toFixed(6)},${p.lng.toFixed(6)}`,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      address: p.address ?? '',
      category: '블로그 장소',
    }
  )
}

/** 링크(또는 붙여 넣은 글)에서 장소 찾기. 실패하면 한국어 메시지를 던진다 */
export async function findPlacesFromLink(input: { url?: string; text?: string }): Promise<{ title: string; places: FoundPlace[] }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (hasSupabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  let res: Response
  try {
    res = await fetch('/api/places/from-link', { method: 'POST', headers, body: JSON.stringify(input) })
  } catch {
    throw new Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; title?: string; places?: Omit<FoundPlace, 'match'>[] }
  if (!res.ok || !data.places) throw new Error(data.error ?? '장소를 찾지 못했어요.')

  // 지역 힌트를 붙여 검색하고, 없으면 이름만으로 (4곳씩 나눠서)
  const places: FoundPlace[] = []
  for (let i = 0; i < data.places.length; i += 4) {
    const batch = await Promise.all(
      data.places.slice(i, i + 4).map(async (p) => ({ ...p, match: await resolve(p) })),
    )
    places.push(...batch)
  }
  return { title: data.title ?? '', places }
}
