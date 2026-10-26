'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 처음 온 사람에게 화면의 실제 버튼을 하나씩 짚어 주는 짧은 안내.
// 짚을 요소에는 data-tour="이름" 을 붙인다. 같은 이름이 여러 개(데스크톱 · 모바일 메뉴)면 지금 보이는 것을 짚는다.
// 다 보거나 건너뛰면 이 브라우저에 기억해서 같은 사람에게 다시 뜨지 않는다.

export interface TourStep {
  /** 짚을 요소의 data-tour 값. 없거나 화면에 안 보이면 가운데에 띄운다 */
  target?: string
  title: string
  body: string
}

interface Props {
  /** 안내 이름 ('home', 'editor' …). 사람마다 안내마다 한 번씩 */
  id: string
  userId: string | undefined
  steps: TourStep[]
}

const PAD = 8 // 짚은 요소 둘레 여백
const GUTTER = 16 // 말풍선이 화면 가장자리에서 떨어지는 거리
const BUBBLE_W = 300
const BUBBLE_H = 170 // 말풍선 높이 어림값 (자리 고를 때만 씀)

const seenKey = (id: string, userId: string) => `the-map:tour:${id}:${userId}`

function wasSeen(id: string, userId: string) {
  try {
    return localStorage.getItem(seenKey(id, userId)) === '1'
  } catch {
    return true // 저장소를 못 쓰면 매번 뜨지 않게 그냥 넘어간다
  }
}

function markSeen(id: string, userId: string) {
  try {
    localStorage.setItem(seenKey(id, userId), '1')
  } catch {
    // 저장 못 해도 이번엔 닫힌다
  }
}

/** data-tour 이름으로 지금 화면에 보이는 요소 찾기 */
function findTarget(name: string | undefined): HTMLElement | null {
  if (!name) return null
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/**
 * 처음 한 번만 뜨는 기능 안내.
 *
 * @example
 * <Tour id="home" userId={user?.id} steps={[{ target: 'new-map', title: '새 지도', body: '…' }]} />
 */
export function Tour({ id, userId, steps }: Props) {
  const [index, setIndex] = useState<number | null>(null) // null = 안 보임
  const [rect, setRect] = useState<DOMRect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  // 화면이 다 그려진 뒤에 띄운다 (짚을 버튼이 늦게 나타날 수 있어서)
  useEffect(() => {
    if (!userId || wasSeen(id, userId)) return
    const t = window.setTimeout(() => setIndex(0), 700)
    return () => window.clearTimeout(t)
  }, [id, userId])

  const step = index === null ? null : steps[index]

  // 짚은 요소를 화면 안으로 데려오고, 스크롤 · 크기 변화를 따라간다
  useEffect(() => {
    if (!step) return
    findTarget(step.target)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    let raf = 0
    let last = ''
    const follow = () => {
      const r = findTarget(step.target)?.getBoundingClientRect() ?? null
      const key = r ? `${r.x},${r.y},${r.width},${r.height}` : ''
      if (key !== last) {
        last = key
        setRect(r)
      }
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    nextRef.current?.focus()
    return () => cancelAnimationFrame(raf)
  }, [step])

  const close = useCallback(() => {
    if (userId) markSeen(id, userId)
    setIndex(null)
  }, [id, userId])

  const next = useCallback(() => {
    if (index === null) return
    if (index >= steps.length - 1) close()
    else setIndex(index + 1)
  }, [index, steps.length, close])

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setIndex((i) => (i ? i - 1 : i))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, close, next])

  if (!step || index === null) return null

  const last = index === steps.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(BUBBLE_W, vw - GUTTER * 2)

  // 말풍선 자리: 짚은 요소 아래에 자리가 있으면 아래, 아니면 위.
  // 짚은 요소가 커서 위아래 다 자리가 없으면 화면 아래에 붙인다 (말풍선이 화면 밖으로 나가 '다음'을 못 누르는 일이 없게)
  let bubble: React.CSSProperties = { left: (vw - width) / 2, top: vh / 2, transform: 'translateY(-50%)' }
  let arrowLeft: number | null = null
  let below = true
  if (rect) {
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, GUTTER), vw - width - GUTTER)
    const need = BUBBLE_H + PAD + 12
    if (vh - rect.bottom >= need) {
      bubble = { left, top: rect.bottom + PAD + 12 }
      arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - left, 20), width - 20)
    } else if (rect.top >= need) {
      below = false
      bubble = { left, bottom: vh - rect.top + PAD + 12 }
      arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - left, 20), width - 20)
    } else {
      bubble = { left, bottom: GUTTER }
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={`기능 안내 ${index + 1}/${steps.length}`}>
      {/* 어둡게 + 짚은 곳만 밝게 (뒤 화면은 안내 중 누를 수 없다) */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-white/80 transition-all duration-300"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}

      <div key={index} className="tm-intro fixed rounded-2xl bg-(--c-surface) p-4 text-(--c-text) shadow-2xl" style={{ ...bubble, width }}>
        {arrowLeft !== null && (
          <span
            className={`absolute size-3 rotate-45 bg-(--c-surface) ${below ? '-top-1.5' : '-bottom-1.5'}`}
            style={{ left: arrowLeft - 6 }}
            aria-hidden
          />
        )}
        <p className="font-mono text-[11px] font-bold text-(--c-accent)">
          {index + 1} / {steps.length}
        </p>
        <h2 className="mt-1 text-[15px] font-bold">{step.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-(--c-muted)">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          {last ? (
            <span />
          ) : (
            <button type="button" onClick={close} className="text-xs font-semibold text-(--c-muted) hover:text-(--c-text)">
              건너뛰기
            </button>
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="h-8 rounded-full px-3 text-xs font-semibold text-(--c-muted) hover:bg-black/5">
                이전
              </button>
            )}
            <button ref={nextRef} type="button" onClick={next} className="h-8 rounded-full bg-(--c-accent) px-4 text-xs font-bold text-(--c-accent-text)">
              {last ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
