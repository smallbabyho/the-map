'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../icons'
import { drawStoryCard, STORY_H, STORY_W, type StoryCardData } from './storyCard'

/**
 * '이미지 카드' 버튼 → 인스타 스토리 크기(1080×1920) 미리보기 → 저장 / 공유.
 * 휴대폰은 공유 창으로 인스타·카톡에 바로, 컴퓨터는 PNG 내려받기.
 */
export function StoryCardButton({ data, className = '' }: { data: StoryCardData; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={data.pins.length === 0}
        title={data.pins.length === 0 ? '장소를 추가하면 만들 수 있어요' : '인스타 스토리 크기 이미지로 저장'}
        className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-(--c-border) text-sm font-bold transition hover:bg-black/[0.03] disabled:opacity-40 ${className}`}
      >
        <span aria-hidden>📸</span> 이미지 카드로 저장
      </button>
      {open && <StoryCardDialog data={data} onClose={() => setOpen(false)} />}
    </>
  )
}

function StoryCardDialog({ data, onClose }: { data: StoryCardData; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const c = canvas.current!
    drawStoryCard(c, data)
      .then(() => c.toBlob((b) => !cancelled && setBlob(b), 'image/png'))
      .catch(() => !cancelled && setError('이미지를 만들지 못했어요.'))
    return () => {
      cancelled = true
    }
    // 열 때 한 번만 그린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileName = `${(data.map.title || 'My Concept Map').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)}.png`
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })

  const download = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: data.map.title })
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') download()
    }
  }

  // 팝업은 항상 맨 위: 페이지 안 다른 요소(지도 등)의 겹침 순서에 갇히지 않게 body 에 바로 그린다
  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal aria-label="이미지 카드">
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex w-full items-center justify-between text-white">
          <p className="text-sm font-semibold">스토리 이미지 카드 · {STORY_W}×{STORY_H}</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="relative w-full overflow-hidden rounded-2xl bg-white/10" style={{ aspectRatio: `${STORY_W} / ${STORY_H}`, maxHeight: '70dvh' }}>
          <canvas ref={canvas} className="size-full object-contain" />
          {!blob && !error && <div className="absolute inset-0 grid place-items-center text-sm text-white/80">만드는 중…</div>}
          {error && <div className="absolute inset-0 grid place-items-center text-sm text-red-200">{error}</div>}
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <button type="button" onClick={download} disabled={!blob} className="h-12 rounded-xl bg-white text-[0.9375rem] font-bold text-gray-900 disabled:opacity-50">
            저장하기
          </button>
          <button
            type="button"
            onClick={canShare ? share : download}
            disabled={!blob}
            className="h-12 rounded-xl text-[0.9375rem] font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)' }}
          >
            {canShare ? '인스타·카톡 공유' : 'PNG 내려받기'}
          </button>
        </div>
        <p className="text-center text-xs text-white/70">길찾기를 받아 둔 구간은 실제 길 모양으로 그려져요.</p>
      </div>
    </div>,
    document.body,
  )
}
