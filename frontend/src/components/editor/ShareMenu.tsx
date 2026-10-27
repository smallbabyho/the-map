'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ConceptMap, Pin } from '../../types'
import { ExportMapButton } from '../share/ExportMapButton'
import type { ExportData } from '../share/exportMap'
import { StoryCardButton } from '../share/StoryCardButton'
import type { StoryCardData } from '../share/storyCard'

interface Props {
  map: ConceptMap
  pins: Pin[]
  story: StoryCardData
  exportData: ExportData
  /** 저장 안 한 변경이 있으면 모임 만들기로 가기 전에 묻는다 */
  dirty: boolean
  /** 메뉴를 버튼 어느 쪽에 맞출지 (오른쪽 위 = right, 모바일 시트 안 = left) */
  align?: 'left' | 'right'
}

/**
 * 편집 화면 오른쪽 위 '공유' 메뉴: 모임 열기 · 이미지 카드 · 내보내기.
 * 이미지 카드 · 내보내기 창은 버튼 안에서 열리므로, 메뉴를 닫아도 지우지 않고 숨기기만 한다.
 */
export function ShareMenu({ map, pins, story, exportData, dirty, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const item = 'h-10! w-full! justify-start! rounded-xl! border-0! px-3 text-sm! font-semibold!'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tm-float inline-flex h-10 items-center gap-1.5 rounded-full bg-(--c-surface) px-4 text-sm font-bold"
        title="모임 열기 · 이미지 카드 · 내보내기"
      >
        <span aria-hidden>📤</span> 공유
      </button>
      <div className={`tm-float absolute top-full z-30 mt-2 w-56 ${align === 'right' ? 'right-0' : 'left-0'} rounded-2xl bg-(--c-surface) p-1.5 ${open ? '' : 'hidden'}`} onClickCapture={() => setOpen(false)}>
        <Link
          href={`/meetups/new?mapId=${map.id}`}
          onClick={(e) => {
            if (dirty && !window.confirm('저장하지 않은 변경이 있어요. 저장하지 않고 모임 만들기로 갈까요?')) e.preventDefault()
          }}
          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition hover:bg-black/[0.04]"
        >
          <span aria-hidden>🚩</span> 이 지도로 모임 열기
        </Link>
        <StoryCardButton className={item} data={story} />
        <ExportMapButton className={item} data={exportData} />
        {pins.length === 0 && <p className="px-3 pb-1.5 pt-1 text-xs text-(--c-muted)">장소를 추가하면 이미지 카드 · 내보내기를 쓸 수 있어요.</p>}
      </div>
    </div>
  )
}
