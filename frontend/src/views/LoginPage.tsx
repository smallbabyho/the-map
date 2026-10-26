'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { CaptchaWidget, DEMO_ACCOUNT, signIn, signOut, signUp, useCurrentUser } from '../auth'
import { AppearanceOptions } from '../components/AppearanceButton'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon } from '../components/icons'
import { SafetySection } from '../components/report/BlockedList'

type Mode = 'signin' | 'signup'

/** 로그인 / 회원가입. 이미 로그인했으면 '내 계정' 화면. ?next=/경로 가 있으면 로그인 후 그리로 이동. */
export function LoginPage() {
  const router = useRouter()
  /** 체험 계정 (가짜 데이터 모드에서만 있음) */
  const demo = DEMO_ACCOUNT
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const user = useCurrentUser()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!captcha) return setError('로봇이 아님을 확인해 주세요. (캡차)')
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email, password, captcha)
      else await signUp(email, password, nickname, captcha)
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.')
      setCaptchaReset((n) => n + 1) // 캡차 토큰은 한 번만 쓸 수 있어서 다시 풀게 한다
      setCaptcha('')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
  }

  const field =
    'h-12 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-4 text-[15px] outline-none transition placeholder:text-(--c-muted)/70 focus:border-(--c-accent) focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--c-accent)_15%,transparent)]'

  return (
    <div className="relative min-h-dvh pb-16 pt-14 md:pb-0">
      <AppRail active="login" />
      <MobileTabBar active="login" />

      <div className="grid min-h-[calc(100dvh-56px)] lg:grid-cols-[1.1fr_1fr]">
        <Illustration />

        <main className="flex flex-col px-5 py-6 sm:px-10">
          <Link href="/" className="inline-flex w-fit items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-(--c-muted) hover:text-(--c-text)">
            <ChevronLeftIcon size={16} />내 지도
          </Link>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <p className="tm-label dot mb-6">{user ? 'account' : 'welcome'}</p>

            {user === undefined ? (
              <div className="h-80 animate-pulse rounded-2xl bg-black/5" />
            ) : user ? (
              // 이미 로그인한 경우: 내 계정
              <div>
                <h1 className="tm-headline text-5xl">
                  내 <em>계정</em>
                </h1>
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-(--c-border) bg-(--c-surface) p-4">
                  <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{user.nickname}</p>
                    <p className="text-sm text-(--c-muted)">{user.role === 'admin' ? '관리자' : '회원'}</p>
                  </div>
                </div>
                <section className="mt-4 rounded-2xl border border-(--c-border) bg-(--c-surface) p-1.5">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold text-(--c-muted)">화면</p>
                  <AppearanceOptions />
                </section>
                <SafetySection />
                <div className="mt-4 grid gap-2">
                  <Link href={`/u/${user.id}`} className="grid h-12 place-items-center rounded-xl border border-(--c-border) text-[15px] font-semibold">
                    내 프로필 꾸미기
                  </Link>
                  <Link href={next} className="tm-btn grid h-12 place-items-center rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text)">
                    {next === '/' ? '내 지도로' : '계속하기'}
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/customers" className="grid h-12 place-items-center rounded-xl border border-(--c-border) text-[15px] font-semibold">
                      관리자 모드
                    </Link>
                  )}
                  <button type="button" onClick={async () => (await signOut(), router.push('/'))} className="h-12 rounded-xl text-[15px] font-semibold text-red-500 hover:bg-red-500/10">
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="tm-headline text-5xl">{mode === 'signin' ? <>다시 <em>만나서</em> 반가워요</> : <>지도를 <em>시작</em>해요</>}</h1>
                <p className="mt-1.5 text-sm text-(--c-muted)">
                  {next !== '/' ? '로그인이 필요한 기능이에요.' : mode === 'signin' ? '로그인하고 내 지도를 이어서 꾸며 보세요.' : '이메일로 가입하고 첫 지도를 만들어 보세요.'}
                </p>

                <div className="mt-7 grid grid-cols-2 rounded-xl bg-black/[0.04] p-1" role="tablist">
                  {(['signin', 'signup'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => switchMode(m)}
                      className={`h-10 rounded-lg text-sm font-semibold transition ${mode === m ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
                    >
                      {m === 'signin' ? '로그인' : '회원가입'}
                    </button>
                  ))}
                </div>

                <form onSubmit={onSubmit} className="mt-6 space-y-3" noValidate>
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

                  <CaptchaWidget onVerify={setCaptcha} resetKey={captchaReset} />

                  {error && (
                    <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="tm-btn mt-2 h-12 w-full rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text) disabled:opacity-60"
                  >
                    {busy ? '잠시만요…' : mode === 'signin' ? '로그인' : '가입하기'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-(--c-muted)">
                  {mode === 'signin' ? '아직 계정이 없나요? ' : '이미 계정이 있나요? '}
                  <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="font-semibold text-(--c-accent) hover:underline">
                    {mode === 'signin' ? '회원가입' : '로그인'}
                  </button>
                </p>

                {/* 체험 계정 (가짜 데이터 모드에서만) */}
                {demo && (
                <button
                  type="button"
                  onClick={() => {
                    switchMode('signin')
                    setEmail(demo.email)
                    setPassword(demo.password)
                  }}
                  className="mt-6 w-full rounded-xl border border-dashed border-(--c-border) px-4 py-3 text-left text-xs text-(--c-muted) hover:border-(--c-accent)"
                >
                  <b className="text-(--c-text)">체험 계정으로 채우기</b> · {demo.email} / {demo.password}
                  <br />
                  다른 체험 계정: bread@ · drama@ · cafe@ · admin@example.com (비밀번호 동일)
                </button>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/** 외부 주소로 튀지 않게 내부 경로만 허용 */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

function Illustration() {
  return (
    <aside
      className="relative hidden overflow-hidden border-r border-(--c-ink) bg-(--c-ink) text-(--c-bg) lg:block"
      style={{
        backgroundImage: 'linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.06) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
      }}
    >
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polyline points="18,70 36,48 58,58 78,30" fill="none" stroke="#d4ff3f" strokeWidth={3} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="10 8" />
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
        <p className="tm-label dot !text-white/60">concept map ® vol.01</p>
        <h2 className="tm-headline mt-4 text-6xl">
          나만의 테마로
          <br />
          <em className="text-(--c-lime)">지도</em>를 꾸미고,
          <br />
          함께 걸어요
        </h2>
      </div>
    </aside>
  )
}
