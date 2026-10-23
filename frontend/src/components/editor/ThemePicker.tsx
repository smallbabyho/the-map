'use client'

import type { ThemeId } from '../../types'
import { getTheme, isCustomTheme, THEME_LIST } from '../themes'

interface Props {
  value: ThemeId
  onChange: (id: ThemeId) => void
}

/**
 * 지도 색 테마 선택 (지도 위에 떠 있는 알약 모양): 프리셋 + 직접 고르기(컬러 피커).
 * 배경 라이트/다크는 여기서 고르지 않는다 (지도 오른쪽 버튼 · AppearanceButton).
 */
export function ThemePicker({ value, onChange }: Props) {
  const custom = isCustomTheme(value)
  const pill = (on: boolean) =>
    `flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition ${
      on ? 'bg-(--c-text) text-(--c-surface)' : 'text-(--c-muted) hover:bg-black/5 hover:text-(--c-text)'
    }`

  return (
    <div className="tm-float flex rounded-full bg-(--c-surface) p-1" role="radiogroup" aria-label="지도 색 테마">
      {THEME_LIST.map((t) => {
        const on = t.id === value
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(t.id)} className={pill(on)}>
            <Swatches colors={t.palette.slice(0, 2)} />
            {t.name}
          </button>
        )
      })}
      {/* 직접 고르기: 대표색 하나를 고르면 핀 색 후보는 자동으로 만들어진다 */}
      <label role="radio" aria-checked={custom} className={`${pill(custom)} relative cursor-pointer`} title="대표색 직접 고르기">
        <Swatches colors={custom ? getTheme(value).palette.slice(0, 2) : ['conic-gradient(red, yellow, lime, cyan, blue, magenta, red)']} />
        직접
        <input
          type="color"
          value={custom ? value : '#3b82f6'}
          onChange={(e) => onChange(e.target.value.toLowerCase() as ThemeId)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label="대표색 직접 고르기"
        />
      </label>
    </div>
  )
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex -space-x-1" aria-hidden>
      {colors.map((c) => (
        <span key={c} className="size-3 rounded-full ring-1 ring-(--c-surface)" style={{ background: c }} />
      ))}
    </span>
  )
}
