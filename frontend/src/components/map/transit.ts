import type { LatLngLike } from './routing'

// ODsay 대중교통 길찾기 (https://lab.odsay.com). 키는 frontend/.env.local 의 NEXT_PUBLIC_ODSAY_KEY.
// ODsay 웹 키는 등록한 주소에서만 동작하는 '공개용' 키라 브라우저에 있어도 된다.

const KEY = (process.env.NEXT_PUBLIC_ODSAY_KEY ?? '').trim()
export const hasTransitKey = KEY.length > 0

/**
 * 단계 종류. walk: 걷기 / bus · subway: 시내 / train: 기차 / intercityBus: 고속·시외버스 / air: 비행기
 * access: 장거리일 때 출발지 → 역·공항, 역·공항 → 도착지 이동 (ODsay 가 안 알려줘서 예상치)
 */
export type TransitStepKind = 'walk' | 'bus' | 'subway' | 'train' | 'intercityBus' | 'air' | 'access'

/** 대중교통 구간 안의 한 단계 */
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
  /** 예상치 (access 단계) */
  estimated?: boolean
}

export interface TransitInfo {
  steps: TransitStep[]
  /** 요금(원). 모르면 null */
  fare: number | null
  /** 환승 횟수 */
  transfers: number
  /** 도시 간 이동(기차·고속버스·비행기)이면 true */
  intercity: boolean
}

/** 단계 아이콘 */
export const STEP_ICON: Record<TransitStepKind, string> = {
  walk: '🚶',
  bus: '🚌',
  subway: '🚇',
  train: '🚄',
  intercityBus: '🚍',
  air: '✈️',
  access: '🚕',
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
const TRAIN_COLORS = { KTX: '#1B4C9C', SRT: '#6B2C5F', 일반열차: '#4B5563' }
const INTERCITY_BUS_COLOR = '#7C3AED'
const AIR_COLOR = '#0284C7'
/** SRT 가 서는 수도권 역 (ODsay 는 KTX·SRT 를 구분해 주지 않아서 역으로 판단) */
const SRT_STATIONS = ['수서', '동탄', '평택지제']

/**
 * 열차 이름. ODsay 의 trainType 은 믿기 어려워서 평균 속도로 고속열차인지 본다 (110km/h 이상).
 * 서울→부산 402km/138분 = 175km/h → KTX, 수서 출발 → SRT
 */
function trainName(s: { distance: number; sectionTime: number; startName?: string; endName?: string }): keyof typeof TRAIN_COLORS {
  const kmh = s.distance / 1000 / (s.sectionTime / 60)
  if (kmh < 110) return '일반열차'
  return SRT_STATIONS.includes(s.startName ?? '') || SRT_STATIONS.includes(s.endName ?? '') ? 'SRT' : 'KTX'
}

interface OdsayLane {
  name?: string
  busNo?: string
  type?: number
  subwayCode?: number
}
interface OdsaySubPath {
  /** 1 지하철, 2 버스, 3 걷기, 4 기차, 5 고속버스, 6 시외버스, 7 비행기 */
  trafficType: 1 | 2 | 3 | 4 | 5 | 6 | 7
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
      info: { totalTime: number; payment?: number; totalPayment?: number; busTransitCount?: number; subwayTransitCount?: number; totalDistance?: number; mapObj?: string }
      subPath: OdsaySubPath[]
    }[]
  }
  error?: unknown
}

/** "수도권 2호선" → "2호선" */
const shortLine = (name: string) => name.replace(/^(수도권|부산|대구|광주|대전)\s*/, '')

interface OdsayLaneResponse {
  result?: { lane?: { class: number; section: { graphPos: { x: number; y: number }[] }[] }[] }
  error?: unknown
}

/** loadLane 응답 → 타는 구간(버스·지하철)별 실제 노선 모양 (도로·선로를 따라감), 타는 순서대로 */
export function parseLanes(data: OdsayLaneResponse): LatLngLike[][] | null {
  const lanes = data.result?.lane
  if (!lanes?.length) return null
  return lanes.map((l) => l.section.flatMap((s) => s.graphPos.map((g) => ({ lat: g.y, lng: g.x }))))
}

/**
 * ODsay 응답 → 화면용 정보. 경로가 없으면 null.
 * lanes(loadLane 결과)가 있으면 버스·지하철 선을 실제 노선 모양으로, 없으면 정류장을 이은 선으로.
 */
export function parseOdsay(data: OdsayResponse, from: LatLngLike, to: LatLngLike, lanes?: LatLngLike[][] | null): TransitResult | null {
  const best = data.result?.path?.[0]
  if (!best) return null
  const subs = best.subPath

  // 타는 구간의 시작/끝 좌표 (걷기 구간은 좌표가 없어서 앞뒤 구간에서 가져온다)
  const startOf = (s: OdsaySubPath): LatLngLike | null => (s.startY != null && s.startX != null ? { lat: +s.startY, lng: +s.startX } : null)
  const endOf = (s: OdsaySubPath): LatLngLike | null => (s.endY != null && s.endX != null ? { lat: +s.endY, lng: +s.endX } : null)

  // 타는 구간 수와 노선 모양 수가 같을 때만 순서대로 맞춰 쓴다
  const rideCount = subs.filter((s) => s.trafficType !== 3).length
  const shapes = lanes && lanes.length === rideCount ? lanes : null
  let ride = 0

  const steps: TransitStep[] = subs.map((s, i) => {
    if (s.trafficType === 3) {
      const a = i === 0 ? from : (endOf(subs[i - 1]) ?? from)
      const b = i === subs.length - 1 ? to : (startOf(subs[i + 1]) ?? to)
      return { kind: 'walk', minutes: s.sectionTime, distanceM: s.distance, path: [a, b] }
    }
    const lanes = s.lane ?? []
    const stations = s.passStopList?.stations.map((st) => ({ lat: +st.y, lng: +st.x })) ?? []
    const shape = shapes?.[ride++]
    const path = shape && shape.length >= 2 ? shape : stations.length >= 2 ? stations : [startOf(s) ?? from, endOf(s) ?? to]
    const common = { minutes: s.sectionTime, distanceM: s.distance, from: s.startName, to: s.endName, path }
    // 도시 간: 기차 · 고속/시외버스 · 비행기 (노선 모양이 없어서 역끼리 직선)
    if (s.trafficType === 4) {
      const name = trainName(s)
      return { kind: 'train', ...common, name, color: TRAIN_COLORS[name] }
    }
    if (s.trafficType === 5 || s.trafficType === 6) {
      return { kind: 'intercityBus', ...common, name: s.trafficType === 5 ? '고속버스' : '시외버스', color: INTERCITY_BUS_COLOR }
    }
    if (s.trafficType === 7) return { kind: 'air', ...common, name: '비행기', color: AIR_COLOR }
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
  const intercity = steps.some((s) => s.kind === 'train' || s.kind === 'intercityBus' || s.kind === 'air')
  return {
    info: { steps, fare: best.info.payment ?? best.info.totalPayment ?? null, transfers: Math.max(0, rides - 1), intercity },
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
  const mapObj = data.result?.path?.[0]?.info.mapObj
  const lanes = mapObj ? await loadLanes(mapObj).catch(() => null) : null
  return parseOdsay(data, from, to, lanes)
}

/** 노선 실제 모양 (실패하면 null → 정류장을 이은 선으로 대신) */
async function loadLanes(mapObj: string): Promise<LatLngLike[][] | null> {
  const q = new URLSearchParams({ mapObject: `0:0@${mapObj}`, apiKey: KEY })
  const res = await fetch(`https://api.odsay.com/v1/api/loadLane?${q}`)
  if (!res.ok) return null
  const data = (await res.json()) as OdsayLaneResponse
  return data.error ? null : parseLanes(data)
}
