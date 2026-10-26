'use client'

import { useMemo } from 'react'
import type { Pin, TravelMode } from '../../types'
import { LEG_MODES } from '../legModes'
import { useRoutes, type LatLngLike } from './routing'
import type { MapLegView } from './types'

// 보는 사람이 이동수단을 바꿔 코스를 볼 수 있게 (지도 주인이 정한 이동수단은 그대로 두고 화면에서만).
// 'course' 는 지도에 저장된 그대로.

export type ViewMode = 'course' | TravelMode

const at = (p: Pin): LatLngLike => ({ lat: p.place.lat, lng: p.place.lng })

/**
 * 이동수단을 바꿔 본 코스: 지도에 넘길 구간 + 구간별 시간 · 대중교통 상세 + 총 시간.
 * 'course' 면 저장된 구간 그대로(저장된 시간이 없으면 길찾기 결과로 채움).
 *
 * @example
 * const view = useViewCourse(pins, legs, mode)
 * <MapView legs={view.legs} … />
 * view.durationOf(a.id, b.id) // 12
 */
export function useViewCourse(pins: Pin[], legs: MapLegView[], mode: ViewMode) {
  const pairs = useMemo(
    () =>
      pins.slice(1).map((to, i) => {
        const from = pins[i]
        const saved = legs.find((l) => l.fromPinId === from.id && l.toPinId === to.id)
        const leg: MapLegView =
          mode === 'course'
            ? (saved ?? { fromPinId: from.id, toPinId: to.id, mode: 'walk', durationMin: null })
            : { fromPinId: from.id, toPinId: to.id, mode, durationMin: null } // 바꿔 볼 땐 길찾기 시간으로
        return { from, to, leg }
      }),
    [pins, legs, mode],
  )
  const { routeOf, version } = useRoutes(pairs.map((p) => ({ from: at(p.from), to: at(p.to), mode: p.leg.mode })))

  return useMemo(() => {
    const rows = pairs.map(({ from, to, leg }) => {
      const route = routeOf(at(from), at(to), leg.mode)
      return { from, to, leg, durationMin: leg.durationMin ?? route?.durationMin ?? null, transit: route?.transit }
    })
    const find = (fromId: string, toId: string) => rows.find((r) => r.from.id === fromId && r.to.id === toId)
    return {
      legs: rows.map((r) => r.leg),
      /** 구간 이동수단 */
      modeOf: (fromId: string, toId: string) => find(fromId, toId)?.leg.mode,
      /** 구간 시간(분). 길찾기 중이면 null */
      durationOf: (fromId: string, toId: string) => find(fromId, toId)?.durationMin ?? null,
      /** 대중교통이면 버스 · 지하철 상세 */
      transitOf: (fromId: string, toId: string) => find(fromId, toId)?.transit,
      totalMin: rows.reduce((s, r) => s + (r.durationMin ?? 0), 0),
      /** 아직 길찾기 중인 구간이 있나 */
      loading: rows.some((r) => r.durationMin == null),
    }
    // version: 길찾기 결과가 도착하면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, routeOf, version])
}

/** 코스대로 · 대중교통 · 자동차 · 자전거 · 도보 중 골라 보기 */
export function ViewModePicker({ value, onChange, className = '' }: { value: ViewMode; onChange: (m: ViewMode) => void; className?: string }) {
  const options: { id: ViewMode; label: string }[] = [{ id: 'course', label: '🧭 코스대로' }, ...LEG_MODES.map((m) => ({ id: m.id as ViewMode, label: `${m.icon} ${m.label}` }))]
  return (
    <div className={`tm-scroll flex gap-1.5 overflow-x-auto ${className}`} role="radiogroup" aria-label="이동수단 바꿔 보기">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value === o.id ? 'border-(--c-ink) bg-(--c-ink) text-(--c-bg)' : 'border-(--c-border) bg-(--c-surface) text-(--c-muted) hover:text-(--c-text)'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
