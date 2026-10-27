'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getMapMeetups } from '../../db/api'
import type { MeetupSummary } from '../../types'
import { Avatar } from '../Avatar'
import { dday, formatMeetAt, meetupState, STATE_BADGE } from './format'

/** 지도 보기 화면 아래: 이 지도로 모이는 성지순례 방 목록 (눌러서 바로 참여 화면으로) */
export function MapMeetupList({ mapId, newHref }: { mapId: string; newHref: string }) {
  const [list, setList] = useState<MeetupSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getMapMeetups(mapId)
      .then((l) => !cancelled && setList(l))
      .catch(() => !cancelled && setList([]))
    return () => {
      cancelled = true
    }
  }, [mapId])

  if (list === null) return null
  // 모집 중인 방 먼저 (마감 · 꽉 찬 방은 뒤로)
  const order = (m: MeetupSummary) => (['open', 'almost'].includes(meetupState(m)) ? 0 : 1)
  const sorted = [...list].sort((a, b) => order(a) - order(b))
  const recruiting = list.filter((m) => order(m) === 0).length

  return (
    <section className="border-t border-(--c-border) px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[0.9375rem] font-bold">
          🚩 이 지도로 떠나는 성지순례 {recruiting > 0 && <span className="text-emerald-600">{recruiting}곳 모집 중</span>}
        </h2>
        <Link href={newHref} className="shrink-0 text-xs font-semibold text-(--c-accent) hover:underline">
          + 모임 열기
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-(--c-muted)">아직 모이는 방이 없어요. 첫 모임을 열어 함께 누빌 사람을 모아 보세요.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((m) => {
            const state = meetupState(m)
            const badge = STATE_BADGE[state]
            return (
              <li key={m.id}>
                <Link href={`/meetups/${m.id}`} className="flex items-center gap-3 rounded-xl border border-(--c-border) bg-(--c-surface) px-3 py-2.5 transition hover:border-(--c-accent)">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-bold ${badge.className}`}>{badge.label}</span>
                      <span className="truncate text-sm font-bold">{m.title}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-(--c-muted)">
                      <b className="text-(--c-text)">{dday(m.meetAt)}</b> · {formatMeetAt(m.meetAt)} · 📍 {m.meetPoint}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex -space-x-1.5">
                      {m.members.slice(0, 3).map((u) => (
                        <Avatar key={u.userId} id={u.userId} nickname={u.nickname} src={u.avatarUrl} size={20} ring />
                      ))}
                    </span>
                    <span className="text-[0.6875rem] font-semibold text-(--c-muted)">
                      {m.members.length}/{m.capacity}명
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
