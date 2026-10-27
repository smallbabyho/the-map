import type { BadgeStats, MapCategory } from '../types'
import { categoryMeta } from './mapCategories'
import { REGIONS } from './regions'

// 🏅 배지: 공개 지도로 센 숫자(BadgeStats)로 자동으로 받는다. 따로 저장하지 않는다.
// 배지마다 단계(tiers)가 있고, 숫자가 단계를 넘을 때마다 Lv 이 오른다.

export interface Badge {
  id: string
  emoji: string
  name: string
  /** 어떻게 받는지 (Lv 1 기준) */
  hint: string
  /** 지금 숫자 */
  value: number
  /** Lv 1, 2, 3 … 에 필요한 숫자 */
  tiers: number[]
  /** 받은 단계 (0 = 아직) */
  level: number
  /** 다음 단계 숫자. 다 받았으면 null */
  next: number | null
  /** 지역 · 카테고리 배지: 아직이면 '더 보기' 안에 둔다 */
  hiddenUntilEarned?: boolean
}

interface BadgeDef {
  id: string
  emoji: string
  name: string
  hint: (first: number) => string
  tiers: number[]
  value: (s: BadgeStats) => number
  hiddenUntilEarned?: boolean
}

const CATEGORY_BADGES: Partial<Record<MapCategory, string>> = {
  food: '맛집 탐험가',
  cafe: '카페 순례자',
  date: '데이트 장인',
  trip: '여행 작가',
  daytrip: '당일치기 달인',
  walk: '산책 러버',
  culture: '문화 애호가',
  fandom: '성지순례자',
}

const DEFS: BadgeDef[] = [
  { id: 'places', emoji: '👣', name: '세상을 누비는 중', hint: (n) => `기록 지도에 장소 ${n}곳 담기`, tiers: [1, 10, 30, 100, 300], value: (s) => s.places },
  {
    id: 'regions',
    emoji: '🗺️',
    name: '전국 누비기',
    hint: (n) => `${n}곳의 시 · 도 누비기`,
    tiers: [2, 5, 10, 17],
    value: (s) => Object.values(s.regions).filter((n) => n > 0).length,
  },
  { id: 'records', emoji: '📖', name: '기록가', hint: (n) => `공개 기록 지도 ${n}개`, tiers: [1, 5, 15, 30], value: (s) => s.recordMaps },
  { id: 'reviews', emoji: '✍️', name: '리뷰어', hint: (n) => `장소 리뷰 ${n}개 쓰기`, tiers: [1, 10, 30, 100], value: (s) => s.reviews },
  { id: 'joined', emoji: '🚩', name: '순례 동행', hint: (n) => `성지순례 ${n}번 체크인`, tiers: [1, 5, 15], value: (s) => s.meetupsJoined },
  { id: 'hosted', emoji: '📣', name: '순례 대장', hint: (n) => `성지순례 ${n}번 열기`, tiers: [1, 3, 10], value: (s) => s.meetupsHosted },
  { id: 'copied', emoji: '✨', name: '영감을 주는 사람', hint: (n) => `내 지도를 ${n}명이 가져가기`, tiers: [1, 10, 50], value: (s) => s.copied },
  ...Object.entries(CATEGORY_BADGES).map(([id, name]): BadgeDef => ({
    id: `cat-${id}`,
    emoji: categoryMeta(id as MapCategory).emoji,
    name,
    hint: (n) => `${categoryMeta(id as MapCategory).label} 기록 지도 ${n}개`,
    tiers: [1, 3, 10],
    value: (s) => s.categories[id as MapCategory] ?? 0,
    hiddenUntilEarned: true,
  })),
  ...REGIONS.map((r): BadgeDef => ({
    id: `region-${r.id}`,
    emoji: r.id === 'jeju' ? '🍊' : '📍',
    name: `${r.label} 누비미`,
    hint: (n) => `${r.label}에서 장소 ${n}곳 누비기`,
    tiers: [5, 15, 40],
    value: (s) => s.regions[r.id] ?? 0,
    hiddenUntilEarned: true,
  })),
]

/**
 * 숫자 → 배지 목록. 받은 배지(높은 Lv 먼저) → 아직 못 받은 배지 (기본 → 카테고리 · 지역) 순.
 *
 * @example
 * computeBadges(stats).filter((b) => b.level > 0) // 받은 배지
 */
export function computeBadges(stats: BadgeStats): Badge[] {
  const all = DEFS.map((d): Badge => {
    const value = d.value(stats)
    const level = d.tiers.filter((t) => value >= t).length
    return {
      id: d.id,
      emoji: d.emoji,
      name: d.name,
      hint: d.hint(d.tiers[Math.min(level, d.tiers.length - 1)]),
      value,
      tiers: d.tiers,
      level,
      next: d.tiers[level] ?? null,
      hiddenUntilEarned: d.hiddenUntilEarned,
    }
  })
  const earned = all.filter((b) => b.level > 0).sort((a, b) => b.level / b.tiers.length - a.level / a.tiers.length)
  const locked = all.filter((b) => b.level === 0)
  return [...earned, ...locked.filter((b) => !b.hiddenUntilEarned), ...locked.filter((b) => b.hiddenUntilEarned)]
}
