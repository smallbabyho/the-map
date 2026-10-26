'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { MapIcon, UserIcon } from './icons'

/**
 * 데스크톱 왼쪽 세로 내비게이션 (모바일에서는 숨김).
 * 현재 메뉴는 props 로 받는다 (usePathname 은 cacheComponents 에서 동적 라우트 빌드를 막을 수 있어서).
 */
export function AppRail({ active }: { active: 'maps' | 'login' }) {
  const item = (href: string, label: string, icon: ReactNode, on: boolean) => (
    <Link
      href={href}
      className={`flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${
        on ? 'bg-(--c-accent)/10 text-(--c-accent)' : 'text-(--c-muted) hover:bg-black/5 hover:text-(--c-text)'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
  return (
    <nav className="absolute inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-2 border-r border-(--c-border) bg-(--c-surface) py-4 md:flex">
      <Link href="/" className="mb-3 grid size-10 place-items-center rounded-xl bg-(--c-accent) text-lg shadow-sm" aria-label="컨셉지도 홈">
        <span aria-hidden>📍</span>
      </Link>
      {item('/', '내 지도', <MapIcon size={20} />, active === 'maps')}
      <div className="flex-1" />
      {item('/login', '로그인', <UserIcon size={20} />, active === 'login')}
    </nav>
  )
}
