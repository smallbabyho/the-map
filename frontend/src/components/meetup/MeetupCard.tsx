'use client'

import Link from 'next/link'
import type { MeetupSummary } from '../../types'
import { Avatar } from '../Avatar'
import { CalendarIcon, PinIcon } from '../icons'
import { MapThumb } from '../MapThumb'
import { dday, formatMeetAt, meetupState, STATE_BADGE } from './format'

/** 겹쳐 보이는 참여자 프로필 */
export function MemberStack({ members, max = 5, size = 26 }: { members: MeetupSummary['members']; max?: number; size?: number }) {
  const shown = members.slice(0, max)
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((m) => (
        <Avatar key={m.userId} id={m.userId} nickname={m.nickname} size={size} ring />
      ))}
      {members.length > max && (
        <span className="grid place-items-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-600 ring-2 ring-(--c-surface)" style={{ width: size, height: size }}>
          +{members.length - max}
        </span>
      )}
    </span>
  )
}

export function MeetupCard({ meetup, myId }: { meetup: MeetupSummary; myId?: string }) {
  const state = meetupState(meetup)
  const badge = STATE_BADGE[state]
  const joined = !!myId && meetup.members.some((m) => m.userId === myId)
  const dim = state === 'canceled' || state === 'past'

  return (
    <Link
      href={`/meetups/${meetup.id}`}
      className={`group block overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface) transition hover:-translate-y-0.5 hover:shadow-lg ${dim ? 'opacity-60' : ''}`}
    >
      <MapThumb id={meetup.map.id} theme={meetup.map.theme} dots={meetup.map.pinCount} className="h-32">
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${badge.className}`}>{badge.label}</span>
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">{dday(meetup.meetAt)}</span>
        {joined && (
          <span className="absolute bottom-3 left-3 rounded-full bg-(--c-accent) px-2.5 py-1 text-[11px] font-bold text-(--c-accent-text) shadow-sm">
            {meetup.hostId === myId ? '내가 연 모임' : '참여 중'}
          </span>
        )}
      </MapThumb>
      <div className="px-4 pb-4 pt-3">
        <p className="truncate text-xs font-medium text-(--c-muted)">🗺️ {meetup.map.title} · 장소 {meetup.map.pinCount}곳</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.75rem] text-[15px] font-bold leading-snug">{meetup.title}</h3>
        <div className="mt-2.5 space-y-1 text-[13px] text-(--c-muted)">
          <p className="flex items-center gap-1.5">
            <CalendarIcon size={14} />
            {formatMeetAt(meetup.meetAt)}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <PinIcon size={14} />
            {meetup.meetPoint}
          </p>
        </div>
        <div className="mt-3.5 flex items-center justify-between border-t border-(--c-border) pt-3">
          <MemberStack members={meetup.members} />
          <span className="text-[13px] font-semibold">
            <span className={state === 'almost' ? 'text-orange-500' : 'text-(--c-accent)'}>{meetup.members.length}</span>
            <span className="text-(--c-muted)"> / {meetup.capacity}명</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
