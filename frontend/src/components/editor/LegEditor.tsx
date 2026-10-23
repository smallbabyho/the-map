'use client'

import type { TravelMode } from '../../types'
import { LEG_MODES } from '../legModes'
import type { DraftLeg } from './useMapDraft'

interface Props {
  leg: DraftLeg
  onChange: (patch: { mode?: TravelMode; durationMin?: number | null }) => void
}

/** 핀 사이 구간: 이동수단 선택 + 소요시간(분) 입력. 핀 목록 사이에 들어간다. */
export function LegEditor({ leg, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-[58px] pr-3">
      {/* 핀 아이콘 열과 맞춘 세로 점선 */}
      <span className="absolute left-[39px] h-full border-l-2 border-dotted border-(--c-border)" aria-hidden />
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
      <label className="flex h-8 items-center gap-1 rounded-lg border border-(--c-border) bg-(--c-surface) pl-2 pr-2.5 text-sm focus-within:border-(--c-accent)">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          value={leg.durationMin ?? ''}
          placeholder="-"
          onChange={(e) => {
            const v = e.target.value
            if (v === '') return onChange({ durationMin: null })
            const n = Math.round(Number(v))
            if (Number.isFinite(n)) onChange({ durationMin: Math.min(1440, Math.max(0, n)) })
          }}
          className="w-10 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="소요시간(분)"
        />
        <span className="text-(--c-muted)">분</span>
      </label>
    </div>
  )
}
