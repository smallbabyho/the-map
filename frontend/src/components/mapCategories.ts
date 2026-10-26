import type { ConceptMap, MapCategory } from '../types'

/** 지도 카테고리 (둘러보기 · 편집 화면에서 고르기). 순서 = 화면에 보이는 순서 */
export const MAP_CATEGORIES: { id: MapCategory; label: string; emoji: string }[] = [
  { id: 'food', label: '맛집 투어', emoji: '🍜' },
  { id: 'cafe', label: '카페 투어', emoji: '☕' },
  { id: 'date', label: '데이트 코스', emoji: '💕' },
  { id: 'trip', label: '1박 2일 여행', emoji: '🧳' },
  { id: 'daytrip', label: '당일치기', emoji: '🚗' },
  { id: 'walk', label: '산책 · 나들이', emoji: '🌳' },
  { id: 'culture', label: '전시 · 문화', emoji: '🎨' },
  { id: 'fandom', label: '촬영지 · 덕질', emoji: '🎬' },
  { id: 'etc', label: '기타', emoji: '📍' },
]

export function categoryMeta(id: MapCategory | undefined) {
  return MAP_CATEGORIES.find((c) => c.id === id) ?? MAP_CATEGORIES[MAP_CATEGORIES.length - 1]
}

/** 카드 · 지도 화면에 보일 카테고리: 직접 적은 이름이 있으면 그걸로 ('기타' 대신) */
export function mapCategoryText(map: Pick<ConceptMap, 'category'> & { categoryLabel?: string | null }) {
  const meta = categoryMeta(map.category)
  return map.category === 'etc' && map.categoryLabel ? { emoji: '🏷️', label: map.categoryLabel } : meta
}

// 검색어로 기본 카테고리 찾기: 이름 낱말 + 자주 쓰는 말
const KEYWORDS: Partial<Record<MapCategory, string[]>> = {
  food: ['맛집', '먹방', '밥', '음식', '식당'],
  cafe: ['카페', '커피', '디저트'],
  date: ['데이트', '커플'],
  trip: ['여행', '1박', '숙소'],
  daytrip: ['당일치기', '드라이브'],
  walk: ['산책', '나들이', '공원', '힐링', '자연'],
  culture: ['전시', '문화', '미술', '박물관', '공연'],
  fandom: ['촬영지', '덕질', '드라마', '영화', '성지'],
}

/**
 * 검색어에 맞는 기본 카테고리 id ('기타' 제외)
 *
 * @example
 * categoriesMatching('성수 카페') // ['cafe']
 */
export function categoriesMatching(q: string): MapCategory[] {
  const words = q.trim().split(/\s+/).filter(Boolean)
  return MAP_CATEGORIES.filter((c) => c.id !== 'etc')
    .filter((c) => {
      const names = [...c.label.split(/[\s·]+/).filter((w) => w.length > 1), ...(KEYWORDS[c.id] ?? [])]
      // 한 글자 검색어는 똑같을 때만 ('카' 로 카페가 다 나오지 않게)
      return words.some((w) => names.some((n) => n === w || (w.length > 1 && (n.includes(w) || w.includes(n)))))
    })
    .map((c) => c.id)
}
