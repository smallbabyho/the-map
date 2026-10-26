'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * 모바일 '길게 누르기' (우클릭 대신). 손가락 하나로 550ms 누르고 거의 안 움직이면 onLongPress(x, y) 호출.
 * x, y 는 target 요소 기준 좌표(px). 지도를 끌거나 두 손가락이면 취소.
 *
 * 카카오맵이 터치 이벤트 전파를 막기 때문에 React 이벤트(onTouchStart) 대신
 * 네이티브 리스너를 캡처 단계에 붙인다.
 */
export function useLongPress(target: RefObject<HTMLElement | null>, enabled: boolean, onLongPress: (x: number, y: number) => void) {
  const cb = useRef(onLongPress)
  useEffect(() => {
    cb.current = onLongPress
  })

  useEffect(() => {
    const el = target.current
    if (!el || !enabled) return
    let state: { timer: number; sx: number; sy: number } | null = null
    const cancel = () => {
      if (state) window.clearTimeout(state.timer)
      state = null
    }
    const onStart = (e: TouchEvent) => {
      cancel()
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const rect = el.getBoundingClientRect()
      const x = t.clientX - rect.left
      const y = t.clientY - rect.top
      state = {
        sx: t.clientX,
        sy: t.clientY,
        timer: window.setTimeout(() => {
          state = null
          navigator.vibrate?.(15)
          cb.current(x, y)
        }, 550),
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!state) return
      const t = e.touches[0]
      if (e.touches.length !== 1 || Math.hypot(t.clientX - state.sx, t.clientY - state.sy) > 10) cancel()
    }
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    el.addEventListener('touchstart', onStart, opts)
    el.addEventListener('touchmove', onMove, opts)
    el.addEventListener('touchend', cancel, opts)
    el.addEventListener('touchcancel', cancel, opts)
    return () => {
      cancel()
      el.removeEventListener('touchstart', onStart, opts)
      el.removeEventListener('touchmove', onMove, opts)
      el.removeEventListener('touchend', cancel, opts)
      el.removeEventListener('touchcancel', cancel, opts)
    }
  }, [target, enabled])
}
