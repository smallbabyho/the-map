import type { CSSProperties } from 'react'
import type { ThemeId } from '../types'

export interface Theme {
  id: ThemeId
  name: string
  /** 새 핀 색 · 색상 선택지 */
  palette: string[]
  /** 이동구간 선 색 */
  route: string
  /** UI 색 (CSS 변수로 주입) */
  ui: {
    bg: string
    surface: string
    text: string
    muted: string
    border: string
    accent: string
    accentText: string
    /** 키 없을 때 미리보기 지도 배경 */
    mapBg: string
    mapGrid: string
  }
}

export const THEMES: Record<ThemeId, Theme> = {
  default: {
    id: 'default',
    name: '기본',
    palette: ['#f97316', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#0f172a'],
    route: '#f97316',
    ui: {
      bg: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      muted: '#64748b',
      border: '#e2e8f0',
      accent: '#f97316',
      accentText: '#ffffff',
      mapBg: '#eef2f6',
      mapGrid: '#dde3ea',
    },
  },
  pastel: {
    id: 'pastel',
    name: '파스텔',
    palette: ['#f9a8d4', '#a5b4fc', '#86efac', '#fcd34d', '#c4b5fd', '#7dd3fc'],
    route: '#c084fc',
    ui: {
      bg: '#fdf4ff',
      surface: '#ffffff',
      text: '#4a3b5c',
      muted: '#8b7a9e',
      border: '#f0e1f7',
      accent: '#c084fc',
      accentText: '#ffffff',
      mapBg: '#f6eefb',
      mapGrid: '#ead9f3',
    },
  },
  dark: {
    id: 'dark',
    name: '다크',
    palette: ['#facc15', '#22d3ee', '#f472b6', '#4ade80', '#fb923c', '#e5e7eb'],
    route: '#22d3ee',
    ui: {
      bg: '#0b1020',
      surface: '#141a2e',
      text: '#e5e7eb',
      muted: '#94a3b8',
      border: '#26304a',
      accent: '#22d3ee',
      accentText: '#0b1020',
      mapBg: '#111729',
      mapGrid: '#1d2640',
    },
  },
  vintage: {
    id: 'vintage',
    name: '빈티지',
    palette: ['#b45309', '#7c2d12', '#4d7c0f', '#155e75', '#9f1239', '#57534e'],
    route: '#92400e',
    ui: {
      bg: '#f5efe2',
      surface: '#fbf7ee',
      text: '#3f2d1d',
      muted: '#8a7560',
      border: '#e4d8c0',
      accent: '#b45309',
      accentText: '#fbf7ee',
      mapBg: '#efe6d2',
      mapGrid: '#e1d4b8',
    },
  },
}

export const THEME_LIST = Object.values(THEMES)

export function getTheme(id: string | undefined): Theme {
  return THEMES[id as ThemeId] ?? THEMES.default
}

/** 테마 UI 색을 CSS 변수로. 루트 요소 style 에 넣으면 하위에서 bg-(--c-bg) 같은 식으로 쓴다. */
export function themeVars(theme: Theme): CSSProperties {
  const u = theme.ui
  return {
    '--c-bg': u.bg,
    '--c-surface': u.surface,
    '--c-text': u.text,
    '--c-muted': u.muted,
    '--c-border': u.border,
    '--c-accent': u.accent,
    '--c-accent-text': u.accentText,
    '--c-map-bg': u.mapBg,
    '--c-map-grid': u.mapGrid,
  } as CSSProperties
}

export const PIN_EMOJIS = [
  '📍', '☕', '🍞', '🍰', '🍜', '🍣', '🍔', '🍺',
  '🎬', '📸', '🏛️', '🌳', '🛍️', '🎵', '🏖️', '⭐',
  '❤️', '🎨', '📚', '⛩️', '🎡', '🐾', '🌸', '🚩',
]
