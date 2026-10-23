'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppRail } from '../components/AppRail'
import { MapCard } from '../components/MapCard'
import { PlusIcon, UserIcon } from '../components/icons'
import { deleteMap, getCurrentUser, getMyMaps, saveMap } from '../db/api'
import type { ConceptMap, User } from '../types'

export function MyMapsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [maps, setMaps] = useState<ConceptMap[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getCurrentUser(), getMyMaps()])
      .then(([u, list]) => {
        if (cancelled) return
        setUser(u)
        setMaps(list)
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '지도를 불러오지 못했어요.'))
    return () => {
      cancelled = true
    }
  }, [])

  const createMap = async () => {
    if (creating) return
    setCreating(true)
    try {
      const map = await saveMap({ title: '', theme: 'default', isPublic: false })
      router.push(`/maps/${map.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '지도를 만들지 못했어요.')
      setCreating(false)
    }
  }

  const removeMap = async (map: ConceptMap) => {
    if (!window.confirm(`'${map.title || '제목 없는 지도'}'을(를) 삭제할까요? 핀도 모두 사라져요.`)) return
    try {
      await deleteMap(map.id)
      setMaps((prev) => prev?.filter((m) => m.id !== map.id) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했어요.')
    }
  }

  return (
    <div className="relative min-h-dvh md:pl-[72px]">
      <AppRail active="maps" />

      {/* 모바일 상단 바 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-(--c-border) bg-(--c-surface)/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-(--c-accent) text-base">📍</span>
          컨셉지도
        </Link>
        <Link href="/login" className="grid size-9 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="로그인">
          <UserIcon size={20} />
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-(--c-muted)">{user ? `${user.nickname}님의` : '나의'} 컨셉지도</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">내 지도</h1>
          </div>
          <button
            type="button"
            onClick={createMap}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-full bg-(--c-text) px-5 py-2.5 text-sm font-semibold text-(--c-surface) shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <PlusIcon size={18} />
            {creating ? '만드는 중…' : '새 지도 만들기'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <section className="mt-8">
          {maps === null && !error && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[212px] animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          )}

          {maps?.length === 0 && (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-(--c-border) bg-(--c-surface) px-6 py-16 text-center">
              <div className="text-5xl" aria-hidden>🗺️</div>
              <h2 className="mt-4 text-lg font-semibold">아직 만든 지도가 없어요</h2>
              <p className="mt-1.5 text-sm text-(--c-muted)">카페 투어, 빵지순례, 드라마 촬영지… 나만의 테마로 첫 지도를 꾸며 보세요.</p>
              <button
                type="button"
                onClick={createMap}
                disabled={creating}
                className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-(--c-accent) px-5 py-2.5 text-sm font-semibold text-(--c-accent-text) transition hover:opacity-90 disabled:opacity-60"
              >
                <PlusIcon size={18} />첫 지도 만들기
              </button>
            </div>
          )}

          {maps && maps.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {maps.map((m) => (
                <MapCard key={m.id} map={m} onDelete={removeMap} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
