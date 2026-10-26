'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser } from '../db/api'
import type { User } from '../types'
import { onAuthChange } from './impl'

/**
 * 로그인한 사용자 (상태가 바뀌면 자동 갱신).
 * undefined = 아직 확인 중, null = 로그인 안 함.
 *
 * @example
 * const user = useCurrentUser()
 * if (user === undefined) return <Loading />
 * if (!user) return <LoginPrompt />
 */
export function useCurrentUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getCurrentUser().then((u) => !cancelled && setUser(u))
    const off = onAuthChange((u) => setUser(u))
    return () => {
      cancelled = true
      off()
    }
  }, [])
  return user
}
