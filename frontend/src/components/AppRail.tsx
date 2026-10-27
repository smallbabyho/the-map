'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useCurrentUser } from '../auth'
import type { User } from '../types'
import { setAppearancePref, useAppearance, type AppearancePref } from './appearance'
import { Avatar } from './Avatar'
import { SiteColorPicker } from './SiteColorPicker'
import { AutoModeIcon, MapIcon, MoonIcon, SearchIcon, ShieldIcon, SunIcon, TrophyIcon, UserIcon, UsersIcon } from './icons'
import { BUG_SUBJECT, ReportDialog } from './report/ReportDialog'

export type NavKey = 'maps' | 'meetups' | 'explore' | 'ranking' | 'admin' | 'login' | 'profile' | 'about'

interface NavItem {
  key: NavKey
  href: string
  label: string
  icon: ReactNode
}

function navItems(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { key: 'maps', href: '/', label: '내 지도', icon: <MapIcon size={20} /> },
    { key: 'meetups', href: '/meetups', label: '성지순례', icon: <UsersIcon size={20} /> },
    { key: 'explore', href: '/explore', label: '둘러보기', icon: <TrophyIcon size={20} /> },
  ]
  if (isAdmin) items.push({ key: 'admin', href: '/customers', label: '관리자', icon: <ShieldIcon size={20} /> })
  return items
}

/** 헤더 높이(px). 목록형 화면은 이만큼 위를 비운다 (pt-14) */
export const HEADER_H = 56

/** 로고: 핀 + My Concept Map® */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/about" className={`flex min-w-0 items-center gap-1.5 min-[360px]:gap-2 ${className}`} aria-label="My Concept Map 소개">
      <span className="grid size-8 place-items-center rounded-full bg-(--c-ink) text-[0.9375rem] text-(--c-bg)" aria-hidden>
        📍
      </span>
      {/* 고전 세리프 (Playfair Display 900): 오래된 지도책 표지 느낌 */}
      <span className="whitespace-nowrap text-[0.9375rem] italic min-[360px]:text-[1.0625rem] min-[380px]:text-[1.25rem] sm:text-[1.5rem] leading-none tracking-[-0.01em]" style={{ fontFamily: '"Playfair Display", "Noto Serif KR", serif', fontWeight: 900 }}>
        My <span className="text-(--c-accent)">Concept</span> Map
        <sup className="ml-0.5 align-super font-mono text-[0.625rem] font-bold">®</sup>
      </span>
    </Link>
  )
}

/**
 * 맨 위 가로 헤더 (모든 목록형 화면). 왼쪽 로고 · 메뉴, 오른쪽 내 프로필 + ☰ 메뉴(설정 · 문제 제보 · 로그아웃).
 * 현재 메뉴는 props 로 받는다 (usePathname 은 cacheComponents 에서 동적 라우트 빌드를 막을 수 있어서).
 */
export function AppRail({ active }: { active?: NavKey }) {
  const user = useCurrentUser()
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-(--c-border) bg-(--c-bg)/85 backdrop-blur-md" style={{ height: HEADER_H }}>
      <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 md:gap-6 md:px-10">
        <Wordmark />
        <nav className="hidden items-center gap-1 md:flex" aria-label="메뉴">
          {navItems(user?.role === 'admin').map((it) => (
            <Link
              key={it.key}
              href={it.href}
              data-tour={`nav-${it.key}`}
              aria-current={active === it.key ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${active === it.key ? 'bg-(--c-ink) text-(--c-bg)' : 'text-(--c-muted) hover:text-(--c-text)'}`}
            >
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <HeaderActions user={user} active={active} />
        </div>
      </div>
    </header>
  )
}

/**
 * 오른쪽 위 묶음: 내 프로필(사진 · 이름) + ☰ 메뉴. 지도 화면은 이것만 떠 있게 쓴다 (floating).
 * user 를 안 주면 직접 가져온다.
 */
export function HeaderActions({ user: given, active, floating = false }: { user?: User | null; active?: NavKey; floating?: boolean }) {
  const fetched = useCurrentUser()
  const user = given === undefined ? fetched : given
  const box = floating ? 'tm-float rounded-full bg-(--c-surface) p-1' : ''
  return (
    <div className={`flex items-center gap-1.5 ${box}`}>
      <Link href="/explore" className="grid size-9 shrink-0 place-items-center rounded-full text-(--c-text) transition hover:bg-black/5" aria-label="검색" title="지도 · 사람 검색">
        <SearchIcon size={19} />
      </Link>
      {user === undefined ? (
        <span className="size-9" />
      ) : user ? (
        <Link
          href={`/u/${user.id}`}
          data-tour="nav-profile"
          className={`flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-0.5 transition hover:bg-black/5 sm:pr-3 ${active === 'profile' ? 'ring-2 ring-(--c-accent)' : ''}`}
          aria-label="내 프로필"
        >
          <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={32} />
          <span className="hidden max-w-[120px] truncate text-sm font-semibold sm:block">{user.nickname}</span>
        </Link>
      ) : (
        <Link href="/login" className="tm-btn shrink-0 whitespace-nowrap rounded-full bg-(--c-surface) px-3 py-1.5 text-[0.8125rem] font-bold min-[360px]:px-4 min-[360px]:text-sm">
          로그인
        </Link>
      )}
      <MainMenu user={user ?? null} />
    </div>
  )
}

const MODES: { id: AppearancePref; label: string; Icon: typeof SunIcon }[] = [
  { id: 'auto', label: '자동', Icon: AutoModeIcon },
  { id: 'light', label: '라이트', Icon: SunIcon },
  { id: 'dark', label: '다크', Icon: MoonIcon },
]

/** ☰ 메뉴: 프로필 · 설정 · 화면 · 문제 제보/신고 · 관리자 · 로그아웃 */
function MainMenu({ user }: { user: User | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [bug, setBug] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pref } = useAppearance()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-black/5'
  const close = () => setOpen(false)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="메뉴"
        aria-expanded={open}
        className={`grid size-9 place-items-center rounded-full transition ${open ? 'bg-(--c-ink) text-(--c-bg)' : 'hover:bg-black/5'}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div className="tm-float absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl bg-(--c-surface) p-2 text-(--c-text)">
          {user ? (
            <Link href={`/u/${user.id}`} onClick={close} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-black/5">
              <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={40} />
              <span className="min-w-0">
                <span className="block truncate font-bold">{user.nickname}</span>
                <span className="tm-label">{user.role === 'admin' ? 'admin' : 'member'} · 내 프로필</span>
              </span>
            </Link>
          ) : (
            <Link href="/login" onClick={close} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-black/5">
              <span className="grid size-10 place-items-center rounded-full bg-black/5">
                <UserIcon size={18} />
              </span>
              <span>
                <span className="block font-bold">로그인 · 회원가입</span>
                <span className="tm-label">join the map</span>
              </span>
            </Link>
          )}

          <div className="my-1.5 border-t border-(--c-border)" />
          {/* 모바일에서는 헤더에 메뉴 링크가 없어서 여기에 */}
          <div className="md:hidden">
            {navItems(user?.role === 'admin').map((it) => (
              <Link key={it.key} href={it.href} onClick={close} className={item}>
                {it.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-(--c-border)" />
          </div>

          {user && (
            <>
              <Link href={`/u/${user.id}`} onClick={close} className={item}>
                프로필 꾸미기 <span aria-hidden>✏️</span>
              </Link>
              <Link href="/login" onClick={close} className={item}>
                계정 설정 · 차단 목록 <span aria-hidden>⚙️</span>
              </Link>
            </>
          )}

          <div className="px-3 pb-1 pt-2">
            <p className="tm-label mb-1.5">화면</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/[0.05] p-1" role="radiogroup" aria-label="화면 설정">
              {MODES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={pref === id}
                  onClick={() => setAppearancePref(id)}
                  className={`flex h-9 items-center justify-center gap-1 rounded-lg text-xs font-semibold ${pref === id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <p className="tm-label mb-1.5 mt-3">색 테마</p>
            <SiteColorPicker />
          </div>

          <button type="button" onClick={() => (setBug(true), close())} className={item}>
            문제 제보 · 신고 <span aria-hidden>🛠️</span>
          </button>
          <Link href="/about" onClick={close} className={item}>
            My Concept Map 소개 <span aria-hidden>📍</span>
          </Link>
          {user?.role === 'admin' && (
            <Link href="/customers" onClick={close} className={item}>
              관리자 모드 <ShieldIcon size={16} />
            </Link>
          )}

          {user && (
            <>
              <div className="my-1.5 border-t border-(--c-border)" />
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  close()
                  // 로그아웃하면 소개 화면(메인)으로
                  router.push('/')
                }}
                className={`${item} text-red-500 hover:bg-red-500/10`}
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      )}
      {bug && <ReportDialog subject={BUG_SUBJECT} onClose={() => setBug(false)} />}
    </div>
  )
}

/** 모바일 하단 탭 (목록형 화면에서 사용). 마지막 칸은 로그인 / 내 프로필. */
export function MobileTabBar({ active }: { active?: NavKey }) {
  const user = useCurrentUser()
  const last: NavItem = user
    ? { key: 'profile', href: `/u/${user.id}`, label: '프로필', icon: <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={22} /> }
    : { key: 'login', href: '/login', label: '로그인', icon: <UserIcon size={20} /> }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-(--c-border) bg-(--c-bg)/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      {[...navItems(user?.role === 'admin'), last].map((it) => (
        <Link
          key={it.key}
          href={it.href}
          data-tour={`nav-${it.key}`}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-semibold ${active === it.key ? 'text-(--c-text)' : 'text-(--c-muted)'}`}
        >
          {it.icon}
          {it.label}
          <span className={`h-0.5 w-4 rounded-full ${active === it.key ? 'bg-(--c-accent)' : 'bg-transparent'}`} aria-hidden />
        </Link>
      ))}
    </nav>
  )
}
