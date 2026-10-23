import type { LatLngLike } from './routing'

// ODsay 대중교통 길찾기 (https://lab.odsay.com). 키는 frontend/.env.local 의 NEXT_PUBLIC_ODSAY_KEY.
// ODsay 웹 키는 등록한 주소에서만 동작하는 '공개용' 키라 브라우저에 있어도 된다.

const KEY = (process.env.NEXT_PUBLIC_ODSAY_KEY ?? '').trim()
export const hasTransitKey = KEY.length > 0

export type TransitStepKind = 'walk' | 'bus' | 'subway'

/** 대중교통 구간 안의 한 단계: 걷기 / 버스 타기 / 지하철 타기 */
export interface TransitStep {
  kind: TransitStepKind
  minutes: number
  distanceM: number
  /** 버스 번호("2412") 또는 노선("2호선"). 걷기는 없음 */
  name?: string
  /** 노선 색 */
  color?: string
  /** 타는 곳 · 내리는 곳 */
  from?: string
  to?: string
  /** 지나는 정류장 수 */
  stops?: number
  path: LatLngLike[]
}

export interface TransitInfo {
  steps: TransitStep[]
  /** 요금(원). 모르면 null */
  fare: number | null
  /** 환승 횟수 */
  transfers: number
}

export interface TransitResult {
  info: TransitInfo
  path: LatLngLike[]
  distanceM: number
  durationMin: number
}

// 수도권 지하철 노선 색 (ODsay subwayCode). 없는 노선은 기본색.
const SUBWAY_COLORS: Record<number, string> = {
  1: '#0052A4', 2: '#00A84D', 3: '#EF7C1C', 4: '#00A5DE', 5: '#996CAC', 6: '#CD7C2F', 7: '#747F00', 8: '#E6186C', 9: '#BDB092',
  101: '#0090D2', 104: '#77C4A3', 107: '#ADD13B', 108: '#F5A200', 109: '#D4003B', 113: '#B0CE18', 116: '#F5A200',
}
// 버스 종류 (ODsay bus type) → 색. 간선 파랑, 지선 초록, 광역 빨강, 마을 연두, 그 외 회색
const BUS_COLORS: Record<number, string> = { 11: '#3D5BAB', 12: '#5BB025', 13: '#F2B70A', 14: '#E60012', 4: '#E60012', 15: '#E60012', 3: '#53B332', 6: '#AA9872' }
const DEFAULT_SUBWAY = '#6b7280'
const DEFAULT_BUS = '#3D5BAB'

interface OdsayLane {
  name?: string
  busNo?: string
  type?: number
  subwayCode?: number
}
interface OdsaySubPath {
  trafficType: 1 | 2 | 3
  distance: number
  sectionTime: number
  stationCount?: number
  lane?: OdsayLane[]
  startName?: string
  endName?: string
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  passStopList?: { stations: { x: string | number; y: string | number }[] }
}
interface OdsayResponse {
  result?: {
    path?: {
      info: { totalTime: number; payment?: number; busTransitCount?: number; subwayTransitCount?: number; totalDistance?: number }
      subPath: OdsaySubPath[]
    }[]
  }
  error?: unknown
}

/** "수도권 2호선" → "2호선" */
const shortLine = (name: string) => name.replace(/^(수도권|부산|대구|광주|대전)\s*/, '')

/** ODsay 응답 → 화면용 정보. 경로가 없으면 null */
export function parseOdsay(data: OdsayResponse, from: LatLngLike, to: LatLngLike): TransitResult | null {
  const best = data.result?.path?.[0]
  if (!best) return null
  const subs = best.subPath

  // 타는 구간의 시작/끝 좌표 (걷기 구간은 좌표가 없어서 앞뒤 구간에서 가져온다)
  const startOf = (s: OdsaySubPath): LatLngLike | null => (s.startY != null && s.startX != null ? { lat: +s.startY, lng: +s.startX } : null)
  const endOf = (s: OdsaySubPath): LatLngLike | null => (s.endY != null && s.endX != null ? { lat: +s.endY, lng: +s.endX } : null)

  const steps: TransitStep[] = subs.map((s, i) => {
    if (s.trafficType === 3) {
      const a = i === 0 ? from : (endOf(subs[i - 1]) ?? from)
      const b = i === subs.length - 1 ? to : (startOf(subs[i + 1]) ?? to)
      return { kind: 'walk', minutes: s.sectionTime, distanceM: s.distance, path: [a, b] }
    }
    const lanes = s.lane ?? []
    const stations = s.passStopList?.stations.map((st) => ({ lat: +st.y, lng: +st.x })) ?? []
    const path = stations.length >= 2 ? stations : [startOf(s) ?? from, endOf(s) ?? to]
    if (s.trafficType === 1) {
      const lane = lanes[0]
      return {
        kind: 'subway',
        minutes: s.sectionTime,
        distanceM: s.distance,
        name: shortLine(lane?.name ?? '지하철'),
        color: (lane?.subwayCode && SUBWAY_COLORS[lane.subwayCode]) || DEFAULT_SUBWAY,
        from: s.startName,
        to: s.endName,
        stops: s.stationCount,
        path,
      }
    }
    // 같은 정류장에서 탈 수 있는 버스가 여러 대면 앞의 두 개만
    const names = lanes.map((l) => l.busNo).filter(Boolean) as string[]
    return {
      kind: 'bus',
      minutes: s.sectionTime,
      distanceM: s.distance,
      name: names.length > 2 ? `${names.slice(0, 2).join(', ')} 외` : names.join(', ') || '버스',
      color: (lanes[0]?.type && BUS_COLORS[lanes[0].type]) || DEFAULT_BUS,
      from: s.startName,
      to: s.endName,
      stops: s.stationCount,
      path,
    }
  })

  const rides = steps.filter((s) => s.kind !== 'walk').length
  return {
    info: { steps, fare: best.info.payment ?? null, transfers: Math.max(0, rides - 1) },
    path: [from, ...steps.flatMap((s) => s.path), to],
    distanceM: best.info.totalDistance ?? steps.reduce((sum, s) => sum + s.distanceM, 0),
    durationMin: best.info.totalTime,
  }
}

/**
 * 대중교통 길찾기. 키가 없거나, 너무 가깝거나(ODsay 는 700m 이내 거절), 경로가 없으면 null.
 *
 * @example
 * const r = await searchTransit({ lat: 37.5447, lng: 127.0557 }, { lat: 37.5796, lng: 126.977 })
 * r?.info.steps // [{ kind: 'walk', minutes: 4 }, { kind: 'subway', name: '2호선', from: '성수', to: '시청' }, ...]
 */
export async function searchTransit(from: LatLngLike, to: LatLngLike): Promise<TransitResult | null> {
  if (!hasTransitKey) return null
  const q = new URLSearchParams({ SX: String(from.lng), SY: String(from.lat), EX: String(to.lng), EY: String(to.lat), apiKey: KEY })
  const res = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${q}`)
  if (!res.ok) throw new Error(`대중교통 길찾기 실패 (${res.status})`)
  const data = (await res.json()) as OdsayResponse
  if (data.error) return null
  return parseOdsay(data, from, to)
}
