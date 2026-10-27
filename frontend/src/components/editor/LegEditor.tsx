'use client'

import type { Place, TravelMode } from '../../types'
import { formatMinutes, LEG_MODES } from '../legModes'
import { formatDistance } from '../map'
import { KakaoRouteLink } from '../map/KakaoDirections'
import { TransitSteps } from '../TransitSteps'
import type { DraftLeg } from './useMapDraft'

interface Props {
  leg: DraftLeg
  from: Place
  to?: Place
  onChange: (patch: { mode: TravelMode }) => void
}

/**
 * 핀 사이 구간: 이동수단(대중교통 · 자동차 · 자전거 · 도보) + 소요시간 · 거리. 핀 목록 사이에 들어간다.
 * 시간은 길찾기로만 정해진다 (직접 고치지 않는다).
 */
export function LegEditor({ leg, from, to, onChange }: Props) {
  const route = leg.route
  return (
    <div className="py-2 pl-[58px] pr-3">
      {/* 핀 아이콘 열과 맞춘 세로 점선 */}
      <span className="absolute left-[39px] top-0 h-full border-l-2 border-dotted border-(--c-border)" aria-hidden />
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/[0.04] p-1" role="radiogroup" aria-label="이동수단">
        {LEG_MODES.map((m) => {
          const on = leg.mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ mode: m.id })}
              className={`flex h-10 items-center justify-center gap-1 rounded-lg text-[0.8125rem] font-semibold transition ${
                on ? 'bg-(--c-surface) text-(--c-text) shadow-sm ring-1 ring-(--c-accent)/40' : 'text-(--c-muted) hover:bg-(--c-surface)/60 hover:text-(--c-text)'
              }`}
            >
              <span aria-hidden className={`text-base ${on ? '' : 'opacity-60 grayscale'}`}>
                {m.icon}
              </span>
              {m.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem]">
        {route ? (
          <>
            <b className="font-bold">{leg.durationMin != null ? formatMinutes(leg.durationMin) : '–'}</b>
            <span className="text-(--c-muted)">· {formatDistance(route.distanceM)}</span>
            {route.estimated && (
              <span className="rounded bg-black/[0.05] px-1 py-px text-[0.625rem] text-(--c-muted)" title={route.note ?? (leg.mode === 'transit' ? '직선거리로 예상한 시간이에요' : '길찾기에 실패해 직선거리로 예상했어요')}>
                예상
              </span>
            )}
            {route.note && (
              <span className="truncate text-[0.6875rem] text-amber-600">⚠️ {route.note}</span>
            )}
          </>
        ) : (
          <span className="animate-pulse text-(--c-muted)">길 찾는 중…</span>
        )}
        {to && <KakaoRouteLink from={from} to={to} mode={leg.mode} className="ml-auto text-xs" />}
      </p>
      {leg.mode === 'transit' && route?.transit && <TransitSteps info={route.transit} className="mt-2" />}
    </div>
  )
}
