'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/** 꾹 누르는 시간 */
export const LONG_PRESS_MS = 550

/**
 * '꾹 누르기' (모바일 손가락 · 데스크톱 마우스 둘 다). LONG_PRESS_MS 동안 누르고 거의 안 움직이면 onLongPress(x, y).
 * x, y 는 target 요소 기준 좌표(px). 지도를 끌거나 두 손가락이면 취소.
 * 누르는 동안의 위치를 돌려준다 (차오르는 원 표시용, 안 누르면 null).
 *
 * 카카오맵이 이벤트 전파를 막기 때문에 React 이벤트 대신 네이티브 리스너를 캡처 단계에 붙인다.
 */
export function useLongPress(target: RefObject<HTMLElement | null>, enabled: boolean, onLongPress: (x: number, y: number) => void) {
  const cb = useRef(onLongPress)
  useEffect(() => {
    cb.current = onLongPress
  })
  const [pressing, setPressing] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = target.current
    if (!el || !enabled) return
    let state: { timer: number; sx: number; sy: number } | null = null
    const cancel = () => {
      if (state) window.clearTimeout(state.timer)
      state = null
      setPressing(null)
    }
    const begin = (clientX: number, clientY: number) => {
      cancel()
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      state = {
        sx: clientX,
        sy: clientY,
        timer: window.setTimeout(() => {
          state = null
          setPressing(null)
          navigator.vibrate?.(15)
          cb.current(x, y)
        }, LONG_PRESS_MS),
      }
      setPressing({ x, y })
    }
    const moved = (clientX: number, clientY: number, slop: number) => state && Math.hypot(clientX - state.sx, clientY - state.sy) > slop && cancel()

    // 손가락
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return cancel()
      begin(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return cancel()
      moved(e.touches[0].clientX, e.touches[0].clientY, 10)
    }
    // 마우스 (왼쪽 버튼). 터치 뒤에 따라오는 가짜 마우스 이벤트는 무시
    let lastTouch = 0
    const markTouch = () => (lastTouch = Date.now())
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || Date.now() - lastTouch < 800) return
      begin(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => moved(e.clientX, e.clientY, 6)

    const opts: AddEventListenerOptions = { capture: true, passive: true }
    el.addEventListener('touchstart', markTouch, opts)
    el.addEventListener('touchstart', onTouchStart, opts)
    el.addEventListener('touchmove', onTouchMove, opts)
    el.addEventListener('touchend', cancel, opts)
    el.addEventListener('touchcancel', cancel, opts)
    el.addEventListener('mousedown', onMouseDown, opts)
    el.addEventListener('mousemove', onMouseMove, opts)
    el.addEventListener('mouseup', cancel, opts)
    el.addEventListener('mouseleave', cancel, opts)
    el.addEventListener('wheel', cancel, opts)
    return () => {
      cancel()
      el.removeEventListener('touchstart', markTouch, opts)
      el.removeEventListener('touchstart', onTouchStart, opts)
      el.removeEventListener('touchmove', onTouchMove, opts)
      el.removeEventListener('touchend', cancel, opts)
      el.removeEventListener('touchcancel', cancel, opts)
      el.removeEventListener('mousedown', onMouseDown, opts)
      el.removeEventListener('mousemove', onMouseMove, opts)
      el.removeEventListener('mouseup', cancel, opts)
      el.removeEventListener('mouseleave', cancel, opts)
      el.removeEventListener('wheel', cancel, opts)
    }
  }, [target, enabled])

  return pressing
}

/** 꾹 누르는 동안 손가락 · 마우스 자리에 차오르는 원 (다 차면 장소 고르기가 뜬다) */
export function PressRing({ at }: { at: { x: number; y: number } | null }) {
  if (!at) return null
  return (
    <span className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: at.x, top: at.y }} aria-hidden>
      <span className="tm-press-ring block size-14 rounded-full border-[3px] border-(--c-accent)" style={{ animationDuration: `${LONG_PRESS_MS}ms` }} />
    </span>
  )
}
