'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { completeSocialSignIn } from '../auth'
import { markJustLoggedIn } from '../components/messenger/Messenger'

/** 소셜 로그인에서 돌아오면 세션을 마무리하고 원래 가려던 곳(?next=)으로 보낸다 */
export function AuthCallbackPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const [error, setError] = useState('')
  // 개발 모드에서 effect 가 두 번 돌아도 일회용 토큰은 한 번만 쓴다
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    completeSocialSignIn(new URL(window.location.href))
      .then(() => {
        markJustLoggedIn()
        router.replace(next)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '로그인하지 못했어요.'))
  }, [next, router])

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      {error ? (
        <div className="w-full max-w-sm text-center">
          <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="tm-btn mt-4 grid h-12 place-items-center rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text)">
            로그인 화면으로
          </Link>
        </div>
      ) : (
        <p className="text-sm text-(--c-muted)" aria-live="polite">
          로그인하는 중이에요…
        </p>
      )}
    </main>
  )
}

/** 외부 주소로 튀지 않게 내부 경로만 허용 */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}
