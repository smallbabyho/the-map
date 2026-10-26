'use client'

import { useEffect, useRef, useState } from 'react'
import { uploadPinPhoto } from '../../db/api'
import type { LineStyle, LineWidth, MapCategory, MapLook, MarkerShape, ThemeId } from '../../types'
import { MAP_CATEGORIES } from '../mapCategories'
import { ThemePicker } from './ThemePicker'
import { CloseIcon, ImageIcon } from '../icons'

interface Props {
  look: MapLook
  coverUrl: string | null
  onChange: (patch: Partial<MapLook & { coverUrl: string | null; category: MapCategory; categoryLabel: string | null }>) => void
  theme: ThemeId
  onTheme: (id: ThemeId) => void
  category: MapCategory
  categoryLabel: string | null
  /** 지도 위 알약(데스크톱) / 패널 안 줄(모바일) */
  variant?: 'float' | 'inline'
}

const SHAPES: { id: MarkerShape; name: string }[] = [
  { id: 'pin', name: '핀' },
  { id: 'circle', name: '동그라미' },
  { id: 'square', name: '네모' },
  { id: 'emoji', name: '이모지만' },
]
const LINES: { id: LineStyle; name: string; dash?: string }[] = [
  { id: 'auto', name: '이동수단별' },
  { id: 'solid', name: '실선' },
  { id: 'dash', name: '대시', dash: '7 4' },
  { id: 'dot', name: '점선', dash: '0.1 5' },
]
const WIDTHS: { id: LineWidth; name: string; px: number }[] = [
  { id: 'thin', name: '얇게', px: 2 },
  { id: 'normal', name: '보통', px: 3.5 },
  { id: 'bold', name: '굵게', px: 6 },
]

/** 🎨 꾸미기 하나에 다: 색 테마 · 마커 모양 · 코스 선 모양/굵기 · 커버 이미지 · 카테고리 */
export function MapLookPicker({ look, coverUrl, onChange, theme, onTheme, category, categoryLabel, variant = 'float' }: Props) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onCover = async (f: File | undefined) => {
    if (!f) return
    setUploading(true)
    setError('')
    try {
      onChange({ coverUrl: await uploadPinPhoto(f) })
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 올리지 못했어요.')
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }

  const opt = (on: boolean) => `flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-[11px] font-semibold transition ${on ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border) hover:bg-black/[0.03]'}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          variant === 'float'
            ? 'tm-float flex h-10 items-center gap-1.5 rounded-full bg-(--c-surface) px-4 text-[13px] font-semibold'
            : 'flex h-9 items-center gap-1.5 rounded-full border border-(--c-border) px-3 text-[13px] font-semibold'
        }
      >
        <span aria-hidden>🎨</span> 꾸미기
      </button>

      {open && (
        <div
          className={`tm-float tm-scroll absolute z-40 mt-2 max-h-[min(70dvh,640px)] w-[340px] max-w-[calc(100vw-32px)] space-y-4 overflow-y-auto rounded-2xl border border-(--c-border) bg-(--c-surface) p-4 ${variant === 'float' ? 'right-0' : 'left-0'}`}
          role="dialog"
          aria-label="지도 꾸미기"
        >
          <div>
            <p className="mb-2 text-xs font-semibold text-(--c-muted)">대표색 (좋아하는 색 하나를 고르면 핀 색도 맞춰져요)</p>
            <ThemePicker value={theme} onChange={onTheme} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-(--c-muted)">마커 모양</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SHAPES.map((s) => (
                <button key={s.id} type="button" onClick={() => onChange({ markerShape: s.id })} className={opt(look.markerShape === s.id)} aria-pressed={look.markerShape === s.id}>
                  <ShapePreview shape={s.id} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-(--c-muted)">코스 선</p>
            <div className="grid grid-cols-4 gap-1.5">
              {LINES.map((l) => (
                <button key={l.id} type="button" onClick={() => onChange({ lineStyle: l.id })} className={opt(look.lineStyle === l.id)} aria-pressed={look.lineStyle === l.id}>
                  <svg width="44" height="14" aria-hidden>
                    {l.id === 'auto' ? (
                      <>
                        <line x1="3" y1="7" x2="18" y2="7" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 5" />
                        <line x1="24" y1="7" x2="41" y2="7" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" />
                      </>
                    ) : (
                      <line x1="3" y1="7" x2="41" y2="7" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={l.dash} />
                    )}
                  </svg>
                  {l.name}
                </button>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {WIDTHS.map((w) => (
                <button key={w.id} type="button" onClick={() => onChange({ lineWidth: w.id })} className={opt(look.lineWidth === w.id)} aria-pressed={look.lineWidth === w.id}>
                  <svg width="44" height="10" aria-hidden>
                    <line x1="4" y1="5" x2="40" y2="5" stroke="currentColor" strokeWidth={w.px} strokeLinecap="round" />
                  </svg>
                  {w.name}
                </button>
              ))}
            </div>
            {look.lineStyle !== 'auto' && <p className="mt-1.5 text-[11px] text-(--c-muted)">버스·지하철 노선 구간은 노선 모양 그대로예요.</p>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-(--c-muted)">커버 이미지</p>
            {coverUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL/스토리지 URL */}
                <img src={coverUrl} alt="커버 이미지" className="h-24 w-full rounded-xl object-cover" />
                <button type="button" onClick={() => onChange({ coverUrl: null })} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label="커버 이미지 빼기">
                  <CloseIcon size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => file.current?.click()}
                disabled={uploading}
                className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-(--c-border) text-xs font-semibold text-(--c-muted) hover:bg-black/[0.03] disabled:opacity-60"
              >
                <ImageIcon size={20} />
                {uploading ? '올리는 중…' : '사진 고르기 (카드 · 공개 지도 위에 보여요)'}
              </button>
            )}
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onCover(e.target.files?.[0])} />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-(--c-muted)">카테고리 (둘러보기에서 이 칸으로 보여요)</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="지도 카테고리">
              {MAP_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={category === c.id}
                  onClick={() => onChange({ category: c.id })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${category === c.id ? 'border-(--c-ink) bg-(--c-ink) text-(--c-bg)' : 'border-(--c-border) text-(--c-muted) hover:text-(--c-text)'}`}
                >
                  {c.id === 'etc' ? '✏️ 직접 적기' : `${c.emoji} ${c.label}`}
                </button>
              ))}
            </div>
            {category === 'etc' && (
              <input
                value={categoryLabel ?? ''}
                onChange={(e) => onChange({ categoryLabel: e.target.value || null })}
                placeholder="카테고리 이름 (예: 야경 맛집, 비 오는 날)"
                maxLength={20}
                className="mt-2 h-10 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-3 text-sm outline-none focus:border-(--c-accent)"
                aria-label="카테고리 직접 적기"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ShapePreview({ shape }: { shape: MarkerShape }) {
  const base = 'grid size-7 place-items-center text-sm border-2 border-white shadow-sm'
  if (shape === 'emoji') return <span className="grid size-7 place-items-center text-xl">☕</span>
  if (shape === 'pin')
    return (
      <span className={`${base} rounded-[9999px_9999px_9999px_3px] -rotate-45 bg-(--c-accent)`}>
        <span className="rotate-45">☕</span>
      </span>
    )
  return <span className={`${base} bg-(--c-accent) ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}>☕</span>
}
