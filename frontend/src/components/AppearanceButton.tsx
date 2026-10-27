'use client'

import { useEffect, useRef, useState } from 'react'
import { setAppearancePref, useAppearance, type AppearancePref } from './appearance'
import { AutoModeIcon, CheckIcon, MoonIcon, SunIcon } from './icons'

const OPTIONS: { id: AppearancePref; label: string; Icon: typeof SunIcon }[] = [
  { id: 'auto', label: '자동', Icon: AutoModeIcon },
  { id: 'light', label: '라이트', Icon: SunIcon },
  { id: 'dark', label: '다크', Icon: MoonIcon },
]
const LABEL: Record<AppearancePref, string> = { auto: '자동', light: '라이트', dark: '다크' }

/** 자동 옵션 아래 설명: '일출·일몰에 맞춰 바뀌어요 · 일몰 17:45에 다크로' */
function autoHint(nextChange: string) {
  return `일출·일몰에 맞춰 바뀌어요${nextChange ? ` · ${nextChange}` : ''}`
}

/**
 * 화면 설정 버튼: 누르면 [자동(일출·일몰) / 라이트 / 다크] 메뉴가 열린다.
 * variant="map": 지도 위 떠 있는 버튼(메뉴는 왼쪽으로) / "rail": 왼쪽 메뉴(메뉴는 오른쪽으로)
 */
export function AppearanceButton({ variant }: { variant: 'map' | 'rail' }) {
  const { pref } = useAppearance()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = OPTIONS.find((o) => o.id === pref)!.Icon

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = `화면 설정: ${LABEL[pref]}`
  return (
    <div ref={ref} className="relative">
      {variant === 'rail' ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={label}
          aria-expanded={open}
          title={label}
          className="flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] font-medium text-(--c-muted) transition hover:bg-black/5 hover:text-(--c-text)"
        >
          <Icon size={20} />
          {LABEL[pref]}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={label}
          aria-expanded={open}
          title={label}
          className="tm-float grid size-10 place-items-center rounded-xl bg-(--c-surface) text-(--c-text) transition hover:opacity-90"
        >
          <Icon size={18} />
        </button>
      )}
      {open && (
        <div
          className={`tm-float absolute z-50 w-60 rounded-xl border border-(--c-border) bg-(--c-surface) p-1.5 text-(--c-text) ${
            variant === 'rail' ? 'bottom-0 left-full ml-3' : 'right-full top-0 mr-2'
          }`}
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-(--c-muted)">화면</p>
          <AppearanceOptions onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/** 자동 / 라이트 / 다크 고르기 목록. 메뉴 안이나 '내 계정' 화면에 쓴다. */
export function AppearanceOptions({ onPick }: { onPick?: () => void }) {
  const { pref, nextChange } = useAppearance()
  return (
    <div role="radiogroup" aria-label="화면 설정">
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = pref === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              setAppearancePref(id)
              onPick?.()
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${on ? 'bg-black/[0.05] font-semibold' : 'hover:bg-black/[0.04]'}`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="min-w-0 flex-1">
              {id === 'auto' ? '자동 (일출·일몰)' : label}
              {id === 'auto' && <span className="block text-xs font-normal text-(--c-muted)">{autoHint(nextChange)}</span>}
            </span>
            {on && <CheckIcon size={16} className="shrink-0 text-(--c-accent)" />}
          </button>
        )
      })}
    </div>
  )
}
