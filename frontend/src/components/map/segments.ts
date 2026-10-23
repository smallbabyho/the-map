import { useMemo } from 'react'
import type { Pin, TravelMode } from '../../types'
import { useRoutes, type LatLngLike } from './routing'
import { STEP_ICON, type TransitStepKind } from './transit'
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
  /** 대중교통 상세가 있으면 단계별로 나눠 그린다 (걷기·역까지 이동은 점선, 비행기는 대시, 나머지는 노선 색 실선) */
  parts?: { path: LatLngLike[]; color?: string; kind: TransitStepKind }[]
  /** 구간 라벨 아이콘 (대중교통이면 가장 오래 타는 수단: 🚌 🚄 ✈️ …) */
  icon?: string
}

/** 단계 종류 → 선 모양. 반환값: [카카오 strokeStyle, svg dasharray] */
export function partLine(kind: TransitStepKind): { kakao: string; svg?: string } {
  if (kind === 'walk' || kind === 'access') return { kakao: 'shortdot', svg: '0.1 9' }
  if (kind === 'air') return { kakao: 'dash', svg: '16 7' }
  return { kakao: 'solid' }
}

const at = (p: Pin): LatLngLike => ({ lat: p.place.lat, lng: p.place.lng })

function pairsOf(pins: Pin[], legs: MapLegView[]) {
  return pins.slice(1).map((to, i) => {
    const from = pins[i]
    const leg = legs.find((l) => l.fromPinId === from.id && l.toPinId === to.id)
    return { from, to, leg, mode: leg?.mode ?? ('walk' as TravelMode) }
  })
}

function mainRideIcon(steps?: { kind: TransitStepKind; minutes: number }[]) {
  const rides = steps?.filter((s) => s.kind !== 'walk' && s.kind !== 'access') ?? []
  if (!rides.length) return undefined
  return STEP_ICON[rides.reduce((a, b) => (b.minutes > a.minutes ? b : a)).kind]
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
          parts: route?.transit?.steps.map((s) => ({ path: s.path, color: s.color, kind: s.kind })),
          icon: mainRideIcon(route?.transit?.steps),
        }
      }),
    // version: 경로가 도착하면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairs, routeOf, version],
  )
}
