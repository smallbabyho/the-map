'use client'

import Link from 'next/link'
import type { PlaceStats } from '../../types'

/** 장소 상세 주소 (카카오 장소 ID 기준) */
export const placeHref = (externalId: string) => `/places/${encodeURIComponent(externalId)}`

/** 별 5개 (읽기 전용). 0.5 단위는 반올림해서 채운다 */
export function Stars({ value, size = 14, className = '' }: { value: number; size?: number; className?: string }) {
  const full = Math.round(value)
  return (
    <span className={`inline-flex items-center text-amber-400 ${className}`} role="img" aria-label={`별점 ${value}점`} style={{ fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={n <= full ? '' : 'opacity-25 grayscale'}>
          ★
        </span>
      ))}
    </span>
  )
}

/** 별점 고르기 (1~5) */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          onClick={() => onChange(n)}
          className={`text-[1.75rem] leading-none transition hover:scale-110 ${n <= value ? 'text-amber-400' : 'text-(--c-muted)/30'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/**
 * 검색 결과에 붙는 한 줄: "★ 4.3 · 리뷰 3개 · 🔥 지도 12개에 담김".
 * 아무도 안 담은 장소(stats 없음)는 "리뷰 0개" 만 흐리게. 많이 담긴 곳(5개 이상)은 불꽃을 붙인다.
 */
export function PlaceStatsLine({ stats, externalId, className = '' }: { stats: PlaceStats | undefined; externalId: string; className?: string }) {
  if (!stats || stats.mapCount === 0) return <p className={`text-xs text-(--c-muted) ${className}`}>리뷰 0개</p>
  return (
    <Link
      href={placeHref(externalId)}
      target="_blank"
      className={`inline-flex flex-wrap items-center gap-x-1.5 text-xs font-semibold hover:underline ${className}`}
      title="장소 리뷰 · 이 장소를 담은 지도 보기"
    >
      {stats.avgRating != null && (
        <span>
          <span className="text-amber-500">★</span> {stats.avgRating.toFixed(1)} ·
        </span>
      )}
      <span>리뷰 {stats.reviewCount}개</span>
      <span className="text-(--c-accent)">
        · {stats.mapCount >= 5 && '🔥 '}지도 {stats.mapCount}개에 담김
      </span>
    </Link>
  )
}
