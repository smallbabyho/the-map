'use client'

import Link from 'next/link'
import type { ConceptMap } from '../types'
import { GlobeIcon, LockIcon, TrashIcon } from './icons'
import { MapThumb } from './MapThumb'
import { getTheme } from './themes'

interface Props {
  map: ConceptMap
  onDelete: (map: ConceptMap) => void
}

export function MapCard({ map, onDelete }: Props) {
  const theme = getTheme(map.theme)
  const updated = new Date(map.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface) transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/maps/${map.id}`} className="block">
        <MapThumb id={map.id} theme={map.theme}>
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-gray-700 backdrop-blur">
            {theme.name}
          </span>
        </MapThumb>
        <div className="px-4 pb-4 pt-3">
          <h3 className="truncate text-[15px] font-semibold">{map.title || '제목 없는 지도'}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-(--c-muted)">
            <span className="inline-flex items-center gap-1">
              {map.isPublic ? <GlobeIcon size={13} /> : <LockIcon size={13} />}
              {map.isPublic ? '공개' : '비공개'}
            </span>
            <span aria-hidden>·</span>
            <span>{updated} 수정</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(map)}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-gray-500 opacity-100 shadow-sm backdrop-blur transition hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
        aria-label={`${map.title} 삭제`}
      >
        <TrashIcon size={16} />
      </button>
    </div>
  )
}
