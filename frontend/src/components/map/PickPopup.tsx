'use client'

import { useEffect, useState } from 'react'
import { CloseIcon, PinIcon, PlusIcon } from '../icons'
import { describePoint, nearbyPlaces, type PlaceSearchResult } from './placeSearch'
import type { PickedPoint } from './types'

interface Props {
  point: PickedPoint
  onAdd: (place: PlaceSearchResult) => void
  onClose: () => void
}

type Nearby = PlaceSearchResult & { distance: number }

/** 지도에서 찍은 지점 위에 뜨는 카드: 근처 장소(가까운 순)에서 고르거나, 이 위치 그대로 핀 추가 */
export function PickPopup({ point, onAdd, onClose }: Props) {
  const [place, setPlace] = useState<PlaceSearchResult | null>(null)
  const [nearby, setNearby] = useState<Nearby[] | null>(null) // null = 찾는 중

  useEffect(() => {
    // 다른 지점을 찍으면 key 가 바뀌어 새로 뜨므로 여기서 비우지 않는다
    let cancelled = false
    describePoint(point.lat, point.lng).then((p) => {
      if (cancelled) return
      setPlace(p)
      // 주소 대신 건물 이름이 나왔으면 그 이름으로도 찾는다
      const building = p.name !== p.address && p.name !== '지정한 위치' ? p.name : ''
      nearbyPlaces(point.lat, point.lng, { building })
        .then((list) => !cancelled && setNearby(list))
        .catch(() => !cancelled && setNearby([]))
    })
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
      className="relative mb-3 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-(--c-surface) p-3 text-(--c-text) shadow-[0_6px_24px_rgb(15_23_42/0.22)]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="이 위치에 핀 추가"
    >
      <button type="button" onClick={onClose} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="닫기">
        <CloseIcon size={15} />
      </button>

      <p className="px-1 pr-8 text-xs font-semibold text-(--c-muted)">이 근처 장소</p>
      <ul className="mt-1.5 max-h-56 overflow-y-auto">
        {nearby === null ? (
          <li className="px-1 py-3 text-sm text-(--c-muted)">근처 장소 찾는 중…</li>
        ) : nearby.length === 0 ? (
          <li className="px-1 py-3 text-sm text-(--c-muted)">근처에 등록된 장소가 없어요.</li>
        ) : (
          nearby.map((p) => (
            <li key={p.externalId}>
              <button
                type="button"
                onClick={() => onAdd(p)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-black/[0.04] active:bg-black/[0.08]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-(--c-muted)">
                    {p.category ? `${p.category} · ` : ''}
                    {p.distance}m
                  </span>
                </span>
                <PlusIcon size={16} className="shrink-0 text-(--c-muted)" />
              </button>
            </li>
          ))
        )}
      </ul>

      {/* 목록에 없으면: 찍은 위치 그대로 */}
      <div className="mt-2 border-t border-(--c-border) pt-2.5">
        <div className="flex items-start gap-2 px-1">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500">
            <PinIcon size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">{place ? place.name : '주소 찾는 중…'}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-(--c-muted)">{place?.address ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={!place}
          onClick={() => place && onAdd(place)}
          className="mt-2.5 flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-(--c-text) text-sm font-semibold text-(--c-surface) transition hover:opacity-90 disabled:opacity-50"
        >
          <PlusIcon size={16} />이 위치 그대로 추가
        </button>
      </div>
      {/* 말풍선 꼬리 */}
      <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-(--c-surface)" aria-hidden />
    </div>
  )
}
