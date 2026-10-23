'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { PlusIcon } from '../components/icons'
import { MeetupCard } from '../components/meetup/MeetupCard'
import { getMeetups } from '../db/api'
import type { MeetupFilter, MeetupSummary } from '../types'

const TABS: { id: MeetupFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'joined', label: '참여 중' },
  { id: 'hosting', label: '내가 연 모임' },
]

/** 성지순례 모집 목록 */
export function MeetupsPage() {
  const user = useCurrentUser()
  const [tab, setTab] = useState<MeetupFilter>('all')
  const [list, setList] = useState<MeetupSummary[] | null>(null)
  const [error, setError] = useState('')
  const [hidePast, setHidePast] = useState(true)
  const [loadedAt, setLoadedAt] = useState(0)

  const userId = user?.id
  useEffect(() => {
    let cancelled = false
    getMeetups(tab)
      .then((l) => {
        if (cancelled) return
        setList(l)
        setLoadedAt(Date.now())
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '모임을 불러오지 못했어요.'))
    return () => {
      cancelled = true
      setList(null)
    }
  }, [tab, userId])

  const shown = list?.filter((m) => !hidePast || (m.status !== 'canceled' && Date.parse(m.meetAt) >= loadedAt))
  const needLogin = tab !== 'all' && user === null

  return (
    <div className="relative min-h-dvh pb-16 md:pb-0 md:pl-[72px]">
      <AppRail active="meetups" />
      <MobileTabBar active="meetups" />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-(--c-muted)">함께 걷는 컨셉지도</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">성지순례</h1>
          </div>
          <Link
            href={user ? '/meetups/new' : '/login?next=/meetups/new'}
            className="inline-flex items-center gap-1.5 rounded-full bg-(--c-text) px-5 py-2.5 text-sm font-semibold text-(--c-surface) shadow-sm transition hover:opacity-90"
          >
            <PlusIcon size={18} />
            모임 만들기
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full bg-black/[0.04] p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`h-9 rounded-full px-4 text-sm font-semibold transition ${tab === t.id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-(--c-muted) select-none">
            <input type="checkbox" checked={hidePast} onChange={(e) => setHidePast(e.target.checked)} className="size-4 accent-(--c-accent)" />
            끝난·취소된 모임 숨기기
          </label>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <section className="mt-6">
          {needLogin ? (
            <Empty emoji="🔑" title="로그인하면 내 모임을 볼 수 있어요" action={<Link href="/login?next=/meetups" className="mt-6 rounded-full bg-(--c-text) px-5 py-2.5 text-sm font-bold text-(--c-surface)">로그인</Link>} />
          ) : shown === undefined ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[300px] animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <Empty
              emoji="🚶"
              title={tab === 'hosting' ? '아직 연 모임이 없어요' : tab === 'joined' ? '참여한 모임이 없어요' : '열린 모임이 없어요'}
              desc="내 지도나 인기 지도로 성지순례를 열고 같이 걸을 사람을 모아 보세요."
              action={
                <Link href={user ? '/meetups/new' : '/login?next=/meetups/new'} className="mt-6 rounded-full bg-(--c-accent) px-5 py-2.5 text-sm font-bold text-(--c-accent-text)">
                  모임 만들기
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((m) => (
                <MeetupCard key={m.id} meetup={m} myId={user?.id} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Empty({ emoji, title, desc, action }: { emoji: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-(--c-border) bg-(--c-surface) px-6 py-16 text-center">
      <div className="text-5xl" aria-hidden>{emoji}</div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {desc && <p className="mt-1.5 text-sm text-(--c-muted)">{desc}</p>}
      {action}
    </div>
  )
}
