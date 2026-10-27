'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { CaptchaWidget, DEMO_ACCOUNT, signIn, signInWithProvider, signOut, signUp, useCurrentUser, type SocialProvider } from '../auth'
import { AppearanceOptions } from '../components/AppearanceButton'
import { SiteColorPicker } from '../components/SiteColorPicker'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon } from '../components/icons'
import { SafetySection } from '../components/report/BlockedList'
import { markJustLoggedIn } from '../components/messenger/Messenger'

type Mode = 'signin' | 'signup'

// 이메일 저장: 체크하고 로그인하면 이 브라우저에 이메일만 기억한다 (비밀번호는 저장하지 않음)
const REMEMBER_KEY = 'the-map:remember-email'
function readRemembered(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? ''
  } catch {
    return ''
  }
}
function writeRemembered(email: string | null) {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email)
    else localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // 저장 못 하면 다음에 다시 적으면 된다
  }
}
const noSubscribe = () => () => {}

/** 로그인 / 회원가입. 이미 로그인했으면 '내 계정' 화면. ?next=/경로 가 있으면 로그인 후 그리로 이동. */
export function LoginPage() {
  const router = useRouter()
  /** 체험 계정 (가짜 데이터 모드에서만 있음) */
  const demo = DEMO_ACCOUNT
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const user = useCurrentUser()

  const [mode, setMode] = useState<Mode>('signin')
  // 저장해 둔 이메일을 처음 값으로 (직접 고치기 전까지). 서버에서 그릴 땐 빈 값
  const remembered = useSyncExternalStore(noSubscribe, readRemembered, () => '')
  const [typedEmail, setEmail] = useState<string | null>(null)
  const email = typedEmail ?? remembered
  const [rememberChoice, setRemember] = useState<boolean | null>(null)
  const remember = rememberChoice ?? remembered !== ''
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null)
  // 소셜 로그인 화면에서 뒤로 오면 브라우저가 떠날 때 화면(이동하는 중…)을 그대로 되살린다 → 다시 보일 때 푼다
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setSocialBusy(null)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  /** 카카오 · 네이버 · 구글: 처음이면 가입, 아니면 로그인. 성공하면 페이지가 넘어가서 돌아오지 않는다 */
  const startSocial = async (provider: SocialProvider) => {
    if (socialBusy) return
    setError('')
    setSocialBusy(provider)
    try {
      await signInWithProvider(provider, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.')
      setSocialBusy(null)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!captcha) return setError('로봇이 아님을 확인해 주세요. (캡차)')
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email, password, captcha)
      else await signUp(email, password, nickname, captcha)
      writeRemembered(remember ? email.trim() : null)
      markJustLoggedIn()
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
    'h-12 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-4 text-[0.9375rem] outline-none transition placeholder:text-(--c-muted)/70 focus:border-(--c-accent) focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--c-accent)_15%,transparent)]'

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
                  <p className="px-3 pb-1 pt-3 text-xs font-semibold text-(--c-muted)">색 테마</p>
                  <SiteColorPicker className="px-3 pb-2" />
                </section>
                <SafetySection />
                <div className="mt-4 grid gap-2">
                  <Link href={`/u/${user.id}`} className="grid h-12 place-items-center rounded-xl border border-(--c-border) text-[0.9375rem] font-semibold">
                    내 프로필 꾸미기
                  </Link>
                  <Link href={next} className="tm-btn grid h-12 place-items-center rounded-xl bg-(--c-accent) text-[0.9375rem] font-bold text-(--c-accent-text)">
                    {next === '/' ? '내 지도로' : '계속하기'}
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/customers" className="grid h-12 place-items-center rounded-xl border border-(--c-border) text-[0.9375rem] font-semibold">
                      관리자 모드
                    </Link>
                  )}
                  <button type="button" onClick={async () => (await signOut(), router.push('/'))} className="h-12 rounded-xl text-[0.9375rem] font-semibold text-red-500 hover:bg-red-500/10">
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="tm-headline text-5xl">{mode === 'signin' ? <>다시 <em>만나서</em> 반가워요</> : <>지도를 <em>시작</em>해요</>}</h1>
                <p className="mt-1.5 text-sm text-(--c-muted)">
                  {next !== '/' ? '로그인이 필요한 기능이에요.' : mode === 'signin' ? '로그인하고 내 지도를 이어서 꾸며 보세요.' : '간편하게 가입하고 첫 지도를 만들어 보세요.'}
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

                <div className="mt-6 grid gap-2">
                  {SOCIAL.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => startSocial(s.id)}
                      disabled={!!socialBusy}
                      className={`relative flex h-12 w-full items-center justify-center rounded-xl text-[0.9375rem] font-semibold transition hover:brightness-95 disabled:opacity-60 ${s.className}`}
                    >
                      <span className="absolute left-4">{s.logo}</span>
                      {socialBusy === s.id ? '이동하는 중…' : `${s.label}로 시작하기`}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-3 text-xs text-(--c-muted)">
                  <span className="h-px flex-1 bg-(--c-border)" />
                  또는 이메일로
                  <span className="h-px flex-1 bg-(--c-border)" />
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

                  <label className="flex w-fit cursor-pointer items-center gap-2 px-1 text-sm text-(--c-muted)">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-(--c-accent)" />
                    이메일 저장
                  </label>

                  <CaptchaWidget onVerify={setCaptcha} resetKey={captchaReset} />

                  {error && (
                    <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="tm-btn mt-2 h-12 w-full rounded-xl bg-(--c-accent) text-[0.9375rem] font-bold text-(--c-accent-text) disabled:opacity-60"
                  >
                    {busy ? '잠시만요…' : mode === 'signin' ? '로그인' : '가입하기'}
                  </button>
                </form>

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

/** 소셜 로그인 버튼 (각 회사 가이드 색) */
const SOCIAL: { id: SocialProvider; label: string; className: string; logo: ReactNode }[] = [
  {
    id: 'kakao',
    label: '카카오',
    className: 'bg-[#FEE500] text-black/85',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#000" d="M12 3C6.48 3 2 6.5 2 10.82c0 2.8 1.87 5.25 4.68 6.63l-.95 3.48c-.08.3.26.55.52.37l4.15-2.75c.52.06 1.05.1 1.6.1 5.52 0 10-3.5 10-7.83S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    id: 'naver',
    label: '네이버',
    className: 'bg-[#03C75A] text-white',
    logo: (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path fill="#fff" d="M16.27 12.84 7.38 0H0v24h7.73V11.16L16.62 24H24V0h-7.73z" />
      </svg>
    ),
  },
  {
    id: 'google',
    label: 'Google',
    className: 'border border-(--c-border) bg-white text-gray-800',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.46h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.72z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78z" />
        <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
      </svg>
    ),
  },
]

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
        <p className="tm-label dot !text-white/60">my concept map ® vol.01</p>
        <h2 className="tm-headline mt-4 text-6xl">
          나만의 테마로
          <br />
          <em className="text-(--c-lime)">지도</em>를 꾸미고,
          <br />
          세상을 누벼요
        </h2>
      </div>
    </aside>
  )
}
