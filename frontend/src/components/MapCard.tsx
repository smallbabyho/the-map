'use client'

import Link from 'next/link'
import type { ConceptMap } from '../types'
import { GlobeIcon, LockIcon, TrashIcon } from './icons'
import { getTheme, themeVars } from './themes'

interface Props {
  map: ConceptMap
  onDelete: (map: ConceptMap) => void
}

// 지도 id 로 항상 같은 모양이 나오는 가짜 핀 배치 (카드 썸네일 장식용)
function seededDots(seed: string, count: number) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const rand = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  return Array.from({ length: count }, () => ({ x: 12 + rand() * 76, y: 18 + rand() * 60 })).sort((a, b) => a.x - b.x)
}

export function MapCard({ map, onDelete }: Props) {
  const theme = getTheme(map.theme)
  const dots = seededDots(map.id, 4)
  const updated = new Date(map.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface) transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/maps/${map.id}`} className="block">
        <div
          className="relative h-36 overflow-hidden"
          style={{
            ...themeVars(theme),
            backgroundColor: 'var(--c-map-bg)',
            backgroundImage:
              'linear-gradient(var(--c-map-grid) 1px, transparent 1px), linear-gradient(90deg, var(--c-map-grid) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline
              points={dots.map((d) => `${d.x},${d.y}`).join(' ')}
              fill="none"
              stroke={theme.route}
              strokeWidth={2.5}
              strokeOpacity={0.7}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          {dots.map((d, i) => (
            <span
              key={i}
              className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${d.x}%`, top: `${d.y}%`, background: theme.palette[i % theme.palette.length] }}
            />
          ))}
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-gray-700 backdrop-blur">
            {theme.name}
          </span>
        </div>
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
