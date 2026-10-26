'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { MapCard } from '../components/MapCard'
import { PlusIcon } from '../components/icons'
import { Tour, type TourStep } from '../components/onboarding/Tour'
import { useCurrentUser } from '../auth'
import { deleteMap, getMyMaps, removeMapEditor, saveMap } from '../db/api'
import { LandingPage } from './LandingPage'
import type { ConceptMap } from '../types'

/** 처음 로그인한 사람에게 한 번 보여주는 안내 */
const HOME_TOUR: TourStep[] = [
  { title: 'My Concept Map에 오신 걸 환영해요 👋', body: '가고 싶은 곳은 계획하고, 사랑했던 곳은 기록하는 나만의 지도예요. 주요 기능을 짧게 알려드릴게요.' },
  { target: 'new-map', title: '새 지도 만들기', body: '빵지순례, 데이트 코스, 지난 여행 기록까지. 테마 하나로 지도를 시작해요.' },
  { target: 'nav-meetups', title: '성지순례', body: '지도 하나로 모임을 열고 함께 떠날 사람을 모아요.' },
  { target: 'nav-explore', title: '둘러보기', body: '다른 사람의 지도를 구경하고, 마음에 들면 내 지도로 가져와요.' },
  { target: 'nav-profile', title: '내 프로필', body: '다이어리처럼 꾸미고, 공개한 지도를 모아 보여줘요.' },
]

export function MyMapsPage() {
  const router = useRouter()
  const user = useCurrentUser()
  const [maps, setMaps] = useState<ConceptMap[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

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
          <button
            type="button"
            onClick={createMap}
            disabled={creating}
            data-tour="new-map"
            className="tm-btn inline-flex items-center gap-1.5 rounded-full bg-(--c-accent) px-5 py-3 text-sm font-bold text-(--c-accent-text) disabled:opacity-60"
          >
            <PlusIcon size={18} />
            {creating ? '만드는 중…' : '새 지도 만들기'}
          </button>
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
              <p className="mt-3 max-w-sm text-[15px] text-(--c-muted)">카페 투어, 빵지순례, 드라마 촬영지… 나만의 테마로 첫 지도를 꾸며 보세요.</p>
              <button
                type="button"
                onClick={createMap}
                disabled={creating}
                className="tm-btn mt-8 inline-flex items-center gap-1.5 rounded-full bg-(--c-accent) px-6 py-3 text-sm font-bold text-(--c-accent-text) disabled:opacity-60"
              >
                <PlusIcon size={18} />첫 지도 만들기
              </button>
            </div>
          )}

          {maps && maps.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {maps.map((m, i) => (
                <MapCard key={m.id} map={m} index={i} shared={!!user && m.ownerId !== user.id} onDelete={removeMap} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
