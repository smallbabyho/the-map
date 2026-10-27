'use client'

import { useEffect, useRef, useState } from 'react'
import { getPlaceStats } from '../../db/api'
import type { PlaceStats } from '../../types'
import { CloseIcon, PlusIcon, SearchIcon } from '../icons'
import { hasKakaoKey, isCustomPlace, searchPlaces, type PlaceSearchResult } from '../map'
import { PlaceStatsLine } from '../place/PlaceStats'

interface Props {
  onPick: (place: PlaceSearchResult) => void
}

/** 장소 검색창 + 결과 목록. 결과를 누르면 onPick 으로 넘기고 닫힌다. */
export function PlaceSearchBox({ onPick }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  /** 검색 결과 장소별 '리뷰 수 · 별점 · 담긴 지도 수'. null = 아직 불러오는 중 (결과는 먼저 보여준다) */
  const [stats, setStats] = useState<Record<string, PlaceStats> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  // 바깥을 누르면 결과 닫기
  useEffect(() => {
    if (results === null) return
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setResults(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [results])

  const run = async () => {
    const q = query.trim()
    if (!q) return
    const id = ++reqId.current
    setLoading(true)
    setError('')
    setStats(null)
    try {
      const list = await searchPlaces(q)
      if (id === reqId.current) setResults(list)
      const ids = list.map((r) => r.externalId).filter((x) => !isCustomPlace(x))
      if (ids.length)
        getPlaceStats(ids)
          .then((s) => id === reqId.current && setStats(s))
          .catch(() => {}) // 통계는 없어도 검색은 된다
    } catch (e) {
      if (id === reqId.current) {
        setError(e instanceof Error ? e.message : '검색하지 못했어요.')
        setResults([])
      }
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }

  const clear = () => {
    setQuery('')
    setResults(null)
    setError('')
  }

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
        className="flex h-12 items-center gap-2 rounded-xl border-2 border-(--c-accent) bg-(--c-surface) pl-3.5 pr-1.5 transition focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--c-accent)_15%,transparent)]"
      >
        <SearchIcon size={18} className="shrink-0 text-(--c-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && clear()}
          placeholder={hasKakaoKey ? '장소, 주소 검색' : '샘플 장소 검색 (예: 카페, 공원, 성수)'}
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-(--c-muted)/80"
          enterKeyHint="search"
          aria-label="장소 검색"
        />
        {query && (
          <button type="button" onClick={clear} className="grid size-8 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="검색어 지우기">
            <CloseIcon size={16} />
          </button>
        )}
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="h-9 shrink-0 rounded-lg bg-(--c-accent) px-3.5 text-sm font-semibold text-(--c-accent-text) transition disabled:opacity-40"
        >
          {loading ? '검색 중' : '검색'}
        </button>
      </form>

      {results !== null && (
        <div className="tm-float tm-scroll absolute inset-x-0 top-full z-20 mt-2 max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border border-(--c-border) bg-(--c-surface)">
          {error ? (
            <p className="px-4 py-6 text-center text-sm text-red-500">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-(--c-muted)">
              ‘{query.trim()}’ 검색 결과가 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-(--c-border)">
              {results.map((r) => (
                <li key={r.externalId} className="transition hover:bg-black/[0.03]">
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r)
                      clear()
                    }}
                    className={`flex w-full items-center gap-3 px-4 text-left ${stats ? 'pb-1 pt-3' : 'py-3'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[0.9375rem] font-semibold">{r.name}</span>
                        {r.category && <span className="shrink-0 text-xs text-(--c-muted)">{r.category}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[0.8125rem] text-(--c-muted)">{r.address}</p>
                    </div>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-(--c-border) text-(--c-accent)">
                      <PlusIcon size={16} />
                    </span>
                  </button>
                  {/* 버튼 안에 링크를 넣을 수 없어서 아래에 따로 둔다 */}
                  {stats && <PlaceStatsLine stats={stats[r.externalId]} externalId={r.externalId} className="mb-3 ml-4" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
