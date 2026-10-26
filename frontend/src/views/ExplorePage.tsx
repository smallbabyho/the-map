'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../components/icons'
import { MAP_CATEGORIES, mapCategoryText } from '../components/mapCategories'
import { MAP_PURPOSES, mapPurpose, purposeMeta } from '../components/mapPurpose'
import { MapThumb } from '../components/MapThumb'
import { REGIONS } from '../components/regions'
import { getMonthlyRanking, searchMaps, searchPeople } from '../db/api'
import type { MapRankingEntry, MapSearchEntry, MapSearchFilters, PersonSearchEntry } from '../types'

type Tab = 'maps' | 'people'
type Sort = NonNullable<MapSearchFilters['sort']>

const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: '관련도순' },
  { id: 'popular', label: '인기순' },
  { id: 'recent', label: '최신순' },
  { id: 'pins', label: '장소 많은 순' },
]
const PIN_MINS = [0, 3, 5]
/** 한 쪽에 보일 지도 수 */
const PAGE_SIZE = 20

/**
 * 둘러보기 (/explore?q=…): 검색 · 둘러보기 · 이달의 지도를 한 화면에.
 * 맨 위 검색창 → 검색어 · 필터가 없으면 이달의 지도 TOP 10 + 전체 공개 지도, 있으면 그 결과(관련도순).
 * 사람(닉네임) 찾기는 탭으로. 예전 /search · /ranking 주소는 여기로 넘어온다 (next.config.ts).
 */
export function ExplorePage() {
  const initial = useSearchParams().get('q') ?? ''
  const [input, setInput] = useState(initial)
  const [q, setQ] = useState(initial.trim())
  const [tab, setTab] = useState<Tab>('maps')
  // sort 를 안 고르면: 검색어가 있으면 관련도순, 없으면 인기순
  const [f, setF] = useState<Omit<MapSearchFilters, 'q'>>({})
  const [hasMaps, setHasMaps] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [maps, setMaps] = useState<MapSearchEntry[] | null>(null)
  const [people, setPeople] = useState<PersonSearchEntry[] | null>(null)
  const [error, setError] = useState('')

  // 입력이 멈추면 검색 (주소의 ?q= 도 맞춰 둔다: 공유 · 뒤로 가기)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const v = input.trim()
      setQ(v)
      const url = new URL(window.location.href)
      if (v) url.searchParams.set('q', v)
      else url.searchParams.delete('q')
      window.history.replaceState(window.history.state, '', url)
    }, 300)
    return () => window.clearTimeout(t)
  }, [input])

  useEffect(() => {
    if (tab !== 'maps') return
    let cancelled = false
    searchMaps({ ...f, q, sort: f.sort ?? (q ? 'relevance' : 'popular') })
      .then((l) => !cancelled && setMaps(l))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '검색하지 못했어요.'))
    return () => {
      cancelled = true
      setMaps(null)
      setError('')
    }
  }, [tab, q, f])

  useEffect(() => {
    if (tab !== 'people' || !q) return
    let cancelled = false
    searchPeople(q, { hasMaps })
      .then((l) => !cancelled && setPeople(l))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '검색하지 못했어요.'))
    return () => {
      cancelled = true
      setPeople(null)
      setError('')
    }
  }, [tab, q, hasMaps])

  const set = (patch: Partial<MapSearchFilters>) => setF((cur) => ({ ...cur, ...patch }))
  const activeCount = [f.purpose, f.category, f.region, f.minPins, f.hasMeetup, f.sort].filter(Boolean).length
  const sort = f.sort ?? (q ? 'relevance' : 'popular')
  const browsing = tab === 'maps' && !q && activeCount === 0
  // 쪽 번호: 검색어 · 필터가 바뀌면 1쪽부터 (어느 검색의 쪽인지 같이 둔다)
  const pageKey = JSON.stringify([q, f])
  const [paging, setPaging] = useState({ key: pageKey, page: 1 })
  const pageCount = Math.max(1, Math.ceil((maps?.length ?? 0) / PAGE_SIZE))
  const page = paging.key === pageKey ? Math.min(paging.page, pageCount) : 1
  const gridTop = useRef<HTMLParagraphElement>(null)
  const goPage = (n: number) => {
    setPaging({ key: pageKey, page: n })
    gridTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="relative min-h-dvh pb-16 pt-14 md:pb-0">
      <AppRail active="explore" />
      <MobileTabBar active="explore" />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-10 md:pt-14">
        <p className="tm-label dot">explore · 남의 기록이 나의 계획이 돼요</p>
        <h1 className="tm-headline mt-3 text-5xl md:text-7xl">
          지도 <em>둘러보기</em>
        </h1>

        <label className="mt-6 flex h-14 items-center gap-3 rounded-2xl border-[1.5px] border-(--c-ink) bg-(--c-surface) px-4 focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--c-accent)_15%,transparent)]">
          <SearchIcon size={20} className="shrink-0 text-(--c-muted)" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tab === 'maps' ? '지도 · 장소 · 카테고리 (예: 런던베이글, 떡볶이, 카페)' : '닉네임'}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-(--c-muted)/70"
            aria-label="검색어"
          />
          {input && (
            <button type="button" onClick={() => setInput('')} className="shrink-0 text-sm text-(--c-muted) hover:text-(--c-text)">
              지우기
            </button>
          )}
        </label>

        <div className="mt-5 flex items-center gap-1.5" role="tablist" aria-label="찾을 것">
          {(
            [
              { id: 'maps', label: '🗺️ 지도' },
              { id: 'people', label: '🙋 사람' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-(--c-ink) text-(--c-bg)' : 'text-(--c-muted) hover:text-(--c-text)'}`}
            >
              {t.label}
            </button>
          ))}
          {tab === 'maps' && (
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="ml-auto rounded-full border border-(--c-border) px-4 py-2 text-sm font-semibold transition hover:bg-black/[0.03] md:hidden"
            >
              필터{activeCount > 0 && <span className="ml-1 text-(--c-accent)">{activeCount}</span>}
            </button>
          )}
        </div>

        {/* 검색어 · 필터가 없을 때: 이달의 지도 */}
        {browsing && <MonthlyTop />}

        {tab === 'maps' ? (
          <div className="mt-5 md:grid md:grid-cols-[240px_1fr] md:gap-8">
            {/* 필터: 종류별로 묶음. 모바일은 [필터] 를 눌러 펼친다 */}
            <aside className={`${showFilters ? 'block' : 'hidden'} space-y-5 rounded-2xl border border-(--c-border) bg-(--c-surface) p-4 md:block md:self-start md:border-0 md:bg-transparent md:p-0`}>
              <FilterGroup title="용도">
                <Chip on={!f.purpose} onClick={() => set({ purpose: undefined })}>전체</Chip>
                {MAP_PURPOSES.map((p) => (
                  <Chip key={p.id} on={f.purpose === p.id} onClick={() => set({ purpose: p.id })}>
                    {p.emoji} {p.label}
                  </Chip>
                ))}
              </FilterGroup>
              <FilterGroup title="카테고리">
                <Chip on={!f.category} onClick={() => set({ category: undefined })}>전체</Chip>
                {MAP_CATEGORIES.map((c) => (
                  <Chip key={c.id} on={f.category === c.id} onClick={() => set({ category: c.id })}>
                    {c.emoji} {c.label}
                  </Chip>
                ))}
              </FilterGroup>
              <FilterGroup title="지역">
                <Chip on={!f.region} onClick={() => set({ region: undefined })}>전국</Chip>
                {REGIONS.map((r) => (
                  <Chip key={r.id} on={f.region === r.id} onClick={() => set({ region: r.id })}>
                    {r.label}
                  </Chip>
                ))}
              </FilterGroup>
              <FilterGroup title="장소 수">
                {PIN_MINS.map((n) => (
                  <Chip key={n} on={(f.minPins ?? 0) === n} onClick={() => set({ minPins: n || undefined })}>
                    {n ? `${n}곳 이상` : '전체'}
                  </Chip>
                ))}
              </FilterGroup>
              <FilterGroup title="성지순례">
                <Chip on={!!f.hasMeetup} onClick={() => set({ hasMeetup: !f.hasMeetup || undefined })}>
                  🚩 지금 모집 중인 지도만
                </Chip>
              </FilterGroup>
              <FilterGroup title="정렬">
                {SORTS.filter((s) => s.id !== 'relevance' || q).map((s) => (
                  <Chip key={s.id} on={sort === s.id} onClick={() => set({ sort: s.id })}>
                    {s.label}
                  </Chip>
                ))}
              </FilterGroup>
              {activeCount > 0 && (
                <button type="button" onClick={() => setF({})} className="text-sm font-semibold text-(--c-muted) underline underline-offset-2 hover:text-(--c-text)">
                  필터 모두 지우기
                </button>
              )}
            </aside>

            <section className="mt-6 md:mt-0">
              {error ? (
                <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>
              ) : maps === null ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-60 animate-pulse rounded-2xl bg-black/5" />
                  ))}
                </div>
              ) : maps.length === 0 ? (
                <Empty>{q ? `'${q}'에 맞는 지도가 없어요. 필터를 줄여 보세요.` : '조건에 맞는 지도가 없어요.'}</Empty>
              ) : (
                <>
                  <p ref={gridTop} className="mb-3 scroll-mt-20 font-mono text-xs uppercase tracking-wider text-(--c-muted)">
                    {browsing ? `all maps · ${maps.length}` : `${maps.length} maps`}
                    {pageCount > 1 && ` · ${page}/${pageCount}`}
                  </p>
                  <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {maps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => (
                      <li key={e.map.id}>
                        <MapResult e={e} />
                      </li>
                    ))}
                  </ul>
                  {pageCount > 1 && <Pager page={page} count={pageCount} onGo={goPage} />}
                </>
              )}
            </section>
          </div>
        ) : (
          <section className="mt-5">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-(--c-muted)">
              <input type="checkbox" checked={hasMaps} onChange={(e) => setHasMaps(e.target.checked)} className="size-4 accent-(--c-accent)" />
              공개 지도가 있는 사람만
            </label>
            <div className="mt-4">
              {!q ? (
                <Empty>닉네임을 입력해 보세요.</Empty>
              ) : error ? (
                <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>
              ) : people === null ? (
                <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
              ) : people.length === 0 ? (
                <Empty>{`'${q}' 닉네임을 찾지 못했어요.`}</Empty>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map(({ user, publicMaps }) => (
                    <li key={user.id}>
                      <Link href={`/u/${user.id}`} className="tm-card flex items-center gap-3 rounded-2xl p-3">
                        <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={44} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{user.nickname}</span>
                          <span className="text-xs text-(--c-muted)">공개 지도 {publicMaps}개</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      <p className="mb-2 text-xs font-bold text-(--c-muted)">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-(--c-ink) bg-(--c-ink) text-(--c-bg)' : 'border-(--c-border) bg-(--c-surface) text-(--c-muted) hover:text-(--c-text)'}`}
    >
      {children}
    </button>
  )
}

/** ← 이전 · 1 2 3 · 다음 → (쪽이 많으면 지금 쪽 근처만) */
function Pager({ page, count, onGo }: { page: number; count: number; onGo: (n: number) => void }) {
  const from = Math.max(1, Math.min(page - 2, count - 4))
  const nums = Array.from({ length: Math.min(5, count) }, (_, i) => from + i)
  const btn = 'grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm font-semibold transition disabled:opacity-30'
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="쪽 넘기기">
      <button type="button" onClick={() => onGo(page - 1)} disabled={page <= 1} className={`${btn} hover:bg-black/5`}>
        ← 이전
      </button>
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onGo(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`${btn} ${n === page ? 'bg-(--c-ink) text-(--c-bg)' : 'hover:bg-black/5'}`}
        >
          {n}
        </button>
      ))}
      <button type="button" onClick={() => onGo(page + 1)} disabled={page >= count} className={`${btn} hover:bg-black/5`}>
        다음 →
      </button>
    </nav>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-(--c-border) px-6 py-14 text-center text-sm text-(--c-muted)">{children}</p>
}

function MapResult({ e }: { e: MapSearchEntry }) {
  const cat = mapCategoryText(e.map)
  const purpose = purposeMeta(mapPurpose(e.map))
  return (
    <Link href={`/maps/${e.map.id}`} className="tm-card block overflow-hidden rounded-2xl">
      <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className="h-40">
        <span className="absolute left-3 top-3 flex gap-1">
          <span className="rounded-full bg-(--c-ink) px-2.5 py-1 text-[11px] font-bold text-(--c-bg) shadow-sm">
            {purpose.emoji} {purpose.label}
          </span>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">
            {cat.emoji} {cat.label}
          </span>
        </span>
        {e.openMeetups > 0 && <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white">🚩 모집 중 {e.openMeetups}</span>}
      </MapThumb>
      <div className="border-t border-(--c-border) px-4 pb-4 pt-3">
        <h3 className="truncate text-lg font-bold tracking-tight">{e.map.title || '제목 없는 지도'}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-(--c-muted)">
          <Avatar id={e.owner.id} nickname={e.owner.nickname} src={e.owner.avatarUrl} size={18} />
          <span className="truncate">{e.owner.nickname}</span>
          <span aria-hidden>·</span>
          장소 {e.pinCount}곳{e.users > 0 && ` · 이번 달 ${e.users}명`}
        </p>
      </div>
    </Link>
  )
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  return ym(new Date(y, m - 1 + delta, 1))
}
const MEDALS = ['🥇', '🥈', '🥉']

/** 🏆 이달의 지도 TOP 10 (옆으로 넘기기). 지난 달도 넘겨 볼 수 있다 */
function MonthlyTop() {
  const [thisMonth] = useState(() => ym(new Date()))
  const [month, setMonth] = useState(thisMonth)
  const [list, setList] = useState<MapRankingEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getMonthlyRanking(month, 10)
      .then((l) => !cancelled && setList(l))
      .catch(() => !cancelled && setList([]))
    return () => {
      cancelled = true
      setList(null)
    }
  }, [month])

  const [y, m] = month.split('-').map(Number)
  return (
    <section className="mt-8" aria-label="이달의 지도">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">🏆 {month === thisMonth ? '이달의 지도' : `${y}년 ${m}월의 지도`}</h2>
          <p className="mt-0.5 text-xs text-(--c-muted)">다른 사람이 가장 많이 가져가거나 성지순례로 다녀온 공개 지도</p>
        </div>
        <div className="flex shrink-0 items-center rounded-full border border-(--c-border) bg-(--c-surface)">
          <button type="button" onClick={() => setMonth((v) => shiftMonth(v, -1))} className="grid size-8 place-items-center rounded-full hover:bg-black/5" aria-label="지난 달">
            <ChevronLeftIcon size={16} />
          </button>
          <span className="min-w-[56px] text-center text-xs font-bold">{m}월</span>
          <button type="button" onClick={() => setMonth((v) => shiftMonth(v, 1))} disabled={month >= thisMonth} className="grid size-8 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30" aria-label="다음 달">
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
      <div className="tm-scroll -mx-4 mt-3 overflow-x-auto px-4 pb-2 md:-mx-10 md:px-10">
        {list === null ? (
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 w-56 shrink-0 animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-(--c-border) px-6 py-8 text-center text-sm text-(--c-muted)">이 달에는 아직 순위가 없어요.</p>
        ) : (
          <ol className="flex w-max gap-3">
            {list.map((e) => (
              <li key={e.map.id} className="w-56 shrink-0">
                <Link href={`/maps/${e.map.id}`} className={`tm-card block overflow-hidden rounded-2xl ${e.rank === 1 ? 'border-amber-300' : ''}`}>
                  <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className="h-28">
                    <span className="absolute left-2.5 top-2 text-2xl drop-shadow" aria-label={`${e.rank}위`}>
                      {MEDALS[e.rank - 1] ?? <span className="grid size-7 place-items-center rounded-full bg-(--c-ink) text-xs font-bold text-(--c-bg)">{e.rank}</span>}
                    </span>
                  </MapThumb>
                  <div className="px-3 pb-3 pt-2.5">
                    <h3 className="truncate text-[15px] font-bold">{e.map.title || '제목 없는 지도'}</h3>
                    <p className="mt-0.5 truncate text-xs text-(--c-muted)">
                      {e.owner.nickname} · <b className="font-bold text-(--c-text)">{e.users}명</b>이 사용
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
