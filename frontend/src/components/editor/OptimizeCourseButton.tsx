'use client'

import { useState } from 'react'
import type { Pin } from '../../types'
import { optimizeCourse } from '../map/optimizeCourse'

interface Props {
  pins: Pin[]
  onReorder: (pinIds: string[]) => void
}

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`)

/** [최단 코스로] 첫 핀(출발지)은 두고 나머지 순서를 이동 거리가 가장 짧게. 바꾼 뒤엔 [되돌리기] */
export function OptimizeCourseButton({ pins, onReorder }: Props) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; undo: string[] | null } | null>(null)

  if (pins.length < 3) return null

  const run = async () => {
    setBusy(true)
    setNote(null)
    const before = pins.map((p) => p.id)
    const r = await optimizeCourse(pins.map((p) => p.place))
    setBusy(false)
    if (r.afterM >= r.beforeM) return setNote({ text: '이미 가장 짧은 순서예요', undo: null })
    onReorder(r.order.map((i) => before[i]))
    setNote({ text: `${r.estimated ? '직선거리로 ' : ''}${km(r.beforeM)} → ${km(r.afterM)}`, undo: before })
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {note && (
        <span className="truncate text-xs text-(--c-muted)">
          {note.text}
          {note.undo && (
            <button
              type="button"
              onClick={() => {
                onReorder(note.undo!)
                setNote(null)
              }}
              className="ml-1.5 font-semibold text-(--c-text) underline underline-offset-2"
            >
              되돌리기
            </button>
          )}
        </span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title="첫 장소에서 출발해 이동 거리가 가장 짧은 순서로 바꿔요"
        className="shrink-0 rounded-full border border-(--c-border) px-2.5 py-1 text-xs font-semibold transition hover:bg-black/[0.04] disabled:opacity-60"
      >
        {busy ? '계산 중…' : '✨ 최단 코스로'}
      </button>
    </div>
  )
}
