'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon, CopyIcon, UsersIcon } from '../components/icons'
import { legLabel } from '../components/legModes'
import { MapView, useRoutes, type MapInsets } from '../components/map'
import { getTheme, themeVars } from '../components/themes'
import { TransitSteps } from '../components/TransitSteps'
import { copyMap, getUser } from '../db/api'
import type { MapDetail, Pin, User } from '../types'

const RAIL_W = 72
const PANEL_W = 380
const at = (p: Pin) => ({ lat: p.place.lat, lng: p.place.lng })

/** 남의 공개 지도 (읽기 전용): 코스 보기 · 내 지도로 가져오기 · 성지순례 모집 */
export function MapViewer({ detail }: { detail: MapDetail }) {
  const router = useRouter()
  const me = useCurrentUser()
  const { map, pins, legs } = detail
  const theme = getTheme(map.theme)
  const [owner, setOwner] = useState<User | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    getUser(map.ownerId).then(setOwner)
  }, [map.ownerId])
  useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const here = `/maps/${map.id}`
  const takeIt = async () => {
    if (!me) return router.push(`/login?next=${encodeURIComponent(here)}`)
    setBusy(true)
    setError('')
    try {
      const mine = await copyMap(map.id)
      router.push(`/maps/${mine.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오지 못했어요.')
      setBusy(false)
    }
  }
  const meetupHref = me ? `/meetups/new?mapId=${map.id}` : `/login?next=${encodeURIComponent(`/meetups/new?mapId=${map.id}`)}`
  const totalMin = legs.reduce((s, l) => s + (l.durationMin ?? 0), 0)
  const legAfter = (pinId: string) => legs.find((l) => l.fromPinId === pinId)
  // 대중교통 구간의 버스·지하철 정보 (지도와 같은 길찾기 결과를 공유)
  const transitLegs = pins.slice(1).flatMap((to, i) => {
    const leg = legAfter(pins[i].id)
    return leg?.mode === 'transit' && leg.toPinId === to.id ? [{ pinId: pins[i].id, from: at(pins[i]), to: at(to) }] : []
  })
  const { routeOf } = useRoutes(transitLegs.map((t) => ({ ...t, mode: 'transit' as const })))
  const transitAfter = (pinId: string) => {
    const t = transitLegs.find((x) => x.pinId === pinId)
    return t ? routeOf(t.from, t.to, 'transit')?.transit : undefined
  }
  const insets: MapInsets = desktop ? { top: 0, right: 0, bottom: 0, left: RAIL_W + PANEL_W } : { top: 0, right: 0, bottom: 0, left: 0 }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-(--c-bg) text-(--c-text) md:block" style={themeVars(theme)}>
      <AppRail active="ranking" />

      {/* 지도: 모바일은 위쪽, 데스크톱은 전체 */}
      <div className="relative h-[42dvh] shrink-0 md:absolute md:inset-0 md:h-auto">
        <MapView pins={pins} legs={legs} theme={theme} selectedPinId={selectedId} onSelectPin={(id) => setSelectedId((c) => (c === id ? null : id))} insets={insets} />
        <button type="button" onClick={() => router.back()} className="tm-float absolute left-3 top-3 z-20 grid size-10 place-items-center rounded-full bg-white text-gray-800 md:hidden" aria-label="뒤로">
          <ChevronLeftIcon size={20} />
        </button>
      </div>

      {/* 정보 패널 */}
      <section
        className="tm-scroll relative z-20 min-h-0 flex-1 overflow-y-auto bg-(--c-surface) md:absolute md:inset-y-0 md:border-r md:border-(--c-border) md:shadow-[4px_0_24px_rgb(15_23_42/0.06)]"
        style={desktop ? { left: RAIL_W, width: PANEL_W } : undefined}
      >
        <div className="px-5 pb-6 pt-5">
          <button type="button" onClick={() => router.back()} className="-ml-1.5 hidden items-center gap-0.5 rounded-lg py-1 pl-1 pr-2 text-sm text-(--c-muted) hover:bg-black/5 md:flex">
            <ChevronLeftIcon size={16} />
            뒤로
          </button>
          <p className="mt-2 text-xs font-semibold text-(--c-accent)">{theme.name} 테마 · 공개 지도</p>
          <h1 className="mt-1 text-2xl font-bold leading-snug tracking-tight">{map.title || '제목 없는 지도'}</h1>
          {owner && (
            <p className="mt-2 flex items-center gap-2 text-sm text-(--c-muted)">
              <Avatar id={owner.id} nickname={owner.nickname} size={22} />
              <b className="font-semibold text-(--c-text)">{owner.nickname}</b> 님의 지도
            </p>
          )}
          <p className="mt-3 text-sm text-(--c-muted)">
            장소 {pins.length}곳{totalMin > 0 && ` · 이동 약 ${totalMin}분`}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={takeIt} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-(--c-accent) text-sm font-bold text-(--c-accent-text) transition hover:opacity-90 disabled:opacity-60">
              <CopyIcon size={16} />
              {busy ? '가져오는 중…' : '내 지도로 가져오기'}
            </button>
            <Link href={meetupHref} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-(--c-border) text-sm font-bold transition hover:bg-black/[0.03]">
              <UsersIcon size={16} />
              성지순례 모집
            </Link>
          </div>
          <p className="mt-2 text-xs text-(--c-muted)">가져오거나 이 지도로 순례하면 이번 달 지도 순위에 반영돼요.</p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">{error}</p>}
        </div>

        <ol className="border-t border-(--c-border) px-3 py-3">
          {pins.map((p, i) => {
            const leg = legAfter(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${selectedId === p.id ? 'bg-(--c-accent)/10' : 'hover:bg-black/[0.03]'}`}
                >
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full text-lg shadow-sm ring-2 ring-white" style={{ background: p.color }}>
                    {p.icon}
                    <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white ring-2 ring-white">{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.place.name}</span>
                    {p.memo && <span className="block truncate text-[13px] text-(--c-muted)">{p.memo}</span>}
                  </span>
                  {p.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL/외부 URL 미리보기
                    <img src={p.photoUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                  )}
                </button>
                {leg && i < pins.length - 1 && (
                  <div className="ml-[27px] border-l-2 border-dotted border-(--c-border) py-1.5 pl-6 text-xs text-(--c-muted)">
                    {legLabel(leg.mode, leg.durationMin)}
                    {transitAfter(p.id) && <TransitSteps info={transitAfter(p.id)!} className="mt-1.5 text-(--c-text)" />}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
