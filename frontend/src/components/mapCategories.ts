import type { MapCategory } from '../types'

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
