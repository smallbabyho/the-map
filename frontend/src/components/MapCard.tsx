'use client'

import Link from 'next/link'
import type { ConceptMap } from '../types'
import { GlobeIcon, LockIcon, TrashIcon } from './icons'
import { MapThumb } from './MapThumb'
import { categoryMeta } from './mapCategories'
import { getTheme } from './themes'

interface Props {
  map: ConceptMap
  /** 목록 순번 (No.01) */
  index?: number
  /** 남의 지도를 함께 꾸미는 중이면 true (삭제 대신 나가기) */
  shared?: boolean
  onDelete: (map: ConceptMap) => void
}

export function MapCard({ map, index, shared = false, onDelete }: Props) {
  const theme = getTheme(map.theme)
  const updated = new Date(map.updatedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })

  return (
    <div className="tm-card group relative overflow-hidden rounded-2xl">
      <Link href={`/maps/${map.id}`} className="block">
        <MapThumb id={map.id} theme={map.theme} cover={map.coverUrl} className="h-44">
          <span className="absolute left-3 top-3 rounded-full bg-(--c-ink) px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-(--c-bg)">
            {index != null ? `No.${String(index + 1).padStart(2, '0')}` : theme.name}
          </span>
          {shared && <span className="absolute right-12 top-3 rounded-full bg-(--c-lime) px-2.5 py-1 text-[11px] font-bold text-gray-900">👥 함께 꾸미는 중</span>}
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">
            {categoryMeta(map.category).emoji} {categoryMeta(map.category).label}
          </span>
        </MapThumb>
        <div className="border-t border-(--c-border) px-4 pb-4 pt-3">
          <h3 className="truncate text-lg font-bold tracking-tight">{map.title || '제목 없는 지도'}</h3>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-(--c-muted)">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: theme.accent }} aria-hidden />
              {theme.name}
              <span aria-hidden>·</span>
              {map.isPublic ? <GlobeIcon size={12} /> : <LockIcon size={12} />}
              {map.isPublic ? 'public' : 'private'}
            </span>
            <span>{updated}</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(map)}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-(--c-surface) text-(--c-muted) opacity-100 ring-1 ring-(--c-border) transition hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
        aria-label={shared ? `${map.title}에서 나가기` : `${map.title} 삭제`}
        title={shared ? '함께 꾸미기에서 나가기' : '삭제'}
      >
        <TrashIcon size={16} />
      </button>
    </div>
  )
}
