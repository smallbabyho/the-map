'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon } from '../components/icons'
import { dday, formatMeetAt } from '../components/meetup/format'
import { RoomChat } from '../components/meetup/RoomChat'
import { RoomCourse, RoomMembers } from '../components/meetup/RoomCourse'
import { getTheme, themeVars } from '../components/themes'
import { getMeetup, getMeetupCheckins, getMeetupComments, getMeetupCourseMap, kickMeetupMember, setMeetupCheckin, subscribeMeetupRoom } from '../db/api'
import type { ArrivalProof, MapDetail, MeetupCheckin, MeetupComment, MeetupSummary } from '../types'

type Tab = 'chat' | 'course' | 'members'
const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: '💬 채팅' },
  { id: 'course', label: '🗺️ 코스 · 도착' },
  { id: 'members', label: '👥 멤버' },
]

/**
 * 순례방 (/meetups/[id]/room): 모임 참여자끼리만 들어오는 방.
 * 채팅(공지 · 사진 · 후기) + 코스와 도착 체크 + 멤버별 진행. 채팅 · 도착 체크는 실시간으로 바뀐다.
 * 데스크톱은 채팅 | 코스 · 멤버 두 칸, 모바일은 탭.
 */
export function MeetupRoomPage() {
  const { meetupId } = useParams<{ meetupId: string }>()
  const me = useCurrentUser()
  const [meetup, setMeetup] = useState<MeetupSummary | null | undefined>(undefined)
  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null)
  const [messages, setMessages] = useState<MeetupComment[] | null>(null)
  const [checkins, setCheckins] = useState<MeetupCheckin[]>([])
  const [tab, setTab] = useState<Tab>('chat')
  const [busyPinId, setBusyPinId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const [openingEditor, setOpeningEditor] = useState(false)

  const [version, setVersion] = useState(0)
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
  }, [meetupId, version])

  /** 참여자 누구나: 편집 화면에서 코스 고치기 (남의 지도로 연 모임이면 모임 전용 코스로 복사된다) */
  const editCourse = async () => {
    if (openingEditor) return
    setOpeningEditor(true)
    setError('')
    try {
      const mapId = await getMeetupCourseMap(meetupId)
      router.push(`/maps/${mapId}?meetup=${meetupId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '코스 편집을 열지 못했어요.')
      setOpeningEditor(false)
    }
  }

  /** 주최자: 강제 퇴장 (다시 참여 못 함) */
  const kick = async (userId: string, nickname: string) => {
    if (!window.confirm(`${nickname} 님을 내보낼까요? 이 모임에 다시 참여할 수 없어요.`)) return
    setError('')
    try {
      await kickMeetupMember(meetupId, userId)
      setVersion((v) => v + 1)
      setCheckins(await getMeetupCheckins(meetupId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내지 못했어요.')
    }
  }

  const member = !!me && !!meetup?.members.some((m) => m.userId === me.id)

  // 채팅 · 도착 체크 불러오기 + 실시간으로 바뀌면 다시
  const reload = useCallback(() => {
    getMeetupComments(meetupId).then(setMessages).catch(() => setMessages([]))
    getMeetupCheckins(meetupId).then(setCheckins).catch(() => {})
  }, [meetupId])
  useEffect(() => {
    if (!member) return
    reload()
    return subscribeMeetupRoom(meetupId, reload)
  }, [member, meetupId, reload])

  const uncheck = async (pinId: string) => {
    setBusyPinId(pinId)
    setError('')
    try {
      await setMeetupCheckin(meetupId, pinId, false)
      setCheckins(await getMeetupCheckins(meetupId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '체크를 풀지 못했어요.')
    } finally {
      setBusyPinId(null)
    }
  }

  /** 도착 인증: 실패 메시지는 인증 창이 보여 준다 */
  const arrive = async (pinId: string, proof: ArrivalProof) => {
    await setMeetupCheckin(meetupId, pinId, true, proof)
    setCheckins(await getMeetupCheckins(meetupId))
  }

  if (meetup === undefined || me === undefined) return <div className="h-dvh animate-pulse bg-black/[0.03]" />

  // 못 들어오는 경우: 모임이 없음 · 로그인 안 함 · 참여 안 함
  if (meetup === null || !me || !member) {
    const next = `/meetups/${meetupId}/room`
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <div className="text-5xl" aria-hidden>🔒</div>
          <h1 className="mt-4 text-lg font-bold">{meetup === null ? '모임을 찾을 수 없어요' : '순례방은 참여한 사람만 들어올 수 있어요'}</h1>
          <p className="mt-1 text-sm text-(--c-muted)">{meetup === null ? '없어졌거나 비공개 모임이에요.' : '모임에 참여하면 채팅과 코스 도착 체크를 함께 쓸 수 있어요.'}</p>
          <div className="mt-6 flex justify-center gap-2">
            {!me && meetup && (
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="rounded-full bg-(--c-accent) px-5 py-2.5 text-sm font-bold text-(--c-accent-text)">
                로그인
              </Link>
            )}
            <Link href={meetup ? `/meetups/${meetupId}` : '/meetups'} className="rounded-full border border-(--c-border) px-5 py-2.5 text-sm font-semibold">
              {meetup ? '모임 보러 가기' : '성지순례 목록'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const theme = getTheme(meetup.map.theme)
  const side = (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">{error}</p>}
      <section className={tab === 'members' ? 'hidden md:block' : ''}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">코스 · 도착 체크</h2>
          {meetup.status !== 'canceled' && (
            <button
              type="button"
              onClick={editCourse}
              disabled={openingEditor}
              className="shrink-0 rounded-full border border-(--c-border) px-3 py-1.5 text-xs font-bold transition hover:border-(--c-accent) hover:text-(--c-accent) disabled:opacity-50"
              title="장소 추가 · 삭제 · 순서 바꾸기 (참여자 누구나)"
            >
              {openingEditor ? '여는 중…' : '✏️ 코스 고치기'}
            </button>
          )}
        </div>
        {mapDetail && mapDetail.pins.length > 0 ? (
          <RoomCourse mapDetail={mapDetail} me={me} members={meetup.members} checkins={checkins} onUncheck={uncheck} onArrive={arrive} busyPinId={busyPinId} meetAt={meetup.meetAt} />
        ) : (
          <p className="rounded-xl bg-black/[0.03] px-4 py-6 text-center text-sm text-(--c-muted)">지도가 삭제됐거나 장소가 없어요.</p>
        )}
      </section>
      <section className={tab === 'course' ? 'hidden md:block' : ''}>
        <h2 className="mb-3 text-base font-bold">
          멤버 <span className="text-(--c-accent)">{meetup.members.length}</span>
          <span className="text-sm font-medium text-(--c-muted)"> / {meetup.capacity}명</span>
        </h2>
        <RoomMembers members={meetup.members} hostId={meetup.hostId} pinCount={mapDetail?.pins.length ?? 0} checkins={checkins} meId={me.id} onKick={me.id === meetup.hostId ? kick : undefined} />
      </section>
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col bg-(--c-bg) text-(--c-text)" style={themeVars(theme)}>
      {/* 머리: 모임 이름 · 시간 · 장소 · 멤버 얼굴 */}
      <header className="flex shrink-0 items-center gap-3 border-b border-(--c-border) bg-(--c-surface) px-3 py-2.5 md:px-5">
        <Link href={`/meetups/${meetupId}`} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="모임 정보로">
          <ChevronLeftIcon size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.9375rem] font-bold">{meetup.title}</h1>
          <p className="truncate text-xs text-(--c-muted)">
            <b className="font-semibold text-(--c-accent)">{dday(meetup.meetAt)}</b> · {formatMeetAt(meetup.meetAt)} · {meetup.meetPoint}
          </p>
        </div>
        <button type="button" onClick={() => setTab('members')} className="flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 hover:bg-black/5 md:pointer-events-none" aria-label={`멤버 ${meetup.members.length}명`}>
          <span className="flex -space-x-2">
            {meetup.members.slice(0, 4).map((m) => (
              <Avatar key={m.userId} id={m.userId} nickname={m.nickname} src={m.avatarUrl} size={26} ring />
            ))}
          </span>
          <span className="text-xs font-semibold text-(--c-muted)">{meetup.members.length}</span>
        </button>
      </header>

      {/* 모바일 탭 */}
      <nav className="flex shrink-0 border-b border-(--c-border) bg-(--c-surface) md:hidden" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 py-2.5 text-[0.8125rem] font-semibold transition ${tab === t.id ? 'border-(--c-accent) text-(--c-text)' : 'border-transparent text-(--c-muted)'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 md:grid md:grid-cols-[1fr_400px]">
        <div className={`min-h-0 flex-1 ${tab === 'chat' ? 'flex flex-col' : 'hidden'} md:flex md:flex-col md:border-r md:border-(--c-border)`}>
          <RoomChat meetup={meetup} me={me} list={messages} onChange={reload} />
        </div>
        <aside className={`tm-scroll min-h-0 flex-1 overflow-y-auto p-4 md:block md:p-5 ${tab === 'chat' ? 'hidden' : 'block'}`}>{side}</aside>
      </div>
    </div>
  )
}
