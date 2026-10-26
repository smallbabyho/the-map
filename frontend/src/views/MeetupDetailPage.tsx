'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { CalendarIcon, ChevronLeftIcon, LinkIcon, PinIcon, UsersIcon } from '../components/icons'
import { MapView } from '../components/map'
import { useViewCourse, ViewModePicker, type ViewMode } from '../components/map/ViewModePicker'
import { formatMinutes, legLabel } from '../components/legModes'
import { TransitSteps } from '../components/TransitSteps'
import { dday, formatMeetAt, meetupState, STATE_BADGE } from '../components/meetup/format'
import { ReportButton } from '../components/report/ReportDialog'
import { KakaoDirectionsLink } from '../components/map/KakaoDirections'
import { KakaoShareButton } from '../components/share/KakaoShareButton'
import { getTheme, themeVars } from '../components/themes'
import { getMeetup, joinMeetup, leaveMeetup, setMeetupStatus } from '../db/api'
import { siteOrigin } from '../lib/site'
import type { MapDetail, MeetupStatus, MeetupSummary, Pin } from '../types'

const NO_PINS: Pin[] = []

export function MeetupLoading() {
  return <div className="h-dvh animate-pulse bg-black/[0.03]" />
}

/** 성지순례 모임 상세 */
export function MeetupDetailPage() {
  const { meetupId } = useParams<{ meetupId: string }>()
  // 비공개 모임 초대 링크: /meetups/{id}?invite=코드
  const invite = useSearchParams().get('invite') ?? undefined
  const router = useRouter()
  const user = useCurrentUser()
  const [meetup, setMeetup] = useState<MeetupSummary | null | undefined>(undefined)
  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  // 이동수단을 바꿔서 코스 보기 (화면에서만, 지도는 그대로)
  const [viewMode, setViewMode] = useState<ViewMode>('course')
  const view = useViewCourse(mapDetail?.pins ?? NO_PINS, mapDetail?.legs ?? [], viewMode)

  useEffect(() => {
    let cancelled = false
    getMeetup(meetupId, invite)
      .then((res) => {
        if (cancelled) return
        setMeetup(res?.meetup ?? null)
        setMapDetail(res?.mapDetail ?? null)
      })
      .catch(() => !cancelled && setMeetup(null))
    return () => {
      cancelled = true
    }
  }, [meetupId, invite])

  if (meetup === undefined) return <MeetupLoading />
  if (meetup === null) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <div className="text-5xl" aria-hidden>🧭</div>
          <h1 className="mt-4 text-lg font-bold">모임을 찾을 수 없어요</h1>
          <p className="mt-1 text-sm text-(--c-muted)">없어졌거나, 초대 링크를 받은 사람만 볼 수 있는 비공개 모임이에요.</p>
          <Link href="/meetups" className="mt-6 inline-block rounded-full bg-(--c-text) px-5 py-2.5 text-sm font-semibold text-(--c-surface)">성지순례 목록</Link>
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
  const join = () => (user ? run(() => joinMeetup(meetup.id, invite)) : router.push(`/login?next=${encodeURIComponent(`/meetups/${meetup.id}`)}`))
  const leave = () => window.confirm('참여를 취소할까요?') && run(() => leaveMeetup(meetup.id))
  const changeStatus = (s: MeetupStatus, msg: string) => window.confirm(msg) && run(() => setMeetupStatus(meetup.id, s))
  // 비공개 모임은 초대 코드를 붙여서 공유 (코드는 참여자에게만 내려온다)
  const sharePath = `/meetups/${meetup.id}${meetup.visibility === 'private' && meetup.inviteCode ? `?invite=${meetup.inviteCode}` : ''}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${siteOrigin()}${sharePath}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.')
    }
  }

  // 참여자(주최자 포함)는 순례방으로, 아니면 참여하기
  const primaryAction = joined ? (
    <div className="flex gap-2">
      <Link href={`/meetups/${meetup.id}/room`} className="tm-btn flex h-12 flex-1 items-center justify-center rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text)">
        💬 순례방 들어가기
      </Link>
      {!isHost && (
        <button type="button" onClick={leave} disabled={busy} className="h-12 shrink-0 rounded-xl border border-(--c-border) px-4 text-sm font-semibold transition hover:bg-black/[0.03] disabled:opacity-60">
          참여 취소
        </button>
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={join}
      disabled={busy || !canJoin}
      className="tm-btn h-12 w-full rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text) disabled:border-(--c-border) disabled:bg-(--c-border) disabled:text-(--c-muted) disabled:shadow-none"
    >
      {canJoin ? (user ? `참여하기 · ${left}자리 남음` : '로그인하고 참여하기') : badge.label}
    </button>
  )

  return (
    <div className="relative min-h-dvh pb-28 md:pb-0 pt-14" style={themeVars(theme)}>
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
                  legs={view.legs}
                  theme={theme}
                  look={mapDetail.map}
                  selectedPinId={selectedPinId}
                  onSelectPin={(id) => setSelectedPinId((c) => (c === id ? null : id))}
                />
              ) : (
                <div className="grid h-full place-items-center bg-black/[0.03] text-sm text-(--c-muted)">지도가 삭제됐어요</div>
              )}
            </div>

            {mapDetail && mapDetail.pins.length > 1 && <ViewModePicker value={viewMode} onChange={setViewMode} className="mt-3" />}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
              <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-bold">{dday(meetup.meetAt)}</span>
              {meetup.visibility === 'private' && <span className="rounded-full bg-(--c-ink) px-2.5 py-1 text-xs font-bold text-(--c-bg)">🔒 친구끼리</span>}
            </div>
            <h1 className="tm-headline mt-3 text-4xl md:text-5xl">{meetup.title}</h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-(--c-muted)">
              <Avatar id={meetup.host.id} nickname={meetup.host.nickname} src={meetup.host.avatarUrl} size={24} />
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
                  {view.totalMin > 0 && (
                    <span className="text-sm text-(--c-muted)">
                      이동 {view.loading ? '계산 중…' : `약 ${formatMinutes(view.totalMin)}`}
                    </span>
                  )}
                </div>
                <ol className="mt-3 space-y-2">
                  {mapDetail.pins.map((p, i) => {
                    const next = mapDetail.pins[i + 1]
                    const legMode = next && view.modeOf(p.id, next.id)
                    const transit = next && view.transitOf(p.id, next.id)
                    return (
                      <Fragment key={p.id}>
                        <li className={`flex items-center rounded-xl border pr-1 transition ${selectedPinId === p.id ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border) bg-(--c-surface)'}`}>
                          <button
                            type="button"
                            onClick={() => setSelectedPinId(p.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-full text-lg" style={{ background: p.color }}>{p.icon}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">{i + 1}. {p.place.name}</span>
                              {p.memo && <span className="block truncate text-[13px] text-(--c-muted)">{p.memo}</span>}
                            </span>
                          </button>
                          <KakaoDirectionsLink to={p.place} from={mapDetail.pins[i - 1]?.place} mode={i > 0 ? view.modeOf(mapDetail.pins[i - 1].id, p.id) : undefined} />
                        </li>
                        {legMode && (
                          <li className="ml-[30px] border-l-2 border-dotted border-(--c-border) py-1 pl-5 text-xs text-(--c-muted)">
                            {legLabel(legMode, view.durationOf(p.id, next.id))}
                            {transit && <TransitSteps info={transit} className="mt-1.5 text-(--c-text)" />}
                          </li>
                        )}
                      </Fragment>
                    )
                  })}
                </ol>
              </section>
            )}

            {/* 순례방 안내 (채팅 · 도착 체크는 참여자 전용 방에서) */}
            <section className="mt-8 rounded-2xl border border-(--c-border) bg-(--c-surface) p-5">
              <h2 className="text-lg font-bold">💬 순례방</h2>
              <p className="mt-1 text-sm leading-relaxed text-(--c-muted)">
                참여자끼리만 쓰는 방이에요. 실시간으로 채팅하고, 코스를 돌며 장소마다 도착 체크를 하면 서로 어디쯤인지 보여요.
              </p>
              {joined ? (
                <Link href={`/meetups/${meetup.id}/room`} className="mt-4 inline-flex h-10 items-center rounded-full bg-(--c-accent) px-5 text-sm font-bold text-(--c-accent-text)">
                  순례방 들어가기 →
                </Link>
              ) : (
                <p className="mt-3 text-sm font-semibold">모임에 참여하면 순례방이 열려요.</p>
              )}
            </section>

            {/* 참여자 */}
            <section className="mt-8">
              <h2 className="text-lg font-bold">
                참여자 <span className="text-(--c-accent)">{meetup.members.length}</span>
                <span className="text-base font-medium text-(--c-muted)"> / {meetup.capacity}명</span>
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {meetup.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2.5 rounded-xl border border-(--c-border) bg-(--c-surface) px-3 py-2.5">
                    <Avatar id={m.userId} nickname={m.nickname} src={m.avatarUrl} size={32} />
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

              <KakaoShareButton
                className="mt-3"
                title={meetup.title}
                description={`${formatMeetAt(meetup.meetAt)} · ${meetup.meetPoint} · ${meetup.members.length}/${meetup.capacity}명`}
                path={sharePath}
                theme={meetup.map.theme}
                course={(mapDetail?.pins ?? []).map((p) => p.place)}
                buttonTitle="모임 보러 가기"
                onError={setError}
              />
              <button type="button" onClick={copyLink} className="mt-1 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-(--c-muted) hover:bg-black/[0.03]">
                <LinkIcon size={16} />
                {copied ? '링크를 복사했어요' : meetup.visibility === 'private' ? '초대 링크 복사' : '모임 링크 복사'}
              </button>
              {!isHost && (
                <div className="mt-2 text-center">
                  <ReportButton subject={{ target: 'meetup', targetId: meetup.id, targetLabel: meetup.title, targetUserId: meetup.hostId }} label="이 모임 신고하기" />
                </div>
              )}
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
