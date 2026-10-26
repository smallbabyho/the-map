'use client'

import { useState } from 'react'
import type { ThemeId } from '../../types'
import { getTheme, isCustomTheme } from '../themes'

interface Props {
  value: ThemeId
  onChange: (id: ThemeId) => void
}

// 지도 대표색 고르기: ① 색 계열(차분한 톤) → ② 그 계열의 밝은~진한 비슷한 색 5가지.
// 고른 색이 경로선 · 버튼 색이 되고, 핀 색 후보는 그 색에서 자동으로 만들어진다 (themes.ts customTheme).
// 예전 이름 붙은 프리셋(기본 · 파스텔 …)은 고르는 칸에서는 뺐다. 이미 그 테마인 지도는 그대로 보인다.

const FAMILIES: { id: string; name: string; hue: number; sat: number }[] = [
  { id: 'red', name: '레드', hue: 356, sat: 52 },
  { id: 'coral', name: '코랄', hue: 14, sat: 58 },
  { id: 'yellow', name: '옐로', hue: 42, sat: 62 },
  { id: 'olive', name: '올리브', hue: 72, sat: 34 },
  { id: 'green', name: '그린', hue: 140, sat: 30 },
  { id: 'mint', name: '민트', hue: 172, sat: 36 },
  { id: 'blue', name: '블루', hue: 214, sat: 46 },
  { id: 'purple', name: '퍼플', hue: 262, sat: 34 },
  { id: 'pink', name: '핑크', hue: 330, sat: 44 },
  { id: 'brown', name: '브라운', hue: 26, sat: 30 },
]
/** 밝은 톤 → 진한 톤 (L%). 너무 쨍하지 않게 채도는 계열마다 낮게 잡았다 */
const TONES = [74, 64, 54, 44, 34]

function hsl(h: number, s: number, l: number): `#${string}` {
  const k = (n: number) => (n + h / 30) % 12
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
const shadesOf = (f: (typeof FAMILIES)[number]) => TONES.map((l) => hsl(f.hue, f.sat, l))
const middleOf = (f: (typeof FAMILIES)[number]) => hsl(f.hue, f.sat, TONES[2])

/** 지금 색이 어느 계열의 몇 번째 톤인지 (직접 고른 색 · 예전 프리셋이면 없음) */
function locate(hex: string) {
  for (const f of FAMILIES) {
    const i = shadesOf(f).indexOf(hex as `#${string}`)
    if (i >= 0) return f.id
  }
  return null
}

export function ThemePicker({ value, onChange }: Props) {
  const current = getTheme(value).accent.toLowerCase()
  const found = locate(current)
  const [familyId, setFamilyId] = useState<string>(found ?? FAMILIES[6].id)
  const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[6]
  const ring = 'ring-2 ring-(--c-text) ring-offset-2 ring-offset-(--c-surface)'

  return (
    <div className="space-y-2.5">
      {/* ① 색 계열 */}
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="색 계열">
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={familyId === f.id}
            aria-label={f.name}
            title={f.name}
            onClick={() => {
              setFamilyId(f.id)
              onChange(middleOf(f))
            }}
            className={`size-7 rounded-full transition hover:scale-110 ${familyId === f.id ? ring : ''}`}
            style={{ background: middleOf(f) }}
          />
        ))}
        {/* 직접 고르기 */}
        <label
          title="원하는 색 직접 고르기"
          className={`relative size-7 cursor-pointer rounded-full transition hover:scale-110 ${!found ? ring : ''}`}
          style={{ background: !found ? current : 'conic-gradient(#d98c8c, #d9c38c, #9cc49a, #8cb8d9, #b39cd9, #d98cb8, #d98c8c)' }}
        >
          <input
            type="color"
            value={isCustomTheme(value) ? value : current}
            onChange={(e) => onChange(e.target.value.toLowerCase() as ThemeId)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="원하는 색 직접 고르기"
          />
        </label>
      </div>

      {/* ② 고른 계열의 비슷한 색 (밝게 → 진하게) */}
      <div className="flex items-center gap-1.5 rounded-xl bg-black/[0.04] p-1.5" role="radiogroup" aria-label={`${family.name} 비슷한 색`}>
        {shadesOf(family).map((hex, i) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={current === hex}
            aria-label={`${family.name} ${['아주 밝게', '밝게', '보통', '진하게', '아주 진하게'][i]}`}
            onClick={() => onChange(hex)}
            className={`h-8 flex-1 rounded-lg transition hover:scale-105 ${current === hex ? ring : ''}`}
            style={{ background: hex }}
          />
        ))}
      </div>
    </div>
  )
}
