'use client'

import { useEffect, useState } from 'react'
import { CloseIcon, PinIcon, PlusIcon } from '../icons'
import { describePoint, type PlaceSearchResult } from './placeSearch'
import type { PickedPoint } from './types'

interface Props {
  point: PickedPoint
  onAdd: (place: PlaceSearchResult) => void
  onClose: () => void
}

/** 우클릭한 지점 위에 뜨는 작은 카드: 주소 + [핀 추가] */
export function PickPopup({ point, onAdd, onClose }: Props) {
  const [place, setPlace] = useState<PlaceSearchResult | null>(null)

  useEffect(() => {
    let cancelled = false
    describePoint(point.lat, point.lng).then((p) => !cancelled && setPlace(p))
    return () => {
      cancelled = true
    }
  }, [point.lat, point.lng])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="relative mb-3 w-64 rounded-2xl bg-(--c-surface) p-3.5 text-(--c-text) shadow-[0_6px_24px_rgb(15_23_42/0.22)]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="이 위치에 핀 추가"
    >
      <button type="button" onClick={onClose} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="닫기">
        <CloseIcon size={15} />
      </button>
      <div className="flex items-start gap-2.5 pr-6">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500">
          <PinIcon size={17} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{place ? place.name : '주소 찾는 중…'}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-(--c-muted)">{place?.address ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={!place}
        onClick={() => place && onAdd(place)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-(--c-text) text-sm font-semibold text-(--c-surface) transition hover:opacity-90 disabled:opacity-50"
      >
        <PlusIcon size={16} />
        여기에 핀 추가
      </button>
      {/* 말풍선 꼬리 */}
      <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-(--c-surface)" aria-hidden />
    </div>
  )
}
