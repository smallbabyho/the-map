'use client'

import type { TravelMode } from '../../types'
import { LEG_MODES } from '../legModes'
import { formatDistance } from '../map'
import { TransitSteps } from '../TransitSteps'
import type { DraftLeg } from './useMapDraft'

interface Props {
  leg: DraftLeg
  onChange: (patch: { mode?: TravelMode; durationMin?: number | null }) => void
}

/**
 * 핀 사이 구간: 이동수단(도보·대중교통·자동차·자전거) + 소요시간 + 거리. 핀 목록 사이에 들어간다.
 * 시간은 길찾기로 자동으로 채워지고(회색), 직접 적으면 그 값을 쓴다. 비우면 다시 자동.
 */
export function LegEditor({ leg, onChange }: Props) {
  const auto = !leg.isManual
  const route = leg.route
  return (
    <div className="py-1.5 pl-[58px] pr-3">
      <div className="flex items-center gap-2">
        {/* 핀 아이콘 열과 맞춘 세로 점선 */}
        <span className="absolute left-[39px] top-0 h-full border-l-2 border-dotted border-(--c-border)" aria-hidden />
        <div className="flex rounded-lg bg-black/[0.04] p-0.5" role="radiogroup" aria-label="이동수단">
          {LEG_MODES.map((m) => {
            const on = leg.mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={m.label}
                onClick={() => onChange({ mode: m.id })}
                className={`grid h-7 w-8 place-items-center rounded-md text-sm transition ${
                  on ? 'bg-(--c-surface) shadow-sm' : 'opacity-50 grayscale hover:opacity-90'
                }`}
              >
                <span aria-hidden>{m.icon}</span>
                <span className="sr-only">{m.label}</span>
              </button>
            )
          })}
        </div>
        <label
          className="flex h-8 items-center gap-1 rounded-lg border border-(--c-border) bg-(--c-surface) pl-2 pr-2.5 text-sm focus-within:border-(--c-accent)"
          title={auto ? '길찾기로 자동 계산한 시간이에요. 직접 적을 수도 있어요.' : '직접 적은 시간이에요. 지우면 다시 자동으로 계산해요.'}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            value={auto ? '' : (leg.durationMin ?? '')}
            placeholder={auto ? (leg.durationMin != null ? String(leg.durationMin) : '…') : '-'}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') return onChange({ durationMin: null })
              const n = Math.round(Number(v))
              if (Number.isFinite(n)) onChange({ durationMin: Math.min(1440, Math.max(0, n)) })
            }}
            className="w-9 bg-transparent text-right outline-none placeholder:text-(--c-text) placeholder:opacity-55 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label={auto ? `소요시간(분), 자동 ${leg.durationMin ?? ''}분` : '소요시간(분)'}
          />
          <span className="text-(--c-muted)">분</span>
        </label>
        <span className="min-w-0 truncate text-xs text-(--c-muted)">
          {route ? (
            <>
              {formatDistance(route.distanceM)}
              {route.estimated && (
                <span className="ml-1 rounded bg-black/[0.05] px-1 py-px text-[10px]" title={leg.mode === 'transit' ? '직선거리로 예상한 시간이에요' : '길찾기에 실패해 직선거리로 예상했어요'}>
                  예상
                </span>
              )}
            </>
          ) : (
            <span className="animate-pulse">길 찾는 중</span>
          )}
        </span>
      </div>
      {leg.mode === 'transit' && route?.transit && <TransitSteps info={route.transit} className="mt-2" />}
    </div>
  )
}
