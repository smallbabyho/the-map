import { useMemo } from 'react'
import type { Pin, TravelMode } from '../../types'
import { useRoutes, type LatLngLike } from './routing'
import type { MapLegView } from './types'

/** 지도에 그릴 구간 1개: 핀 순서대로 이웃한 두 핀 사이 */
export interface Segment {
  key: string
  mode: TravelMode
  durationMin: number | null
  /** 경로선. 길찾기 결과가 오기 전엔 두 핀을 잇는 직선 */
  path: LatLngLike[]
  /** 아직 길찾기 중이면 true */
  loading: boolean
  /** 대중교통 상세가 있으면 단계별로 나눠 그린다 (걷기는 점선, 버스·지하철은 노선 색 실선) */
  parts?: { path: LatLngLike[]; color?: string; walk: boolean }[]
}

const at = (p: Pin): LatLngLike => ({ lat: p.place.lat, lng: p.place.lng })

function pairsOf(pins: Pin[], legs: MapLegView[]) {
  return pins.slice(1).map((to, i) => {
    const from = pins[i]
    const leg = legs.find((l) => l.fromPinId === from.id && l.toPinId === to.id)
    return { from, to, leg, mode: leg?.mode ?? ('walk' as TravelMode) }
  })
}

/** 핀 · 구간 → 지도에 그릴 구간 목록 (실제 길 포함). 구간 정보가 없는 핀 사이는 도보로 본다. */
export function useSegments(pins: Pin[], legs: MapLegView[]): Segment[] {
  const pairs = useMemo(() => pairsOf(pins, legs), [pins, legs])
  const { routeOf, version } = useRoutes(pairs.map((p) => ({ from: at(p.from), to: at(p.to), mode: p.mode })))

  return useMemo(
    () =>
      pairs.map(({ from, to, leg, mode }) => {
        const route = routeOf(at(from), at(to), mode)
        return {
          key: `${from.id}>${to.id}`,
          mode,
          durationMin: leg?.durationMin ?? route?.durationMin ?? null,
          path: route?.path ?? [at(from), at(to)],
          loading: !route,
          parts: route?.transit?.steps.map((s) => ({ path: s.path, color: s.color, walk: s.kind === 'walk' })),
        }
      }),
    // version: 경로가 도착하면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairs, routeOf, version],
  )
}
