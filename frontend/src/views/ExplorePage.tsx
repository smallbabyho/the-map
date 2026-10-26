'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { MAP_CATEGORIES, categoryMeta } from '../components/mapCategories'
import { MapThumb } from '../components/MapThumb'
import { getPublicMaps } from '../db/api'
import type { ExploreMapEntry, ExploreSort, MapCategory } from '../types'

/** 둘러보기: 공개 지도를 카테고리(맛집 · 카페 · 데이트 · 1박 2일 …)별로 */
export function ExplorePage() {
  const me = useCurrentUser()
  const [category, setCategory] = useState<MapCategory | 'all'>('all')
  const [sort, setSort] = useState<ExploreSort>('popular')
  const [list, setList] = useState<ExploreMapEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPublicMaps({ category: category === 'all' ? undefined : category, sort })
      .then((l) => !cancelled && setList(l))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '지도를 불러오지 못했어요.'))
    return () => {
      cancelled = true
      setList(null)
    }
  }, [category, sort])

  const current = category === 'all' ? null : categoryMeta(category)

  return (
    <div className="relative min-h-dvh pb-16 pt-14 md:pb-0">
      <AppRail active="explore" />
      <MobileTabBar active="explore" />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-10 md:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-(--c-ink) pb-6">
          <div>
            <p className="tm-label dot">explore · 남의 코스 구경하기</p>
            <h1 className="tm-headline mt-3 text-5xl md:text-7xl">
              {current ? (
                <>
                  {current.emoji} <em>{current.label}</em>
                </>
              ) : (
                <>
                  지도 <em>둘러보기</em>
                </>
              )}
            </h1>
          </div>
          <Link href="/ranking" className="tm-btn rounded-full bg-(--c-surface) px-5 py-2.5 text-sm font-bold">
            🏆 이달의 순위 →
          </Link>
        </div>

        {/* 카테고리 */}
        <div className="tm-scroll -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="카테고리">
          {[{ id: 'all' as const, label: '전체', emoji: '✦' }, ...MAP_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border-[1.5px] px-4 py-2 text-sm font-bold transition ${
                category === c.id ? 'border-(--c-ink) bg-(--c-ink) text-(--c-bg)' : 'border-(--c-border) hover:border-(--c-ink)'
              }`}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="tm-label">{list ? `${String(list.length).padStart(2, '0')} maps` : 'loading…'}</p>
          <div className="flex gap-1 rounded-full bg-black/[0.05] p-1" role="tablist" aria-label="정렬">
            {(
              [
                ['popular', '인기순'],
                ['recent', '최신순'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={sort === id}
                onClick={() => setSort(id)}
                className={`h-8 rounded-full px-3.5 text-xs font-bold ${sort === id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

        {list === null ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[280px] animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-(--c-ink)/25 px-6 py-20 text-center">
            <div className="text-5xl" aria-hidden>{current?.emoji ?? '🗺️'}</div>
            <h2 className="tm-headline mt-5 text-3xl">아직 {current ? `${current.label} 지도가` : '공개 지도가'} 없어요</h2>
            <p className="mt-2 text-sm text-(--c-muted)">첫 번째로 만들어 공개해 보세요. 지도 편집에서 카테고리를 고를 수 있어요.</p>
            <Link href={me ? '/' : '/login'} className="tm-btn mt-8 rounded-full bg-(--c-accent) px-6 py-3 text-sm font-bold text-(--c-accent-text)">
              지도 만들기
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => {
              const cat = categoryMeta(e.map.category)
              return (
                <li key={e.map.id}>
                  <Link href={`/maps/${e.map.id}`} className="tm-card block overflow-hidden rounded-2xl">
                    <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className="h-44">
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">
                        {cat.emoji} {cat.label}
                      </span>
                      {e.users > 0 && (
                        <span className="absolute right-3 top-3 rounded-full bg-(--c-ink) px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-(--c-bg)">{e.users} walked</span>
                      )}
                    </MapThumb>
                    <div className="border-t border-(--c-border) px-4 pb-4 pt-3">
                      <h3 className="truncate text-lg font-bold tracking-tight">{e.map.title || '제목 없는 지도'}</h3>
                      <p className="mt-2 flex items-center gap-2 text-[13px] text-(--c-muted)">
                        <Avatar id={e.owner.id} nickname={e.owner.nickname} src={e.owner.avatarUrl} size={20} />
                        <span className="truncate">{e.owner.nickname}</span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">장소 {e.pinCount}곳</span>
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
