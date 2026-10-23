import type { TravelMode } from '../types'

/**
 * 이동수단 4가지. line 은 지도 경로선 모양.
 * kakao: 카카오 Polyline strokeStyle / svg: 미리보기 지도 stroke-dasharray
 */
export const LEG_MODES: { id: TravelMode; label: string; icon: string; line: { kakao: string; svg?: string } }[] = [
  { id: 'walk', label: '도보', icon: '🚶', line: { kakao: 'shortdot', svg: '0.1 9' } },
  { id: 'transit', label: '대중교통', icon: '🚇', line: { kakao: 'shortdash', svg: '10 7' } },
  { id: 'car', label: '자동차', icon: '🚗', line: { kakao: 'solid' } },
  { id: 'bike', label: '자전거', icon: '🚲', line: { kakao: 'dash', svg: '16 7' } },
]

export function modeMeta(mode: TravelMode) {
  return LEG_MODES.find((m) => m.id === mode) ?? LEG_MODES[0]
}

/** 지도 위 구간 라벨: "🚇 15분" / 시간 없으면 아이콘만 */
export function legLabel(mode: TravelMode, durationMin: number | null) {
  const m = modeMeta(mode)
  return durationMin != null ? `${m.icon} ${durationMin}분` : m.icon
}
