'use client'

import { useSyncExternalStore } from 'react'
import { SITE_COLOR_STORAGE_KEY as STORAGE_KEY } from './appearanceScript'
import { withThemeTransition } from './themeTransition'

// 화면 색 테마: 사이트 강조색 + 라이트 화면 배경 틴트. 라이트 / 다크와는 따로 고른다 (보는 사람마다, 브라우저에 저장).
// 실제 색은 app/globals.css 의 :root[data-color='…'] 에서 바뀐다. 여기서는 <html data-color> 만 정한다.
// 지도 화면은 그 지도의 색 테마(themes.ts)가 강조색을 덮어쓴다.

export const SITE_COLORS = [
  { id: 'tangerine', label: '탠저린', swatch: '#ff5a2b' },
  { id: 'cherry', label: '체리', swatch: '#e11d48' },
  { id: 'berry', label: '베리', swatch: '#db2777' },
  { id: 'violet', label: '바이올렛', swatch: '#7c3aed' },
  { id: 'ocean', label: '오션', swatch: '#2563eb' },
  { id: 'mint', label: '민트', swatch: '#0d9488' },
  { id: 'forest', label: '포레스트', swatch: '#16a34a' },
  { id: 'sunny', label: '써니', swatch: '#f59e0b' },
] as const
export type SiteColor = (typeof SITE_COLORS)[number]['id']
const DEFAULT: SiteColor = 'tangerine'

function read(): SiteColor {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return SITE_COLORS.some((c) => c.id === v) ? (v as SiteColor) : DEFAULT
  } catch {
    return DEFAULT
  }
}

const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setSiteColor(color: SiteColor) {
  try {
    if (color === DEFAULT) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, color)
  } catch {
    // 저장 못 해도 이번 화면에는 적용
  }
  withThemeTransition(() => {
    document.documentElement.dataset.color = color
    listeners.forEach((fn) => fn())
  })
}

/** 지금 고른 색 테마 */
export function useSiteColor(): SiteColor {
  return useSyncExternalStore(subscribe, read, () => DEFAULT)
}
