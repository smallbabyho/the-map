'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useCurrentUser } from '../auth'
import { AppearanceButton } from './AppearanceButton'
import { Avatar } from './Avatar'
import { MapIcon, ShieldIcon, TrophyIcon, UserIcon, UsersIcon } from './icons'

export type NavKey = 'maps' | 'meetups' | 'ranking' | 'admin' | 'login'

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
    { key: 'ranking', href: '/ranking', label: '순위', icon: <TrophyIcon size={20} /> },
  ]
  if (isAdmin) items.push({ key: 'admin', href: '/customers', label: '관리자', icon: <ShieldIcon size={20} /> })
  return items
}

const railItem = (on: boolean) =>
  `flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${
    on ? 'bg-(--c-accent)/10 text-(--c-accent)' : 'text-(--c-muted) hover:bg-black/5 hover:text-(--c-text)'
  }`

/**
 * 데스크톱 왼쪽 세로 내비게이션 (모바일에서는 숨김 → MobileTabBar).
 * 현재 메뉴는 props 로 받는다 (usePathname 은 cacheComponents 에서 동적 라우트 빌드를 막을 수 있어서).
 */
export function AppRail({ active }: { active: NavKey }) {
  const user = useCurrentUser()
  return (
    <nav className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-1.5 border-r border-(--c-border) bg-(--c-surface) py-4 md:flex">
      <Link href="/" className="mb-3 grid size-10 place-items-center rounded-xl bg-(--c-accent) text-lg shadow-sm" aria-label="컨셉지도 홈">
        <span aria-hidden>📍</span>
      </Link>
      {navItems(user?.role === 'admin').map((it) => (
        <Link key={it.key} href={it.href} className={railItem(active === it.key)}>
          {it.icon}
          {it.label}
        </Link>
      ))}
      <div className="flex-1" />
      <AppearanceButton variant="rail" />
      {user === undefined ? (
        <span className="size-9" />
      ) : user ? (
        <UserMenu id={user.id} nickname={user.nickname} isAdmin={user.role === 'admin'} />
      ) : (
        <Link href="/login" className={railItem(active === 'login')}>
          <UserIcon size={20} />
          로그인
        </Link>
      )}
    </nav>
  )
}

/** 레일 아래쪽 프로필 → 누르면 로그아웃 메뉴 */
function UserMenu({ id, nickname, isAdmin }: { id: string; nickname: string; isAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full p-0.5 transition hover:ring-2 hover:ring-(--c-border)" aria-label="내 계정">
        <Avatar id={id} nickname={nickname} size={36} />
      </button>
      {open && (
        <div className="tm-float absolute bottom-0 left-full z-50 ml-3 w-48 rounded-xl border border-(--c-border) bg-(--c-surface) p-1.5">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{nickname}</p>
            <p className="text-xs text-(--c-muted)">{isAdmin ? '관리자' : '회원'}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              setOpen(false)
              router.push('/login')
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}

/** 모바일 하단 탭 (목록형 화면에서 사용). 마지막 칸은 로그인 / 내 계정. */
export function MobileTabBar({ active }: { active: NavKey }) {
  const user = useCurrentUser()
  const last: NavItem = user
    ? { key: 'login', href: '/login', label: '내 계정', icon: <Avatar id={user.id} nickname={user.nickname} size={22} /> }
    : { key: 'login', href: '/login', label: '로그인', icon: <UserIcon size={20} /> }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-(--c-border) bg-(--c-surface)/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {[...navItems(user?.role === 'admin'), last].map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active === it.key ? 'text-(--c-accent)' : 'text-(--c-muted)'}`}
        >
          {it.icon}
          {it.label}
        </Link>
      ))}
    </nav>
  )
}
