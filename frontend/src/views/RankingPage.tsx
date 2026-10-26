'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'
import { MapThumb } from '../components/MapThumb'
import { getMonthlyRanking } from '../db/api'
import type { MapRankingEntry } from '../types'

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  return ym(new Date(y, m - 1 + delta, 1))
}
const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}
const MEDALS = ['🥇', '🥈', '🥉']

/** 월간 지도 순위: 그 달에 다른 사람이 가장 많이 '사용'한 공개 지도 */
export function RankingPage() {
  const me = useCurrentUser()
  const [thisMonth] = useState(() => ym(new Date()))
  const [month, setMonth] = useState(thisMonth)
  const [list, setList] = useState<MapRankingEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getMonthlyRanking(month)
      .then((l) => !cancelled && setList(l))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '순위를 불러오지 못했어요.'))
    return () => {
      cancelled = true
      setList(null)
    }
  }, [month])

  const top = list?.slice(0, 3) ?? []
  const rest = list?.slice(3) ?? []
  const myBest = me && list?.find((e) => e.owner.id === me.id)

  return (
    <div className="relative min-h-dvh pb-16 md:pb-0 pt-14">
      <AppRail active="explore" />
      <MobileTabBar active="explore" />

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 md:px-10 md:pt-12">
        <p className="tm-label dot">monthly chart · 많은 사람이 따라 걸은 지도</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="tm-headline mt-2 text-5xl md:text-7xl">
            이달의 <em>지도</em>
          </h1>
          <div className="flex items-center gap-1 rounded-full border border-(--c-border) bg-(--c-surface) p-1">
            <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid size-8 place-items-center rounded-full hover:bg-black/5" aria-label="이전 달">
              <ChevronLeftIcon size={16} />
            </button>
            <span className="min-w-[96px] text-center text-sm font-bold">{monthLabel(month)}</span>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= thisMonth}
              className="grid size-8 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30"
              aria-label="다음 달"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-(--c-muted)">
          다른 사람이 <b className="font-semibold text-(--c-text)">내 지도로 가져가거나</b> 그 지도로 <b className="font-semibold text-(--c-text)">성지순례에 참여</b>한 사람 수예요. (한 사람은 한 번만, 공개 지도만)
        </p>

        {myBest && (
          <p className="mt-4 rounded-xl bg-(--c-accent)/10 px-4 py-3 text-sm font-semibold text-(--c-accent)">
            🎉 내 지도 ‘{myBest.map.title}’이(가) {myBest.rank}위예요!
          </p>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

        {list === null ? (
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-60 animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-(--c-ink)/25 px-6 py-16 text-center">
            <div className="text-5xl" aria-hidden>🏆</div>
            <h2 className="mt-4 text-lg font-semibold">{monthLabel(month)}에는 아직 순위가 없어요</h2>
            <p className="mt-1.5 text-sm text-(--c-muted)">내 지도를 공개하고 성지순례를 열어 보세요.</p>
          </div>
        ) : (
          <>
            {/* 1~3위 */}
            <ol className="mt-8 grid gap-3 md:grid-cols-3 md:items-end">
              {top.map((e, i) => (
                <li key={e.map.id} className={i === 0 ? 'md:order-2' : i === 1 ? 'md:order-1' : 'md:order-3'}>
                  <Link
                    href={`/maps/${e.map.id}`}
                    className={`tm-card block overflow-hidden rounded-2xl ${e.rank === 1 ? 'border-amber-300 shadow-[0_8px_30px_rgb(245_158_11/0.18)]' : 'border-(--c-border)'}`}
                  >
                    <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className={e.rank === 1 ? 'h-40' : 'h-32'}>
                      <span className="absolute left-3 top-3 text-3xl drop-shadow" aria-label={`${e.rank}위`}>{MEDALS[e.rank - 1] ?? `${e.rank}위`}</span>
                      {me?.id === e.owner.id && <span className="absolute right-3 top-3 rounded-full bg-(--c-accent) px-2 py-0.5 text-[11px] font-bold text-white">내 지도</span>}
                    </MapThumb>
                    <div className="p-4">
                      <h3 className="truncate text-[15px] font-bold">{e.map.title}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-(--c-muted)">
                        <Avatar id={e.owner.id} nickname={e.owner.nickname} src={e.owner.avatarUrl} size={18} />
                        {e.owner.nickname} · 장소 {e.pinCount}곳
                      </p>
                      <p className="mt-3 text-2xl font-extrabold tracking-tight">
                        {e.users}
                        <span className="ml-1 text-sm font-semibold text-(--c-muted)">명이 사용</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>

            {/* 4위~ */}
            {rest.length > 0 && (
              <ol className="mt-6 divide-y divide-(--c-border) overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface)">
                {rest.map((e) => (
                  <li key={e.map.id}>
                    <Link href={`/maps/${e.map.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-black/[0.02]">
                      <span className="w-6 text-center text-lg font-extrabold text-(--c-muted)">{e.rank}</span>
                      <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className="h-12 w-16 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {e.map.title}
                          {me?.id === e.owner.id && <span className="ml-1.5 text-xs font-bold text-(--c-accent)">내 지도</span>}
                        </span>
                        <span className="block truncate text-[13px] text-(--c-muted)">{e.owner.nickname} · 장소 {e.pinCount}곳</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="text-lg font-extrabold">{e.users}</span>
                        <span className="text-xs text-(--c-muted)">명</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </main>
    </div>
  )
}
