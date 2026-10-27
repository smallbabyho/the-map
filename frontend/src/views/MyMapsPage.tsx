'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { MapCard } from '../components/MapCard'
import { PlusIcon, TrashIcon } from '../components/icons'
import { Tour, type TourStep } from '../components/onboarding/Tour'
import { useCurrentUser } from '../auth'
import { deleteMap, getMyMaps, removeMapEditor, saveMap } from '../db/api'
import { LandingPage } from './LandingPage'
import type { ConceptMap, MapPurpose } from '../types'
import { MAP_PURPOSES, mapPurpose } from '../components/mapPurpose'

/** 처음 로그인한 사람에게 한 번 보여주는 안내 */
const HOME_TOUR: TourStep[] = [
  { title: 'My Concept Map에 오신 걸 환영해요 👋', body: '가고 싶은 곳은 계획하고, 사랑했던 곳은 기록하는 나만의 지도예요. 주요 기능을 짧게 알려드릴게요.' },
  { target: 'new-map', title: '기록 · 계획', body: '다녀온 곳은 기록으로 남겨 공유하고, 갈 곳은 계획으로 짜요. 남의 기록을 가져오면 내 계획이 돼요.' },
  { target: 'nav-meetups', title: '성지순례', body: '지도 하나로 모임을 열고 함께 떠날 사람을 모아요.' },
  { target: 'nav-explore', title: '둘러보기', body: '다른 사람의 지도를 구경하고, 마음에 들면 내 지도로 가져와요.' },
  { target: 'nav-profile', title: '내 프로필', body: '다이어리처럼 꾸미고, 공개한 지도를 모아 보여줘요.' },
]

export function MyMapsPage() {
  const router = useRouter()
  const user = useCurrentUser()
  const [maps, setMaps] = useState<ConceptMap[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState<MapPurpose | null>(null)
  const [filter, setFilter] = useState<MapPurpose | 'all'>('all')
  /** 여러 개 골라 한 번에 지우기. null 이면 고르는 중이 아님 */
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [removing, setRemoving] = useState(false)
  // 성공하면 다음 화면으로 넘어가며 creating 를 안 푼다. 뒤로 오면 Next 가 이 화면을 상태째 다시 보여 주므로, 떠날 때 푼다
  useLayoutEffect(() => () => setCreating(null), [])

  // 로그인한 사람이 바뀌면 다시 불러온다
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getMyMaps()
      .then((list) => !cancelled && setMaps(list))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '지도를 불러오지 못했어요.'))
    return () => {
      cancelled = true
      setMaps(null)
    }
  }, [userId])

  /** 새 지도: 기록이든 계획이든 처음엔 비공개 (빈 지도가 둘러보기에 뜨지 않게). 기록은 편집 화면에서 공개를 권한다 */
  const createMap = async (purpose: MapPurpose) => {
    if (creating) return
    setCreating(purpose)
    try {
      const map = await saveMap({ title: '', theme: 'default', isPublic: false, purpose })
      router.push(`/maps/${map.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '지도를 만들지 못했어요.')
      setCreating(null)
    }
  }

  const removeMap = async (map: ConceptMap) => {
    const shared = !!user && map.ownerId !== user.id
    const name = map.title || '제목 없는 지도'
    if (!window.confirm(shared ? `'${name}' 함께 꾸미기에서 나갈까요?` : `'${name}'을(를) 삭제할까요? 핀도 모두 사라져요.`)) return
    try {
      if (shared) await removeMapEditor(map.id, user!.id)
      else await deleteMap(map.id)
      setMaps((prev) => prev?.filter((m) => m.id !== map.id) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했어요.')
    }
  }

  const visible = maps?.filter((m) => filter === 'all' || mapPurpose(m) === filter) ?? []
  const allPicked = !!selected && visible.length > 0 && visible.every((m) => selected.has(m.id))

  const toggleOne = (map: ConceptMap) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(map.id)) next.delete(map.id)
      else next.add(map.id)
      return next
    })

  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(visible.map((m) => m.id)))

  /** 고른 지도를 한 번에: 내 지도는 삭제, 함께 꾸미던 남의 지도는 나가기 */
  const removeSelected = async () => {
    if (!user || !maps || !selected?.size || removing) return
    const picked = maps.filter((m) => selected.has(m.id))
    const sharedCount = picked.filter((m) => m.ownerId !== user.id).length
    const ownCount = picked.length - sharedCount
    const parts = [ownCount && `${ownCount}개 삭제`, sharedCount && `${sharedCount}개 함께 꾸미기에서 나가기`].filter(Boolean).join(', ')
    if (!window.confirm(`고른 지도 ${picked.length}개를 정리할까요? (${parts})${ownCount ? '\n삭제한 지도는 핀도 모두 사라지고 되돌릴 수 없어요.' : ''}`)) return
    setRemoving(true)
    setError('')
    const results = await Promise.allSettled(
      picked.map((m) => (m.ownerId !== user.id ? removeMapEditor(m.id, user.id) : deleteMap(m.id))),
    )
    const done = new Set(picked.filter((_, i) => results[i].status === 'fulfilled').map((m) => m.id))
    setMaps((prev) => prev?.filter((m) => !done.has(m.id)) ?? null)
    const failed = picked.length - done.size
    if (failed) {
      setError(`${failed}개는 정리하지 못했어요. 잠시 후 다시 시도해 주세요.`)
      setSelected(new Set(picked.filter((m) => !done.has(m.id)).map((m) => m.id)))
    } else {
      setSelected(null)
    }
    setRemoving(false)
  }

  // 로그인 안 했으면 서비스 소개
  if (user === null) return <LandingPage />

  return (
    <div className="relative min-h-dvh pb-16 pt-14 md:pb-0">
      <AppRail active="maps" />
      <MobileTabBar active="maps" />
      <Tour id="home" userId={user?.id} steps={HOME_TOUR} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-10 md:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-(--c-ink) pb-6">
          <div>
            <p className="tm-label dot">{user ? `${user.nickname}'s` : 'my'} collection · {String(maps?.length ?? 0).padStart(2, '0')}</p>
            <h1 className="tm-headline mt-3 text-5xl md:text-7xl">
              내 <em>지도</em>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2" data-tour="new-map">
            {MAP_PURPOSES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => createMap(p.id)}
                disabled={!!creating}
                title={p.hint}
                className={`tm-btn inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60 ${p.id === 'record' ? 'bg-(--c-accent) text-(--c-accent-text)' : 'bg-(--c-surface)'}`}
              >
                <PlusIcon size={18} />
                {creating === p.id ? '만드는 중…' : p.id === 'record' ? `${p.emoji} 기록 남기기` : `${p.emoji} 계획 짜기`}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <section className="mt-10">
          {maps === null && !error && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[260px] animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          )}

          {maps?.length === 0 && (
            <div className="flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-(--c-ink)/30 px-6 py-20 text-center">
              <div className="text-6xl" aria-hidden>🗺️</div>
              <h2 className="tm-headline mt-6 text-3xl">
                첫 <em>지도</em>를 그려 볼까요?
              </h2>
              <p className="mt-3 max-w-sm text-[0.9375rem] text-(--c-muted)">카페 투어, 빵지순례, 드라마 촬영지… 나만의 테마로 첫 지도를 꾸며 보세요.</p>
              <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
                {MAP_PURPOSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => createMap(p.id)}
                    disabled={!!creating}
                    className="tm-card rounded-2xl p-4 text-left transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <span className="text-2xl" aria-hidden>{p.emoji}</span>
                    <span className="mt-2 block font-bold">{creating === p.id ? '만드는 중…' : p.id === 'record' ? '다녀온 곳 기록하기' : '갈 곳 계획하기'}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-(--c-muted)">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {maps && maps.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5" role="tablist" aria-label="지도 용도">
              {([{ id: 'all', label: '전체', emoji: '' }, ...MAP_PURPOSES] as const).map((t) => {
                const n = t.id === 'all' ? maps.length : maps.filter((m) => mapPurpose(m) === t.id).length
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === t.id}
                    onClick={() => {
                      setFilter(t.id)
                      if (selected) setSelected(new Set()) // 안 보이는 지도가 몰래 지워지지 않게
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === t.id ? 'bg-(--c-ink) text-(--c-bg)' : 'text-(--c-muted) hover:text-(--c-text)'}`}
                  >
                    {t.emoji} {t.label} <span className="opacity-60">{n}</span>
                  </button>
                )
              })}
            </div>
            {selected ? (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="px-2 font-semibold" aria-live="polite">{selected.size}개 선택</span>
                <button type="button" onClick={toggleAll} className="rounded-full px-4 py-2 font-semibold text-(--c-muted) hover:text-(--c-text)">
                  {allPicked ? '전체 해제' : '전체 선택'}
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  disabled={!selected.size || removing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 font-bold text-white disabled:opacity-40"
                >
                  <TrashIcon size={15} />
                  {removing ? '정리하는 중…' : '삭제'}
                </button>
                <button type="button" onClick={() => setSelected(null)} disabled={removing} className="rounded-full px-4 py-2 font-semibold text-(--c-muted) hover:text-(--c-text)">
                  취소
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-full px-4 py-2 text-sm font-semibold text-(--c-muted) ring-1 ring-(--c-border) hover:text-(--c-text)">
                선택
              </button>
            )}
            </div>
          )}

          {maps && maps.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((m, i) => (
                <MapCard
                  key={m.id}
                  map={m}
                  index={i}
                  shared={!!user && m.ownerId !== user.id}
                  onDelete={removeMap}
                  onToggle={selected ? toggleOne : undefined}
                  selected={!!selected?.has(m.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
