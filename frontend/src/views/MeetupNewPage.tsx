'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail } from '../components/AppRail'
import { ChevronLeftIcon } from '../components/icons'
import { MapThumb } from '../components/MapThumb'
import { toLocalInput } from '../components/meetup/format'
import { getMap, getMyMaps, saveMeetup } from '../db/api'
import type { ConceptMap, MapDetail } from '../types'

/** 성지순례 모임 만들기. ?mapId= 로 지도를 미리 고를 수 있다 (내 지도 또는 남의 공개 지도). */
export function MeetupNewPage() {
  const router = useRouter()
  const params = useSearchParams()
  const presetMapId = params.get('mapId')
  const user = useCurrentUser()

  const [myMaps, setMyMaps] = useState<ConceptMap[] | null>(null)
  const [mapId, setMapId] = useState<string>(presetMapId ?? '')
  const [detail, setDetail] = useState<MapDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // 기본값: 3일 뒤 오전 11시 / 지금보다 이전은 고를 수 없음
  const [minTime] = useState(() => toLocalInput(new Date()))
  const [meetAt, setMeetAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    d.setHours(11, 0, 0, 0)
    return toLocalInput(d)
  })
  const [meetPoint, setMeetPoint] = useState('')
  const [capacity, setCapacity] = useState(6)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 로그인 필요
  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(`/meetups/new${presetMapId ? `?mapId=${presetMapId}` : ''}`)}`)
  }, [user, router, presetMapId])

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getMyMaps().then((l) => {
      if (cancelled) return
      setMyMaps(l)
      setMapId((cur) => cur || l[0]?.id || '')
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // 고른 지도의 핀 → 모이는 곳 기본값
  useEffect(() => {
    if (!mapId) return
    let cancelled = false
    getMap(mapId).then((d) => {
      if (cancelled) return
      setDetail(d)
      if (d?.pins[0]) setMeetPoint((cur) => cur || d.pins[0].place.name)
      if (d) setTitle((cur) => cur || `${d.map.title || '우리 지도'} 같이 걸어요`)
    })
    return () => {
      cancelled = true
    }
  }, [mapId])

  const otherMap = detail && user && detail.map.ownerId !== user.id ? detail.map : null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!mapId) return setError('순례할 지도를 골라 주세요.')
    setBusy(true)
    try {
      const m = await saveMeetup({ mapId, title, description, meetAt, meetPoint, capacity })
      router.push(`/meetups/${m.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '모임을 만들지 못했어요.')
      setBusy(false)
    }
  }

  const label = 'mb-2 block text-sm font-semibold'
  const field = 'h-12 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-4 text-[15px] outline-none transition focus:border-(--c-accent)'

  if (!user) return <div className="h-dvh" />

  return (
    <div className="relative min-h-dvh md:pl-[72px]">
      <AppRail active="meetups" />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
        <Link href="/meetups" className="inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-(--c-muted) hover:text-(--c-text)">
          <ChevronLeftIcon size={16} />
          성지순례
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">모임 만들기</h1>
        <p className="mt-1.5 text-sm text-(--c-muted)">지도를 고르고 날짜를 정하면, 다른 사람들이 보고 참여할 수 있어요.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-7" noValidate>
          {/* 지도 고르기 */}
          <section>
            <span className={label}>순례할 지도</span>
            {otherMap && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border-2 border-(--c-accent) bg-(--c-accent)/5 p-3">
                <MapThumb id={otherMap.id} theme={otherMap.theme} className="h-14 w-20 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{otherMap.title}</p>
                  <p className="text-xs text-(--c-muted)">다른 사람의 공개 지도 · 장소 {detail?.pins.length ?? 0}곳</p>
                </div>
              </div>
            )}
            {myMaps === null ? (
              <div className="h-24 animate-pulse rounded-xl bg-black/5" />
            ) : myMaps.length === 0 && !otherMap ? (
              <div className="rounded-xl border border-dashed border-(--c-border) p-5 text-center text-sm text-(--c-muted)">
                아직 내 지도가 없어요.{' '}
                <Link href="/" className="font-semibold text-(--c-accent)">지도 만들기</Link> 또는{' '}
                <Link href="/ranking" className="font-semibold text-(--c-accent)">인기 지도</Link>에서 골라 보세요.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {myMaps.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMapId(m.id)
                      setMeetPoint('')
                      setTitle('')
                    }}
                    className={`overflow-hidden rounded-xl border-2 text-left transition ${mapId === m.id ? 'border-(--c-accent)' : 'border-(--c-border) hover:border-black/20'}`}
                    aria-pressed={mapId === m.id}
                  >
                    <MapThumb id={m.id} theme={m.theme} className="h-16" />
                    <span className="block truncate px-2.5 py-2 text-sm font-semibold">{m.title || '제목 없는 지도'}</span>
                  </button>
                ))}
              </div>
            )}
            {detail && detail.pins.length === 0 && <p className="mt-2 text-xs text-orange-600">이 지도에는 아직 장소가 없어요. 핀을 추가하면 코스가 보여요.</p>}
          </section>

          <section>
            <label htmlFor="mt-title" className={label}>모임 이름</label>
            <input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="예: 토요일 성수 빵지순례 같이 돌아요" className={field} />
          </section>

          <div className="grid gap-7 sm:grid-cols-2">
            <section>
              <label htmlFor="mt-at" className={label}>언제</label>
              <input id="mt-at" type="datetime-local" value={meetAt} min={minTime} onChange={(e) => setMeetAt(e.target.value)} className={field} />
            </section>
            <section>
              <label htmlFor="mt-cap" className={label}>정원 (나 포함)</label>
              <div className="flex h-12 items-center rounded-xl border border-(--c-border) bg-(--c-surface)">
                <button type="button" onClick={() => setCapacity((c) => Math.max(2, c - 1))} className="h-full w-12 text-xl text-(--c-muted)" aria-label="정원 줄이기">−</button>
                <input id="mt-cap" type="number" min={2} max={50} value={capacity} onChange={(e) => setCapacity(Math.max(2, Math.min(50, Number(e.target.value) || 2)))} className="w-full bg-transparent text-center text-[15px] font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                <button type="button" onClick={() => setCapacity((c) => Math.min(50, c + 1))} className="h-full w-12 text-xl text-(--c-muted)" aria-label="정원 늘리기">+</button>
              </div>
            </section>
          </div>

          <section>
            <label htmlFor="mt-point" className={label}>모이는 곳</label>
            <input id="mt-point" value={meetPoint} onChange={(e) => setMeetPoint(e.target.value)} maxLength={60} placeholder="예: 성수역 3번 출구" className={field} />
            {detail && detail.pins.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.pins.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" onClick={() => setMeetPoint(p.place.name)} className="rounded-full border border-(--c-border) bg-(--c-surface) px-3 py-1 text-xs hover:border-(--c-accent)">
                    {p.icon} {p.place.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <label htmlFor="mt-desc" className={label}>소개 <span className="font-normal text-(--c-muted)">(선택)</span></label>
            <textarea id="mt-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={1000} placeholder="어떤 분과 함께하고 싶은지, 준비물, 코스 설명 등을 적어 주세요." className="w-full resize-none rounded-xl border border-(--c-border) bg-(--c-surface) px-4 py-3 text-[15px] outline-none focus:border-(--c-accent)" />
          </section>

          {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className="h-14 w-full rounded-2xl bg-(--c-text) text-base font-bold text-(--c-surface) transition hover:opacity-90 disabled:opacity-60">
            {busy ? '만드는 중…' : '모임 열기'}
          </button>
        </form>
      </main>
    </div>
  )
}
