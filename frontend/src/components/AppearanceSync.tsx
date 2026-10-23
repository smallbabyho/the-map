'use client'

import { useEffect } from 'react'
import { syncAppearance } from './appearance'

/** 라이트/다크 자동 전환: 1분마다 · 화면으로 돌아올 때 · 다른 탭에서 설정을 바꿨을 때 다시 맞춘다. app/layout.tsx 에 한 번만 둔다. */
export function AppearanceSync() {
  useEffect(() => {
    syncAppearance()
    const timer = setInterval(syncAppearance, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && syncAppearance()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', syncAppearance)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', syncAppearance)
    }
  }, [])
  return null
}
