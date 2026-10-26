'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

// 사진 자르기 창 (프로필 사진 · 배너): 끌어서 옮기고, 슬라이더 · 휠로 확대. [적용]하면 고른 부분만 잘라 새 파일로 돌려준다.
// 사진이 틀을 항상 꽉 채우게(빈칸 없이) 옮기는 범위를 막는다.

interface Props {
  file: File
  /** 가로 ÷ 세로 (프로필 사진 1, 배너 3) */
  aspect: number
  /** 잘라 낸 결과 크기(px, 가로) */
  outWidth: number
  /** 동그랗게 미리보기 (프로필 사진) */
  round?: boolean
  title: string
  onCancel: () => void
  onDone: (file: File) => void
}

const MAX_ZOOM = 4

export function ImageCropDialog({ file, aspect, outWidth, round = false, title, onCancel, onDone }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [box] = useState(() => {
    const w = Math.min(520, (typeof window === 'undefined' ? 520 : window.innerWidth) - 48)
    return { w, h: Math.round(w / aspect) }
  })
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // 사진 왼쪽 위가 틀 왼쪽 위에서 얼마나 (px, 0 이하)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)

  // 미리보기: 파일을 직접 읽는다 (임시 주소를 만들고 지우는 방식은 화면이 다시 붙을 때 먼저 지워질 수 있어서)
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setUrl(reader.result as string)
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  // 틀을 꽉 채우는 기본 배율
  const base = img ? Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) : 1
  const dispW = img ? img.naturalWidth * base * zoom : box.w
  const dispH = img ? img.naturalHeight * base * zoom : box.h
  const clamp = (x: number, y: number, w = dispW, h = dispH) => ({ x: Math.min(0, Math.max(box.w - w, x)), y: Math.min(0, Math.max(box.h - h, y)) })

  const onLoad = (el: HTMLImageElement) => {
    setImg(el)
    const b = Math.max(box.w / el.naturalWidth, box.h / el.naturalHeight)
    setPos({ x: (box.w - el.naturalWidth * b) / 2, y: (box.h - el.naturalHeight * b) / 2 })
  }

  /** 확대해도 틀 가운데가 보던 곳 그대로 */
  const setZoomKeep = (z: number) => {
    if (!img) return
    const next = Math.min(MAX_ZOOM, Math.max(1, z))
    const cx = (box.w / 2 - pos.x) / (base * zoom)
    const cy = (box.h / 2 - pos.y) / (base * zoom)
    const w = img.naturalWidth * base * next
    const h = img.naturalHeight * base * next
    setZoom(next)
    setPos(clamp(box.w / 2 - cx * base * next, box.h / 2 - cy * base * next, w, h))
  }

  const onDown = (e: ReactPointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (d) setPos(clamp(d.x + e.clientX - d.px, d.y + e.clientY - d.py))
  }
  const onUp = () => {
    drag.current = null
  }

  const apply = async () => {
    if (!img) return
    setBusy(true)
    const scale = base * zoom
    const canvas = document.createElement('canvas')
    canvas.width = outWidth
    canvas.height = Math.round(outWidth / aspect)
    canvas.getContext('2d')!.drawImage(img, -pos.x / scale, -pos.y / scale, box.w / scale, box.h / scale, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    setBusy(false)
    if (blob) onDone(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={title}>
      <div className="w-fit rounded-3xl bg-(--c-surface) p-4 text-(--c-text)">
        <p className="mb-3 text-center font-bold">{title}</p>
        <div
          className="relative cursor-grab touch-none select-none overflow-hidden rounded-xl bg-black/80 active:cursor-grabbing"
          style={{ width: box.w, height: box.h }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setZoomKeep(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 고른 파일 미리보기 */}
          {url && <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => onLoad(e.currentTarget)}
            className="pointer-events-none absolute left-0 top-0 max-w-none"
            style={{ width: dispW, height: dispH, transform: `translate(${pos.x}px, ${pos.y}px)` }}
          />}
          {/* 동그라미 미리보기: 바깥을 어둡게 */}
          {round && <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]" />}
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/30" />
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <span aria-hidden>➖</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoomKeep(+e.target.value)} className="flex-1 accent-(--c-accent)" aria-label="확대" />
          <span aria-hidden>➕</span>
        </label>
        <p className="mt-1 text-center text-xs text-(--c-muted)">끌어서 옮기고, 슬라이더나 휠로 확대해요.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-full border border-(--c-border) px-4 text-sm font-semibold">
            취소
          </button>
          <button type="button" onClick={apply} disabled={!img || busy} className="tm-btn h-10 rounded-full bg-(--c-accent) px-5 text-sm font-bold text-(--c-accent-text) disabled:opacity-60">
            {busy ? '자르는 중…' : '적용'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
