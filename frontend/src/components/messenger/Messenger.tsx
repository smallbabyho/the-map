'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../../auth'
import { getMeetupComments, getMeetups, getMyMaps, subscribeMeetupRoom } from '../../db/api'
import { daysUntil, formatPlanDate, planDday } from '../../lib/planDate'
import type { ConceptMap, MeetupComment, MeetupSummary, User } from '../../types'
import { ChevronLeftIcon, CloseIcon } from '../icons'
import { dday, formatMeetAt } from '../meetup/format'
import { RoomChat } from '../meetup/RoomChat'

// 오른쪽 아래에 늘 떠 있는 💬 버튼 (인스타그램 메시지처럼).
// 누르면 작은 창: 다가오는 성지순례 · 곧 갈 지도. 모임을 누르면 창 안에서 바로 그 순례방 채팅.
// 로그인 직후엔 일정이 있으면 한 번 저절로 열린다. 지도 화면 · 순례방 · 로그인 화면에서는 숨긴다.

const JUST_LOGGED_IN = 'the-map:just-logged-in'
const MAP_DAYS = 14 // 가는 날이 이 안에 있는 지도만
const ONGOING_MS = 6 * 60 * 60 * 1000 // 모임 시간이 지나도 6시간은 '진행 중'

/** 로그인에 성공하면 부른다: 다음 화면에서 창을 한 번 저절로 연다 */
export function markJustLoggedIn() {
  try {
    sessionStorage.setItem(JUST_LOGGED_IN, '1')
  } catch {
    // 못 남기면 저절로 안 열릴 뿐
  }
}

function takeJustLoggedIn(userId: string) {
  try {
    const yes = sessionStorage.getItem(JUST_LOGGED_IN) === '1'
    sessionStorage.removeItem(JUST_LOGGED_IN)
    // 처음 온 사람은 기능 안내(Tour)가 먼저
    return yes && localStorage.getItem(`the-map:tour:home:${userId}`) === '1'
  } catch {
    return false
  }
}

const hiddenOn = (path: string) => path.startsWith('/maps/') || path.startsWith('/login') || /^\/meetups\/[^/]+\/room/.test(path)

export function Messenger() {
  const me = useCurrentUser()
  const path = usePathname()
  if (!me || hiddenOn(path)) return null
  // 사람이 바뀌면 새로 (목록 · 열린 방 초기화)
  return <MessengerFor key={me.id} me={me} />
}

function MessengerFor({ me }: { me: User }) {
  const [open, setOpen] = useState(false)
  const [meetups, setMeetups] = useState<MeetupSummary[] | null>(null)
  const [plans, setPlans] = useState<ConceptMap[]>([])
  const [loadedAt, setLoadedAt] = useState(0)
  const [roomId, setRoomId] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([getMeetups('joined'), getMeetups('hosting'), getMyMaps()])
      .then(([joined, hosting, maps]) => {
        const now = Date.now()
        const byId = new Map([...joined, ...hosting].map((m) => [m.id, m]))
        const soon = [...byId.values()]
          .filter((m) => m.status !== 'canceled' && Date.parse(m.meetAt) > now - ONGOING_MS)
          .sort((a, b) => Date.parse(a.meetAt) - Date.parse(b.meetAt))
        setMeetups(soon)
        setPlans(
          maps
            .filter((m) => m.plannedDate && daysUntil(m.plannedDate) >= 0 && daysUntil(m.plannedDate) <= MAP_DAYS)
            .sort((a, b) => a.plannedDate!.localeCompare(b.plannedDate!)),
        )
        setLoadedAt(now)
        if (takeJustLoggedIn(me.id) && (soon.length > 0 || maps.some((m) => m.plannedDate))) setOpen(true)
      })
      .catch(() => setMeetups((cur) => cur ?? []))
  }, [me.id])

  // 처음 한 번 (배지 숫자용) + 창을 열 때마다 새로
  useEffect(() => load(), [load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (roomId ? setRoomId(null) : setOpen(false))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, roomId])

  const room = roomId ? meetups?.find((m) => m.id === roomId) : undefined
  const count = meetups?.length ?? 0

  const toggle = () => {
    if (!open) load()
    setOpen(!open)
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={room ? `${room.title} 순례방` : '다가오는 일정 · 순례방'}
          className="tm-float fixed inset-x-2 bottom-[136px] top-16 z-[900] flex flex-col overflow-hidden rounded-3xl bg-(--c-surface) text-(--c-text) md:inset-x-auto md:bottom-24 md:right-6 md:top-auto md:h-[min(600px,calc(100dvh-140px))] md:w-[380px]"
        >
          {room ? (
            <RoomPane meetup={room} me={me} onBack={() => setRoomId(null)} onClose={() => setOpen(false)} />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-(--c-border) px-5 py-3.5">
                <h2 className="text-lg font-bold">다가오는 일정</h2>
                <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="닫기">
                  <CloseIcon size={16} />
                </button>
              </div>
              <div className="tm-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {meetups === null ? (
                  <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
                ) : meetups.length === 0 && plans.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="font-semibold">다가오는 일정이 없어요</p>
                    <p className="mt-1 text-sm text-(--c-muted)">성지순례에 참여하거나, 지도에 가는 날을 적어 보세요.</p>
                    <Link href="/meetups" onClick={() => setOpen(false)} className="mt-4 inline-block rounded-full bg-(--c-text) px-4 py-2 text-sm font-semibold text-(--c-surface)">
                      성지순례 둘러보기
                    </Link>
                  </div>
                ) : (
                  <>
                    {meetups.length > 0 && <p className="px-2 pb-1.5 text-xs font-bold text-(--c-muted)">🚩 참여 중인 성지순례 · 눌러서 순례방</p>}
                    <ul className="space-y-1">
                      {meetups.map((m) => (
                        <li key={m.id}>
                          <button type="button" onClick={() => setRoomId(m.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-black/[0.04]">
                            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-(--c-accent)/12 text-xl">💬</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{m.title}</span>
                              <span className="block truncate text-xs text-(--c-muted)">
                                {formatMeetAt(m.meetAt)} · {m.meetPoint}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-(--c-accent) px-2 py-0.5 text-[11px] font-bold text-(--c-accent-text)">
                              {Date.parse(m.meetAt) < loadedAt ? '진행 중' : dday(m.meetAt)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {plans.length > 0 && (
                      <>
                        <p className="px-2 pb-1.5 pt-4 text-xs font-bold text-(--c-muted)">📅 곧 갈 지도</p>
                        <ul className="space-y-1">
                          {plans.map((m) => (
                            <li key={m.id}>
                              <Link href={`/maps/${m.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-black/[0.04]">
                                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-black/[0.05] text-xl">🗺️</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold">{m.title || '제목 없는 지도'}</span>
                                  <span className="block text-xs text-(--c-muted)">{formatPlanDate(m.plannedDate!)}</span>
                                </span>
                                <span className="shrink-0 rounded-full border border-(--c-accent) px-2 py-0.5 text-[11px] font-bold text-(--c-accent)">{planDday(m.plannedDate!)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? '일정 · 순례방 닫기' : `일정 · 순례방 열기${count ? ` (다가오는 모임 ${count}개)` : ''}`}
        className="tm-float fixed bottom-20 right-4 z-[900] grid size-14 place-items-center rounded-full bg-(--c-text) text-2xl text-(--c-surface) transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        {open ? <CloseIcon size={22} /> : '💬'}
        {!open && count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-(--c-bg)">{count}</span>
        )}
      </button>
    </>
  )
}

/** 창 안의 순례방 채팅 (실시간) */
function RoomPane({ meetup, me, onBack, onClose }: { meetup: MeetupSummary; me: User; onBack: () => void; onClose: () => void }) {
  const [messages, setMessages] = useState<MeetupComment[] | null>(null)
  const reload = useCallback(() => {
    getMeetupComments(meetup.id)
      .then(setMessages)
      .catch(() => setMessages([]))
  }, [meetup.id])
  useEffect(() => {
    reload()
    return subscribeMeetupRoom(meetup.id, reload)
  }, [meetup.id, reload])

  return (
    <>
      <div className="flex items-center gap-1 border-b border-(--c-border) px-2 py-2">
        <button type="button" onClick={onBack} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="목록으로">
          <ChevronLeftIcon size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{meetup.title}</p>
          <p className="truncate text-xs text-(--c-muted)">
            {dday(meetup.meetAt)} · {meetup.members.length}명
          </p>
        </div>
        <Link href={`/meetups/${meetup.id}/room`} onClick={onClose} className="shrink-0 rounded-full border border-(--c-border) px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04]">
          크게 보기
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <RoomChat meetup={meetup} me={me} list={messages} onChange={reload} />
      </div>
    </>
  )
}
