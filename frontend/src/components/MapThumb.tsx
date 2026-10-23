import type { ReactNode } from 'react'
import type { ThemeId } from '../types'
import { getTheme, themeVars } from './themes'

// 지도 id 로 항상 같은 모양이 나오는 가짜 핀 배치 (썸네일 장식용)
function seededDots(seed: string, count: number) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const rand = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  return Array.from({ length: count }, () => ({ x: 12 + rand() * 76, y: 18 + rand() * 60 })).sort((a, b) => a.x - b.x)
}

/** 테마 색으로 그린 지도 썸네일 (카드용). children 은 위에 겹쳐 그린다. */
export function MapThumb({ id, theme: themeId, dots = 4, className = 'h-36', children }: { id: string; theme: ThemeId; dots?: number; className?: string; children?: ReactNode }) {
  const theme = getTheme(themeId)
  const pts = seededDots(id, Math.max(2, Math.min(dots, 6)))
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        ...themeVars(theme),
        backgroundColor: 'var(--c-map-bg)',
        backgroundImage: 'linear-gradient(var(--c-map-grid) 1px, transparent 1px), linear-gradient(90deg, var(--c-map-grid) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polyline
          points={pts.map((d) => `${d.x},${d.y}`).join(' ')}
          fill="none"
          stroke={theme.route}
          strokeWidth={2.5}
          strokeOpacity={0.7}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {pts.map((d, i) => (
        <span
          key={i}
          className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${d.x}%`, top: `${d.y}%`, background: theme.palette[i % theme.palette.length] }}
        />
      ))}
      {children}
    </div>
  )
}
