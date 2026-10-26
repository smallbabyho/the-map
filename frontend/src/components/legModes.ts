import type { TravelMode } from '../types'

export const LEG_MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: 'walk', label: '도보', icon: '🚶' },
  { id: 'bus', label: '버스', icon: '🚌' },
  { id: 'subway', label: '지하철', icon: '🚇' },
  { id: 'car', label: '자동차', icon: '🚗' },
]

export function modeMeta(mode: TravelMode) {
  return LEG_MODES.find((m) => m.id === mode) ?? LEG_MODES[0]
}

/** 지도 위 구간 라벨: "🚇 15분" / 시간 없으면 아이콘만 */
export function legLabel(mode: TravelMode, durationMin: number | null) {
  const m = modeMeta(mode)
  return durationMin != null ? `${m.icon} ${durationMin}분` : m.icon
}
