import type { CSSProperties } from 'react'
import type { ThemeId, ThemePreset } from '../types'

// 지도 '색 테마' = 대표색(경로선 · 버튼) + 핀 색 후보. 지도에 저장된다.
// 배경(라이트/다크)은 테마와 별개로 보는 사람이 정한다 → appearance.ts, app/globals.css
//
// 테마 값은 프리셋 id('default' …) 이거나 직접 고른 색('#3b82f6').

export interface Theme {
  id: ThemeId
  name: string
  /** 새 핀 색 · 색상 선택지 */
  palette: string[]
  /** 이동구간 선 색 */
  route: string
  /** 버튼 등 강조색과 그 위 글자색 */
  accent: string
  accentText: string
}

const PRESETS: Record<ThemePreset, Omit<Theme, 'id' | 'accentText'>> = {
  default: { name: '기본', palette: ['#f97316', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#0f172a'], route: '#f97316', accent: '#f97316' },
  pastel: { name: '파스텔', palette: ['#f9a8d4', '#a5b4fc', '#86efac', '#fcd34d', '#c4b5fd', '#7dd3fc'], route: '#c084fc', accent: '#c084fc' },
  vintage: { name: '빈티지', palette: ['#b45309', '#7c2d12', '#4d7c0f', '#155e75', '#9f1239', '#57534e'], route: '#92400e', accent: '#b45309' },
  neon: { name: '네온', palette: ['#facc15', '#22d3ee', '#f472b6', '#4ade80', '#fb923c', '#e5e7eb'], route: '#22d3ee', accent: '#22d3ee' },
  forest: { name: '숲', palette: ['#16a34a', '#65a30d', '#0d9488', '#ca8a04', '#78350f', '#1e293b'], route: '#15803d', accent: '#16a34a' },
}

export const PRESET_IDS = Object.keys(PRESETS) as ThemePreset[]

/** 예전 '다크' 테마는 색만 남겨 네온으로 (배경은 이제 라이트/다크 설정으로) */
const ALIASES: Record<string, ThemePreset> = { dark: 'neon' }

export const isCustomTheme = (id: string | undefined): id is `#${string}` => /^#[0-9a-f]{6}$/i.test(id ?? '')

// ---- 색 계산 ----
function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** 배경색 위 글자를 흰색/검은색 중 잘 보이는 쪽으로 */
function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.45 ? '#0f172a' : '#ffffff'
}

/** 직접 고른 색 하나로 테마 만들기: 핀 색 후보는 색상환에서 고르게 퍼뜨린다 */
function customTheme(hex: `#${string}`): Theme {
  const [h, s, l] = hexToHsl(hex)
  // 핀 색 후보: 고른 색과 비슷한 계열 (색상 ±18°, 밝기만 다르게). 채도는 고른 색 그대로라 차분한 색이면 차분하게
  const clampL = (v: number) => Math.min(Math.max(v, 22), 82)
  const near: [number, number][] = [
    [-18, 8],
    [18, -8],
    [0, 18],
    [0, -16],
  ]
  const palette = [hex, ...near.map(([dh, dl]) => hslToHex((h + dh + 360) % 360, s, clampL(l + dl))), '#0f172a']
  return { id: hex, name: '직접', palette, route: hex, accent: hex, accentText: textOn(hex) }
}

export function getTheme(id: string | undefined): Theme {
  if (isCustomTheme(id)) return customTheme(id.toLowerCase() as `#${string}`)
  const preset: ThemePreset = id && id in PRESETS ? (id as ThemePreset) : (ALIASES[id ?? ''] ?? 'default')
  const p = PRESETS[preset]
  return { id: preset, ...p, accentText: textOn(p.accent) }
}

export const THEME_LIST = PRESET_IDS.map((id) => getTheme(id))

/**
 * 테마 색을 CSS 변수로. 루트 요소 style 에 넣으면 하위에서 bg-(--c-accent) 같은 식으로 쓴다.
 * 배경은 라이트/다크 기본색(--c-base-bg)에 대표색을 살짝 섞는다.
 */
export function themeVars(theme: Theme): CSSProperties {
  return {
    '--c-accent': theme.accent,
    '--c-accent-text': theme.accentText,
    '--c-bg': `color-mix(in srgb, ${theme.accent} 5%, var(--c-base-bg))`,
    '--c-map-bg': `color-mix(in srgb, ${theme.accent} 6%, var(--c-base-map-bg))`,
  } as CSSProperties
}

export const PIN_EMOJIS = [
  '📍', '☕', '🍞', '🍰', '🍜', '🍣', '🍔', '🍺',
  '🎬', '📸', '🏛️', '🌳', '🛍️', '🎵', '🏖️', '⭐',
  '❤️', '🎨', '📚', '⛩️', '🎡', '🐾', '🌸', '🚩',
]
