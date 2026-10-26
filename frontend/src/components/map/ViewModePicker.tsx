'use client'

import { useMemo, useState } from 'react'
import type { Pin, TravelMode } from '../../types'
import { LEG_MODES, legLabel } from '../legModes'
import { useRoutes, type LatLngLike } from './routing'
import type { MapLegView } from './types'

// 보는 사람이 이동수단을 바꿔 코스를 볼 수 있게 (지도 주인이 정한 이동수단은 그대로 두고 화면에서만).
// 'course' 는 지도에 저장된 그대로. 구간마다 따로 바꿔 볼 수도 있다 (setLegMode). 전체 이동수단을 다시 고르면 구간별 선택은 풀린다.

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
 * view.setLegMode(a.id, b.id, 'bike') // 이 구간만 자전거로
 */
export function useViewCourse(pins: Pin[], legs: MapLegView[], mode: ViewMode) {
  // 구간별로 바꾼 이동수단. 어느 전체 이동수단에서 고른 건지 같이 두고, 전체가 바뀌면 무시한다
  const [picked, setPicked] = useState<{ base: ViewMode; modes: Record<string, TravelMode> }>({ base: mode, modes: {} })
  const overrides = picked.base === mode ? picked.modes : NO_OVERRIDES
  const pairs = useMemo(
    () =>
      pins.slice(1).map((to, i) => {
        const from = pins[i]
        const saved = legs.find((l) => l.fromPinId === from.id && l.toPinId === to.id)
        const own = overrides[`${from.id}>${to.id}`]
        const leg: MapLegView = own
          ? { fromPinId: from.id, toPinId: to.id, mode: own, durationMin: null }
          : mode === 'course'
            ? (saved ?? { fromPinId: from.id, toPinId: to.id, mode: 'walk', durationMin: null })
            : { fromPinId: from.id, toPinId: to.id, mode, durationMin: null } // 바꿔 볼 땐 길찾기 시간으로
        return { from, to, leg }
      }),
    [pins, legs, mode, overrides],
  )
  const { routeOf, version } = useRoutes(pairs.map((p) => ({ from: at(p.from), to: at(p.to), mode: p.leg.mode })))

  return useMemo(() => {
    const rows = pairs.map(({ from, to, leg }) => {
      const route = routeOf(at(from), at(to), leg.mode)
      return { from, to, leg, durationMin: leg.durationMin ?? route?.durationMin ?? null, transit: route?.transit, note: route?.note }
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
      /** 예상치가 된 이유 (예: 대중교통 하루 사용량을 다 씀) */
      noteOf: (fromId: string, toId: string) => find(fromId, toId)?.note,
      totalMin: rows.reduce((s, r) => s + (r.durationMin ?? 0), 0),
      /** 아직 길찾기 중인 구간이 있나 */
      loading: rows.some((r) => r.durationMin == null),
      /** 이 구간만 이동수단 바꿔 보기 */
      setLegMode: (fromId: string, toId: string, m: TravelMode) =>
        setPicked((cur) => ({ base: mode, modes: { ...(cur.base === mode ? cur.modes : {}), [`${fromId}>${toId}`]: m } })),
    }
    // version: 길찾기 결과가 도착하면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, routeOf, version, mode])
}

const NO_OVERRIDES: Record<string, TravelMode> = {}

/** 구간 줄: '🚶 10분' + 이 구간 이동수단 고르기 (🚇 🚗 🚲 🚶) */
export function LegModeSwitch({ mode, durationMin, note, onChange }: { mode: TravelMode; durationMin: number | null; note?: string; onChange: (m: TravelMode) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-semibold text-(--c-text)">{legLabel(mode, durationMin)}</span>
      <span className="inline-flex gap-0.5 rounded-full border border-(--c-border) bg-(--c-surface) p-0.5" role="radiogroup" aria-label="이 구간 이동수단">
        {LEG_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            aria-label={m.label}
            title={m.label}
            onClick={() => mode !== m.id && onChange(m.id)}
            className={`grid size-7 place-items-center rounded-full text-sm transition ${mode === m.id ? 'bg-(--c-ink)' : 'opacity-50 hover:opacity-100'}`}
          >
            {m.icon}
          </button>
        ))}
      </span>
      {note && <span className="basis-full text-[11px] text-amber-600">⚠️ {note}</span>}
    </span>
  )
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
