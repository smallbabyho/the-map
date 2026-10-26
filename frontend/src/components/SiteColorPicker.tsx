'use client'

import { SITE_COLORS, setSiteColor, useSiteColor } from './siteColor'

/** 화면 색 테마 동그라미 고르기 (☰ 메뉴 · 내 계정 화면) */
export function SiteColorPicker({ className = '' }: { className?: string }) {
  const color = useSiteColor()
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="radiogroup" aria-label="화면 색 테마">
      {SITE_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={color === c.id}
          aria-label={c.label}
          title={c.label}
          onClick={() => setSiteColor(c.id)}
          className={`size-7 rounded-full transition hover:scale-110 ${color === c.id ? 'ring-2 ring-(--c-text) ring-offset-2 ring-offset-(--c-surface)' : ''}`}
          style={{ background: c.swatch }}
        />
      ))}
    </div>
  )
}
