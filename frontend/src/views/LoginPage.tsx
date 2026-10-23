'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { AppRail } from '../components/AppRail'
import { ChevronLeftIcon } from '../components/icons'

type Mode = 'signin' | 'signup'

/**
 * 로그인 / 회원가입 화면 (UI 만).
 * TODO(백엔드 연결): src/auth 의 signIn / signUp 과 <CaptchaWidget onVerify /> 를 아래 표시한 자리에 연결한다.
 */
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    // TODO(백엔드 연결):
    //   mode === 'signin' → await signIn(email, password, captchaToken)
    //   mode === 'signup' → await signUp(email, password, nickname, captchaToken)
    //   에러 메시지(한국어)는 아래 error 영역에 보여주고, 성공하면 router.push('/')
  }

  const field =
    'h-12 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-4 text-[15px] outline-none transition placeholder:text-(--c-muted)/70 focus:border-(--c-accent) focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--c-accent)_15%,transparent)]'

  return (
    <div className="relative min-h-dvh md:pl-[72px]">
      <AppRail active="login" />

      <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
        {/* 왼쪽 그림 (큰 화면에서만) */}
        <aside
          className="relative hidden overflow-hidden lg:block"
          style={{
            backgroundColor: '#fff4ec',
            backgroundImage:
              'linear-gradient(#fde3d0 1px, transparent 1px), linear-gradient(90deg, #fde3d0 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        >
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline points="18,70 36,48 58,58 78,30" fill="none" stroke="#f97316" strokeWidth={3} strokeOpacity={0.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="10 8" />
          </svg>
          {[
            { x: 18, y: 70, e: '☕', c: '#f97316', n: '카페 투어' },
            { x: 36, y: 48, e: '🍞', c: '#ef4444', n: '빵지순례' },
            { x: 58, y: 58, e: '🎬', c: '#3b82f6', n: '드라마 촬영지' },
            { x: 78, y: 30, e: '📸', c: '#a855f7', n: '사진 맛집' },
          ].map((p, i) => (
            <div key={p.n} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <span className="tm-marker" data-selected={i === 3} style={{ ['--pin' as string]: p.c }}>
                <span className="tm-marker-head" />
                <span className="tm-marker-emoji">{p.e}</span>
                <span className="tm-marker-no">{i + 1}</span>
                <span className="tm-marker-label">{p.n}</span>
              </span>
            </div>
          ))}
          <div className="absolute bottom-12 left-12 right-12">
            <p className="text-sm font-semibold text-orange-600">컨셉지도</p>
            <h2 className="mt-2 text-3xl font-bold leading-snug tracking-tight text-gray-900">
              나만의 테마로
              <br />
              지도를 꾸미고, 함께 걸어요
            </h2>
          </div>
        </aside>

        {/* 폼 */}
        <main className="flex flex-col px-5 py-6 sm:px-10">
          <Link href="/" className="inline-flex w-fit items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-(--c-muted) hover:text-(--c-text)">
            <ChevronLeftIcon size={16} />내 지도
          </Link>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <div className="mb-8 flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-(--c-accent) text-lg shadow-sm">📍</span>
              <span className="text-xl font-bold">컨셉지도</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight">{mode === 'signin' ? '다시 만나서 반가워요' : '컨셉지도 시작하기'}</h1>
            <p className="mt-1.5 text-sm text-(--c-muted)">
              {mode === 'signin' ? '로그인하고 내 지도를 이어서 꾸며 보세요.' : '이메일로 가입하고 첫 지도를 만들어 보세요.'}
            </p>

            <div className="mt-7 grid grid-cols-2 rounded-xl bg-black/[0.04] p-1" role="tablist">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${mode === m ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
                >
                  {m === 'signin' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              {mode === 'signup' && (
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" maxLength={30} autoComplete="nickname" className={field} aria-label="닉네임" />
              )}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" autoComplete="email" className={field} aria-label="이메일" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? '비밀번호 (6자 이상)' : '비밀번호'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className={field}
                aria-label="비밀번호"
              />

              {/* TODO(백엔드 연결): <CaptchaWidget onVerify={setCaptchaToken} /> 로 교체 */}
              <div className="grid h-[65px] place-items-center rounded-xl border border-dashed border-(--c-border) text-xs text-(--c-muted)">
                캡차 영역 (Cloudflare Turnstile 연결 예정)
              </div>

              {/* TODO(백엔드 연결): 에러 메시지 표시 영역 */}

              <button type="submit" className="mt-2 h-12 w-full rounded-xl bg-(--c-text) text-[15px] font-bold text-(--c-surface) transition hover:opacity-90">
                {mode === 'signin' ? '로그인' : '가입하기'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-(--c-muted)">
              {mode === 'signin' ? '아직 계정이 없나요? ' : '이미 계정이 있나요? '}
              <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="font-semibold text-(--c-accent) hover:underline">
                {mode === 'signin' ? '회원가입' : '로그인'}
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
