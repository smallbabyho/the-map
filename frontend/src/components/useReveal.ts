'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * 안쪽의 .tm-reveal 요소가 화면에 들어오면 data-shown="true" 를 붙인다 (app/globals.css 의 .tm-reveal 이 툭 나타나게).
 * 한 번 나타나면 다시 숨기지 않는다. 지연은 style={{ '--delay': '0.1s' }} 로.
 *
 * @example
 * const ref = useReveal<HTMLDivElement>()
 * return <div ref={ref}><h2 className="tm-reveal">…</h2></div>
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    // 이제부터 화면 밖 .tm-reveal 을 숨겨도 된다 (globals.css)
    document.documentElement.dataset.reveal = 'on'
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.shown = 'true'
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    const watch = () => root.querySelectorAll<HTMLElement>('.tm-reveal:not([data-shown="true"])').forEach((el) => io.observe(el))
    watch()
    // 데이터를 늦게 받아 나중에 붙는 요소(예: 인기 지도 목록)도 감시한다
    const mo = new MutationObserver(watch)
    mo.observe(root, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
  return ref
}

/**
 * 긴 구역 안에서 얼마나 스크롤했는지 (0~1). sticky 로 붙인 그림을 단계별로 바꿀 때 쓴다.
 *
 * @example
 * const [ref, progress] = useScrollProgress<HTMLElement>()
 * const step = Math.min(3, Math.floor(progress * 4))
 */
export function useScrollProgress<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      setProgress(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return [ref, progress]
}
