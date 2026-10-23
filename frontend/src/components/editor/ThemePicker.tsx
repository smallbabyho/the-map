'use client'

import type { ThemeId } from '../../types'
import { THEME_LIST } from '../themes'

interface Props {
  value: ThemeId
  onChange: (id: ThemeId) => void
}

/** 지도 테마 선택 (지도 위에 떠 있는 알약 모양) */
export function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="tm-float flex rounded-full bg-white p-1" role="radiogroup" aria-label="지도 테마">
      {THEME_LIST.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.id)}
            className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition ${
              on ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex -space-x-1" aria-hidden>
              {t.palette.slice(0, 2).map((c) => (
                <span key={c} className="size-3 rounded-full ring-1 ring-white" style={{ background: c }} />
              ))}
            </span>
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
