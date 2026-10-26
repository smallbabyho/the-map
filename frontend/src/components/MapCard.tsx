'use client'

import Link from 'next/link'
import { daysUntil, formatPlanDate, planDday } from '../lib/planDate'
import type { ConceptMap } from '../types'
import { CheckIcon, GlobeIcon, LockIcon, TrashIcon } from './icons'
import { MapThumb } from './MapThumb'
import { mapCategoryText } from './mapCategories'
import { mapPurpose, purposeMeta } from './mapPurpose'
import { getTheme } from './themes'

interface Props {
  map: ConceptMap
  /** 목록 순번 (No.01) */
  index?: number
  /** 남의 지도를 함께 꾸미는 중이면 true (삭제 대신 나가기) */
  shared?: boolean
  onDelete: (map: ConceptMap) => void
  /** 여러 개 고르는 중이면 넘긴다. 카드를 누르면 열지 않고 고르기만 한다 */
  onToggle?: (map: ConceptMap) => void
  selected?: boolean
}

export function MapCard({ map, index, shared = false, onDelete, onToggle, selected = false }: Props) {
  const theme = getTheme(map.theme)
  const updated = new Date(map.updatedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })

  return (
    <div className={`tm-card group relative overflow-hidden rounded-2xl ${selected ? 'ring-[3px] ring-(--c-accent)' : ''}`}>
      <Link href={`/maps/${map.id}`} className="block">
        <MapThumb id={map.id} theme={map.theme} cover={map.coverUrl} className="h-44">
          <span className="absolute left-3 top-3 rounded-full bg-(--c-ink) px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-(--c-bg)">
            {purposeMeta(mapPurpose(map)).emoji} {purposeMeta(mapPurpose(map)).label}
            {index != null && ` · No.${String(index + 1).padStart(2, '0')}`}
          </span>
          {shared && <span className="absolute right-12 top-3 rounded-full bg-(--c-lime) px-2.5 py-1 text-[11px] font-bold text-gray-900">👥 함께 꾸미는 중</span>}
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">
            {mapCategoryText(map).emoji} {mapCategoryText(map).label}
          </span>
        </MapThumb>
        <div className="border-t border-(--c-border) px-4 pb-4 pt-3">
          <h3 className="truncate text-lg font-bold tracking-tight">{map.title || '제목 없는 지도'}</h3>
          {map.plannedDate && daysUntil(map.plannedDate) >= 0 && (
            <p className="mt-1 text-[13px] font-semibold text-(--c-accent)">
              📅 {planDday(map.plannedDate)} · {formatPlanDate(map.plannedDate)}
            </p>
          )}
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
      {onToggle ? (
        // 고르는 중: 카드 전체를 덮는 버튼 하나로 고르기만 (지도로 넘어가지 않게)
        <button
          type="button"
          onClick={() => onToggle(map)}
          aria-pressed={selected}
          aria-label={`${map.title || '제목 없는 지도'} ${selected ? '선택 해제' : '선택'}`}
          className="absolute inset-0 z-10 cursor-pointer"
        >
          <span
            className={`absolute right-2 top-2 grid size-8 place-items-center rounded-full ring-1 transition ${selected ? 'bg-(--c-accent) text-(--c-accent-text) ring-(--c-accent)' : 'bg-(--c-surface) text-transparent ring-(--c-border)'}`}
            aria-hidden
          >
            <CheckIcon size={16} strokeWidth={2.6} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onDelete(map)}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-(--c-surface) text-(--c-muted) opacity-100 ring-1 ring-(--c-border) transition hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
          aria-label={shared ? `${map.title}에서 나가기` : `${map.title} 삭제`}
          title={shared ? '함께 꾸미기에서 나가기' : '삭제'}
        >
          <TrashIcon size={16} />
        </button>
      )}
    </div>
  )
}
