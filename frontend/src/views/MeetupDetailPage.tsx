'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { CalendarIcon, ChevronLeftIcon, LinkIcon, PinIcon, UsersIcon } from '../components/icons'
import { MapView } from '../components/map'
import { dday, formatMeetAt, meetupState, STATE_BADGE } from '../components/meetup/format'
import { getTheme, themeVars } from '../components/themes'
import { getMeetup, joinMeetup, leaveMeetup, setMeetupStatus } from '../db/api'
import type { MapDetail, MeetupStatus, MeetupSummary } from '../types'

export function MeetupLoading() {
  return <div className="h-dvh animate-pulse bg-black/[0.03]" />
}

/** 성지순례 모임 상세 */
export function MeetupDetailPage() {
  const { meetupId } = useParams<{ meetupId: string }>()
  const router = useRouter()
  const user = useCurrentUser()
  const [meetup, setMeetup] = useState<MeetupSummary | null | undefined>(undefined)
  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMeetup(meetupId)
      .then((res) => {
        if (cancelled) return
        setMeetup(res?.meetup ?? null)
        setMapDetail(res?.mapDetail ?? null)
      })
      .catch(() => !cancelled && setMeetup(null))
    return () => {
      cancelled = true
    }
  }, [meetupId])

  if (meetup === undefined) return <MeetupLoading />
  if (meetup === null) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <div className="text-5xl" aria-hidden>🧭</div>
          <h1 className="mt-4 text-lg font-bold">모임을 찾을 수 없어요</h1>
          <Link href="/meetups" className="mt-6 inline-block rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white">성지순례 목록</Link>
        </div>
      </div>
    )
  }

  const theme = getTheme(meetup.map.theme)
  const state = meetupState(meetup)
  const badge = STATE_BADGE[state]
  const isHost = user?.id === meetup.hostId
  const joined = !!user && meetup.members.some((m) => m.userId === user.id)
  const left = meetup.capacity - meetup.members.length
  const canJoin = state === 'open' || state === 'almost'
  const legs = mapDetail?.legs ?? []
  const totalMin = legs.reduce((s, l) => s + (l.durationMin ?? 0), 0)

  const run = async (fn: () => Promise<MeetupSummary>) => {
    setBusy(true)
    setError('')
    try {
      setMeetup(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const join = () => (user ? run(() => joinMeetup(meetup.id)) : router.push(`/login?next=${encodeURIComponent(`/meetups/${meetup.id}`)}`))
  const leave = () => window.confirm('참여를 취소할까요?') && run(() => leaveMeetup(meetup.id))
  const changeStatus = (s: MeetupStatus, msg: string) => window.confirm(msg) && run(() => setMeetupStatus(meetup.id, s))
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.')
    }
  }

  const primaryAction = isHost ? null : joined ? (
    <button type="button" onClick={leave} disabled={busy} className="h-12 w-full rounded-xl border border-(--c-border) text-[15px] font-bold transition hover:bg-black/[0.03] disabled:opacity-60">
      참여 취소
    </button>
  ) : (
    <button
      type="button"
      onClick={join}
      disabled={busy || !canJoin}
      className="h-12 w-full rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text) transition hover:opacity-90 disabled:bg-gray-300 disabled:text-gray-600"
    >
      {canJoin ? (user ? `참여하기 · ${left}자리 남음` : '로그인하고 참여하기') : badge.label}
    </button>
  )

  return (
    <div className="relative min-h-dvh pb-28 md:pb-0 md:pl-[72px]" style={themeVars(theme)}>
      <AppRail active="meetups" />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-10 md:pt-8">
        <Link href="/meetups" className="inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-(--c-muted) hover:text-(--c-text)">
          <ChevronLeftIcon size={16} />
          성지순례
        </Link>

        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* 왼쪽: 지도 + 소개 */}
          <div className="min-w-0">
            <div className="relative h-[260px] overflow-hidden rounded-2xl border border-(--c-border) md:h-[400px]">
              {mapDetail ? (
                <MapView
                  pins={mapDetail.pins}
                  legs={legs}
                  theme={theme}
                  selectedPinId={selectedPinId}
                  onSelectPin={(id) => setSelectedPinId((c) => (c === id ? null : id))}
                />
              ) : (
                <div className="grid h-full place-items-center bg-black/[0.03] text-sm text-(--c-muted)">지도가 삭제됐어요</div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
              <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-bold">{dday(meetup.meetAt)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight md:text-[28px]">{meetup.title}</h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-(--c-muted)">
              <Avatar id={meetup.host.id} nickname={meetup.host.nickname} size={24} />
              <span>
                <b className="font-semibold text-(--c-text)">{meetup.host.nickname}</b> 님이 열었어요
              </span>
            </div>
            {meetup.description && <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{meetup.description}</p>}

            {/* 코스 */}
            {mapDetail && mapDetail.pins.length > 0 && (
              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold">순례 코스 · {mapDetail.map.title}</h2>
                  {totalMin > 0 && <span className="text-sm text-(--c-muted)">이동 약 {totalMin}분</span>}
                </div>
                <ol className="mt-3 space-y-2">
                  {mapDetail.pins.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPinId(p.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selectedPinId === p.id ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border) bg-(--c-surface) hover:bg-black/[0.02]'}`}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full text-lg" style={{ background: p.color }}>{p.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{i + 1}. {p.place.name}</span>
                          {p.memo && <span className="block truncate text-[13px] text-(--c-muted)">{p.memo}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* 참여자 */}
            <section className="mt-8">
              <h2 className="text-lg font-bold">
                참여자 <span className="text-(--c-accent)">{meetup.members.length}</span>
                <span className="text-base font-medium text-(--c-muted)"> / {meetup.capacity}명</span>
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {meetup.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2.5 rounded-xl border border-(--c-border) bg-(--c-surface) px-3 py-2.5">
                    <Avatar id={m.userId} nickname={m.nickname} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{m.nickname}{m.userId === user?.id && ' (나)'}</span>
                      <span className="text-xs text-(--c-muted)">{m.userId === meetup.hostId ? '주최자' : '참여자'}</span>
                    </span>
                  </li>
                ))}
                {Array.from({ length: Math.max(0, left) }).slice(0, 6).map((_, i) => (
                  <li key={`empty-${i}`} className="grid place-items-center rounded-xl border border-dashed border-(--c-border) py-4 text-xs text-(--c-muted)">빈 자리</li>
                ))}
              </ul>
            </section>
          </div>

          {/* 오른쪽: 요약 + 참여 (데스크톱 고정) */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-(--c-border) bg-(--c-surface) p-5">
              <dl className="space-y-4 text-[15px]">
                <Info icon={<CalendarIcon size={18} />} label="언제">{formatMeetAt(meetup.meetAt)}</Info>
                <Info icon={<PinIcon size={18} />} label="어디서">{meetup.meetPoint}</Info>
                <Info icon={<UsersIcon size={18} />} label="인원">
                  {meetup.members.length} / {meetup.capacity}명
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <span className="block h-full rounded-full bg-(--c-accent)" style={{ width: `${Math.min(100, (meetup.members.length / meetup.capacity) * 100)}%` }} />
                  </span>
                </Info>
              </dl>

              {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">{error}</p>}

              <div className="mt-5 hidden space-y-2 md:block">{primaryAction}</div>

              {isHost && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold text-(--c-muted)">주최자 메뉴</p>
                  {meetup.status === 'open' && state !== 'past' && (
                    <button type="button" disabled={busy} onClick={() => changeStatus('closed', '모집을 마감할까요? 더 이상 참여할 수 없어요.')} className="h-11 w-full rounded-xl border border-(--c-border) text-sm font-semibold hover:bg-black/[0.03]">
                      모집 마감
                    </button>
                  )}
                  {meetup.status === 'closed' && state !== 'past' && (
                    <button type="button" disabled={busy} onClick={() => changeStatus('open', '다시 모집할까요?')} className="h-11 w-full rounded-xl border border-(--c-border) text-sm font-semibold hover:bg-black/[0.03]">
                      다시 모집하기
                    </button>
                  )}
                  {meetup.status !== 'canceled' && (
                    <button type="button" disabled={busy} onClick={() => changeStatus('canceled', '모임을 취소할까요? 참여자에게는 취소된 모임으로 보여요.')} className="h-11 w-full rounded-xl text-sm font-semibold text-red-500 hover:bg-red-500/10">
                      모임 취소
                    </button>
                  )}
                </div>
              )}

              <button type="button" onClick={copyLink} className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-(--c-muted) hover:bg-black/[0.03]">
                <LinkIcon size={16} />
                {copied ? '링크를 복사했어요' : '모임 링크 복사'}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* 모바일 하단 참여 버튼 */}
      {primaryAction && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--c-border) bg-(--c-surface)/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">{primaryAction}</div>
      )}
    </div>
  )
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-(--c-accent)">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold text-(--c-muted)">{label}</dt>
        <dd className="mt-0.5 font-semibold">{children}</dd>
      </div>
    </div>
  )
}
