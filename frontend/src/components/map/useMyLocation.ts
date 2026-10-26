'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface MyPosition {
  lat: number
  lng: number
  /** 오차 반경(m) */
  accuracy: number
}

const ERROR_MESSAGES: Record<number, string> = {
  1: '위치 권한이 꺼져 있어요. 주소창 왼쪽 아이콘에서 위치를 허용해 주세요.',
  2: '현재 위치를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.',
  3: '위치를 찾는 데 시간이 너무 오래 걸려요. 다시 시도해 주세요.',
}

/**
 * 브라우저 위치(Geolocation).
 * locate() 를 처음 누르면 권한을 묻고, 이후로는 움직일 때마다 pos 가 갱신된다.
 * 첫 위치를 받으면 onFix 를 한 번 부른다 (지도 이동용).
 */
export function useMyLocation() {
  const [pos, setPos] = useState<MyPosition | null>(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const watchId = useRef<number | null>(null)
  const pendingFix = useRef<((p: MyPosition) => void) | null>(null)

  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(''), 4000)
    return () => window.clearTimeout(t)
  }, [error])

  useEffect(
    () => () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    },
    [],
  )

  const locate = useCallback(
    (onFix: (p: MyPosition) => void) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setError('이 브라우저에서는 위치 기능을 쓸 수 없어요.')
        return
      }
      if (!window.isSecureContext) {
        setError('위치 기능은 https 또는 localhost 에서만 쓸 수 있어요.')
        return
      }
      // 이미 위치를 알고 있으면 바로 이동
      if (pos && watchId.current != null) {
        onFix(pos)
        return
      }
      setLocating(true)
      setError('')
      pendingFix.current = onFix
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = navigator.geolocation.watchPosition(
        (p) => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
          setPos(next)
          setLocating(false)
          pendingFix.current?.(next)
          pendingFix.current = null
        },
        (e) => {
          setLocating(false)
          pendingFix.current = null
          setError(ERROR_MESSAGES[e.code] ?? '현재 위치를 가져오지 못했어요.')
          if (e.code === 1 && watchId.current != null) {
            navigator.geolocation.clearWatch(watchId.current)
            watchId.current = null
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      )
    },
    [pos],
  )

  return { pos, locating, error, locate }
}
