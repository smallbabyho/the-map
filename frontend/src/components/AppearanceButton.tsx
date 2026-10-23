'use client'

import { setAppearancePref, useAppearance, type AppearancePref } from './appearance'
import { AutoModeIcon, MoonIcon, SunIcon } from './icons'

const NEXT: Record<AppearancePref, AppearancePref> = { auto: 'light', light: 'dark', dark: 'auto' }
const LABEL: Record<AppearancePref, string> = { auto: '자동', light: '라이트', dark: '다크' }

/**
 * 라이트 / 다크 / 자동(일출·일몰) 전환 버튼. 누를 때마다 자동 → 라이트 → 다크 → 자동.
 * variant="map": 지도 위 떠 있는 버튼 / "rail": 왼쪽 메뉴
 */
export function AppearanceButton({ variant, className = '' }: { variant: 'map' | 'rail'; className?: string }) {
  const { pref, mode, nextChange } = useAppearance()
  const Icon = pref === 'auto' ? AutoModeIcon : pref === 'light' ? SunIcon : MoonIcon
  const title =
    pref === 'auto'
      ? `화면: 자동(일출·일몰) · 지금 ${LABEL[mode]}${nextChange ? ` · ${nextChange}` : ''} (누르면 라이트)`
      : `화면: ${LABEL[pref]} (누르면 ${LABEL[NEXT[pref]]})`

  if (variant === 'rail') {
    return (
      <button
        type="button"
        onClick={() => setAppearancePref(NEXT[pref])}
        title={title}
        aria-label={title}
        className={`flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium text-(--c-muted) transition hover:bg-black/5 hover:text-(--c-text) ${className}`}
      >
        <Icon size={20} />
        {LABEL[pref]}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setAppearancePref(NEXT[pref])}
      title={title}
      aria-label={title}
      className={`tm-float grid size-10 place-items-center rounded-xl bg-(--c-surface) text-(--c-text) transition hover:opacity-90 ${className}`}
    >
      <Icon size={18} />
    </button>
  )
}
