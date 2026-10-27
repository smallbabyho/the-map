'use client'

import { useEffect, useRef, useState } from 'react'

// Cloudflare Turnstile 캡차.
// NEXT_PUBLIC_TURNSTILE_SITE_KEY 가 있으면 진짜 위젯, 없으면 개발용 체크박스로 대신한다.

const SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface Turnstile {
  render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void; 'error-callback'?: () => void; language?: string }): string
  reset(id?: string): void
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('캡차를 불러오지 못했어요.'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface Props {
  /** 캡차를 통과하면 토큰, 만료·실패하면 빈 문자열 */
  onVerify: (token: string) => void
  /** 값이 바뀌면 캡차를 다시 풀게 한다 (로그인 실패 후 등) */
  resetKey?: number
}

/**
 * 로그인·회원가입 폼에 넣는 캡차.
 *
 * @example
 * const [token, setToken] = useState('')
 * <CaptchaWidget onVerify={setToken} />
 * await signIn(email, password, token)
 */
export function CaptchaWidget({ onVerify, resetKey = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onVerify)
  const [error, setError] = useState('')
  useEffect(() => {
    cb.current = onVerify
  })

  useEffect(() => {
    if (!SITE_KEY) return
    let id: string | null = null
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        id = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          language: 'ko',
          callback: (t) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        })
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
      if (id && window.turnstile) window.turnstile.remove(id)
      cb.current('')
    }
  }, [resetKey])

  if (SITE_KEY) {
    return (
      <div>
        <div ref={ref} className="min-h-[65px]" />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // 개발용 (Turnstile 키 없음). resetKey 가 바뀌면 새로 그려서 체크가 풀린다.
  return <MockCaptcha key={resetKey} onVerify={onVerify} />
}

function MockCaptcha({ onVerify }: { onVerify: (token: string) => void }) {
  const [checked, setChecked] = useState(false)
  return (
    <label className="flex h-[65px] cursor-pointer items-center gap-3 rounded-xl border border-(--c-border) bg-(--c-surface) px-4 text-sm select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked)
          onVerify(e.target.checked ? 'mock-captcha-token' : '')
        }}
        className="size-5 accent-(--c-accent)"
      />
      <span className="flex-1">로봇이 아닙니다</span>
      <span className="text-[0.625rem] leading-tight text-(--c-muted)">개발용 캡차<br />(Turnstile 키 없음)</span>
    </label>
  )
}
