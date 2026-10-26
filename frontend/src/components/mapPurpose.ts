import type { ConceptMap, MapPurpose } from '../types'

// 지도 용도: 기록(다녀온 곳) / 계획(갈 곳). 기록은 공유돼서 다른 사람의 계획이 된다.

export const MAP_PURPOSES: { id: MapPurpose; label: string; emoji: string; hint: string }[] = [
  { id: 'record', label: '기록', emoji: '📖', hint: '다녀온 곳을 사진 · 메모로 남겨요. 공개하면 다른 사람의 계획이 돼요.' },
  { id: 'plan', label: '계획', emoji: '🗓️', hint: '갈 곳을 코스로 짜요. 가는 날을 정하고 친구와 같이 꾸며요.' },
]

export function purposeMeta(purpose: MapPurpose) {
  return MAP_PURPOSES.find((p) => p.id === purpose) ?? MAP_PURPOSES[0]
}

/** 예전 데이터(용도 칸이 없던 때)는 공개 = 기록, 비공개 = 계획 */
export function mapPurpose(map: Pick<ConceptMap, 'isPublic'> & { purpose?: MapPurpose }): MapPurpose {
  return map.purpose ?? (map.isPublic ? 'record' : 'plan')
}
