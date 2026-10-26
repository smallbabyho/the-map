'use client'

import { Fragment, useState } from 'react'
import type { MapDetail, MeetupCheckin, MeetupMember, User } from '../../types'
import { Avatar } from '../Avatar'
import { CheckIcon } from '../icons'
import { legLabel } from '../legModes'
import { MapView } from '../map'
import { KakaoDirectionsLink } from '../map/KakaoDirections'
import { useViewCourse, ViewModePicker, type ViewMode } from '../map/ViewModePicker'
import { getTheme } from '../themes'
import { TransitSteps } from '../TransitSteps'

interface Props {
  mapDetail: MapDetail
  me: User
  members: MeetupMember[]
  checkins: MeetupCheckin[]
  /** 내 도착 체크 켜기 / 끄기 */
  onToggle: (pinId: string, arrived: boolean) => void
  busyPinId: string | null
}

/**
 * 순례방 코스: 지도 + 이동수단 바꿔 보기 + 장소마다 '도착' 체크.
 * 장소 옆에 그곳에 도착한 사람들의 얼굴이 모인다 (서로 어디쯤인지 보기).
 */
export function RoomCourse({ mapDetail, me, members, checkins, onToggle, busyPinId }: Props) {
  const { pins } = mapDetail
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('course')
  const view = useViewCourse(pins, mapDetail.legs, viewMode)
  const theme = getTheme(mapDetail.map.theme)

  const arrivedAt = (pinId: string) => checkins.filter((c) => c.pinId === pinId)
  const mine = new Set(checkins.filter((c) => c.userId === me.id).map((c) => c.pinId))
  const memberOf = (userId: string) => members.find((m) => m.userId === userId)

  return (
    <div>
      <div className="relative h-56 overflow-hidden rounded-2xl border border-(--c-border)">
        <MapView pins={pins} legs={view.legs} theme={theme} look={mapDetail.map} selectedPinId={selectedId} onSelectPin={(id) => setSelectedId((c) => (c === id ? null : id))} />
      </div>
      {pins.length > 1 && <ViewModePicker value={viewMode} onChange={setViewMode} className="mt-3" />}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-semibold">
          내 순례 <span className="text-(--c-accent)">{mine.size}</span> / {pins.length}곳
        </span>
        {view.totalMin > 0 && <span className="text-(--c-muted)">이동 {view.loading ? '계산 중…' : `약 ${view.totalMin}분`}</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-(--c-accent) transition-[width] duration-500" style={{ width: `${pins.length ? (mine.size / pins.length) * 100 : 0}%` }} />
      </div>

      <ol className="mt-4">
        {pins.map((p, i) => {
          const next = pins[i + 1]
          const legMode = next && view.modeOf(p.id, next.id)
          const transit = next && view.transitOf(p.id, next.id)
          const here = arrivedAt(p.id)
          const done = mine.has(p.id)
          return (
            <Fragment key={p.id}>
              <li className={`flex items-center gap-2 rounded-xl border p-2 pr-1 transition ${selectedId === p.id ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border) bg-(--c-surface)'}`}>
                <button type="button" onClick={() => setSelectedId(p.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className="relative grid size-9 shrink-0 place-items-center rounded-full text-lg" style={{ background: p.color }}>
                    {p.icon}
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gray-900 px-1 text-[9px] font-bold text-white">{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.place.name}</span>
                    {here.length > 0 ? (
                      <span className="mt-0.5 flex items-center gap-1">
                        <span className="flex -space-x-1.5">
                          {here.slice(0, 5).map((c) => {
                            const m = memberOf(c.userId)
                            return <Avatar key={c.userId} id={c.userId} nickname={m?.nickname ?? '?'} src={m?.avatarUrl} size={18} ring />
                          })}
                        </span>
                        <span className="text-[11px] text-(--c-muted)">{here.length}명 도착</span>
                      </span>
                    ) : (
                      p.memo && <span className="block truncate text-[13px] text-(--c-muted)">{p.memo}</span>
                    )}
                  </span>
                </button>
                <KakaoDirectionsLink to={p.place} from={pins[i - 1]?.place} mode={i > 0 ? view.modeOf(pins[i - 1].id, p.id) : undefined} />
                <button
                  type="button"
                  disabled={busyPinId === p.id}
                  onClick={() => onToggle(p.id, !done)}
                  aria-pressed={done}
                  className={`flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50 ${
                    done ? 'bg-(--c-accent) text-(--c-accent-text)' : 'border border-(--c-border) text-(--c-muted) hover:border-(--c-accent) hover:text-(--c-accent)'
                  }`}
                >
                  {done ? <CheckIcon size={14} /> : '📍'}
                  {done ? '도착' : '도착 체크'}
                </button>
              </li>
              {legMode && (
                <li className="ml-[26px] border-l-2 border-dotted border-(--c-border) py-1.5 pl-5 text-xs text-(--c-muted)">
                  {legLabel(legMode, view.durationOf(p.id, next.id))}
                  {transit && <TransitSteps info={transit} className="mt-1.5 text-(--c-text)" />}
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

/** 참여자 목록 + 각자 몇 곳 도착했는지 */
export function RoomMembers({ members, hostId, pinCount, checkins, meId }: { members: MeetupMember[]; hostId: string; pinCount: number; checkins: MeetupCheckin[]; meId: string }) {
  const doneOf = (userId: string) => checkins.filter((c) => c.userId === userId).length
  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const done = doneOf(m.userId)
        return (
          <li key={m.userId} className="flex items-center gap-3 rounded-xl border border-(--c-border) bg-(--c-surface) px-3 py-2.5">
            <Avatar id={m.userId} nickname={m.nickname} src={m.avatarUrl} size={34} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {m.nickname}
                {m.userId === meId && <span className="text-xs font-medium text-(--c-muted)">(나)</span>}
                {m.userId === hostId && <span className="rounded bg-black/5 px-1 text-[10px] font-bold text-(--c-muted)">주최자</span>}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-(--c-accent)" style={{ width: `${pinCount ? (done / pinCount) * 100 : 0}%` }} />
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-(--c-muted)">
              {done}/{pinCount}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
