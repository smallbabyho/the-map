'use client'

import { useEffect, useState } from 'react'
import type { TravelMode } from '../../types'
import { searchTransit, type TransitInfo } from './transit'

// 핀과 핀 사이의 실제 길(경로선 · 거리 · 시간)을 구한다.
//
// - 도보 · 자전거 · 자동차: OpenStreetMap 길찾기(OSRM, routing.openstreetmap.de). 키 없이 쓸 수 있는 공개 서버.
//   공개 서버는 개발용이라, 서비스 오픈 전에 카카오모빌리티 등으로 바꿀 땐 fetchRoad() 만 고치면 된다.
// - 대중교통: ODsay 키(NEXT_PUBLIC_ODSAY_KEY)가 있으면 버스 번호·지하철 노선·환승·요금까지 (transit.ts).
//   키가 없으면 직선거리로 시간을 '예상'한다 (선도 직선).
// - 길찾기에 실패하면(오프라인 등) 직선거리 예상치로 대신한다. 화면이 멈추지 않게.

export interface LatLngLike {
  lat: number
  lng: number
}

export interface Route {
  /** 경로선 좌표 (출발 → 도착) */
  path: LatLngLike[]
  distanceM: number
  durationMin: number
  /** true 면 실제 길이 아니라 직선거리로 예상한 값 */
  estimated: boolean
  /** 대중교통 상세 (버스·지하철 단계, 요금, 환승). 대중교통 + ODsay 키가 있을 때만 */
  transit?: TransitInfo
}

const OSRM_PROFILE: Record<Exclude<TravelMode, 'transit'>, string> = {
  walk: 'routed-foot',
  bike: 'routed-bike',
  car: 'routed-car',
}
/** OSRM 자동차 시간은 신호·정체가 없는 값이라 도심 기준으로 늘려 잡는다 */
const CAR_CITY_FACTOR = 1.6
/** 직선 예상: km/h, 직선 대비 실제 길 비율, 기본으로 더하는 분(대기·환승·주차) */
const ESTIMATE: Record<TravelMode, { kmh: number; detour: number; extraMin: number }> = {
  walk: { kmh: 4.5, detour: 1.3, extraMin: 0 },
  bike: { kmh: 14, detour: 1.3, extraMin: 0 },
  car: { kmh: 20, detour: 1.4, extraMin: 3 },
  transit: { kmh: 20, detour: 1.4, extraMin: 8 },
}

/** 두 지점 사이 직선거리(m) */
export function straightDistance(a: LatLngLike, b: LatLngLike) {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function estimate(from: LatLngLike, to: LatLngLike, mode: TravelMode): Route {
  const e = ESTIMATE[mode]
  const distanceM = straightDistance(from, to) * e.detour
  // 아주 가까우면 대중교통 대신 걸어가는 셈 치기
  const minutes = mode === 'transit' && distanceM < 800 ? (distanceM / 1000 / ESTIMATE.walk.kmh) * 60 : (distanceM / 1000 / e.kmh) * 60 + e.extraMin
  return { path: [from, to], distanceM, durationMin: Math.max(1, Math.round(minutes)), estimated: true }
}

async function fetchRoad(from: LatLngLike, to: LatLngLike, mode: Exclude<TravelMode, 'transit'>): Promise<Route> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const url = `https://routing.openstreetmap.de/${OSRM_PROFILE[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`길찾기 실패 (${res.status})`)
  const data = (await res.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
  const r = data.routes?.[0]
  if (data.code !== 'Ok' || !r) throw new Error('길을 찾지 못했어요')
  const seconds = mode === 'car' ? r.duration * CAR_CITY_FACTOR : r.duration
  return {
    // 경로 양 끝을 핀 위치에 붙여서 선이 핀에서 시작·끝나게
    path: [from, ...r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), to],
    distanceM: r.distance,
    durationMin: Math.max(1, Math.round(seconds / 60)),
    estimated: false,
  }
}

async function fetchTransit(from: LatLngLike, to: LatLngLike): Promise<Route> {
  const r = await searchTransit(from, to)
  if (!r) return estimate(from, to, 'transit')
  // 걷는 부분(정류장·역까지)도 실제 길을 따라가게. 실패하면 직선 그대로.
  const steps = await Promise.all(
    r.info.steps.map(async (s) => {
      if (s.kind !== 'walk' || s.distanceM <= 0) return s
      const walk = await fetchRoad(s.path[0], s.path[s.path.length - 1], 'walk').catch(() => null)
      return walk ? { ...s, path: walk.path } : s
    }),
  )
  return {
    path: [from, ...steps.flatMap((s) => s.path), to],
    distanceM: r.distanceM,
    durationMin: Math.max(1, r.durationMin),
    estimated: false,
    transit: { ...r.info, steps },
  }
}

// 같은 구간은 한 번만 요청 (지도 · 목록 · 저장이 같은 결과를 공유)
const pending = new Map<string, Promise<Route>>()
const done = new Map<string, Route>()
const keyOf = (from: LatLngLike, to: LatLngLike, mode: TravelMode) =>
  `${mode}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`

/**
 * 구간 경로 구하기. 실패해도 reject 하지 않고 직선 예상치를 돌려준다.
 *
 * @example
 * const r = await getRoute({ lat: 37.5447, lng: 127.0557 }, { lat: 37.5443, lng: 127.0446 }, 'walk')
 * // r.durationMin === 18, r.distanceM ≈ 1330, r.path = [...]
 */
export function getRoute(from: LatLngLike, to: LatLngLike, mode: TravelMode): Promise<Route> {
  const key = keyOf(from, to, mode)
  let p = pending.get(key)
  if (!p) {
    const request = mode === 'transit' ? fetchTransit(from, to) : fetchRoad(from, to, mode)
    p = request
      .catch(() => estimate(from, to, mode))
      .then((r) => {
        done.set(key, r)
        return r
      })
    pending.set(key, p)
  }
  return p
}

/** 이미 받아 둔 경로 (없으면 undefined) */
export function cachedRoute(from: LatLngLike, to: LatLngLike, mode: TravelMode): Route | undefined {
  return done.get(keyOf(from, to, mode))
}

export interface RouteRequest {
  from: LatLngLike
  to: LatLngLike
  mode: TravelMode
}

/**
 * 여러 구간의 경로를 받아 오고, 도착할 때마다 다시 그리게 한다.
 * routeOf 로 구간별 경로를 꺼낸다 (아직 없으면 undefined).
 *
 * @example
 * const { routeOf } = useRoutes(legs.map((l) => ({ from: a, to: b, mode: l.mode })))
 * routeOf(a, b, 'walk')?.durationMin
 */
export function useRoutes(requests: RouteRequest[]) {
  const [version, setVersion] = useState(0)
  const wanted = requests.map((r) => keyOf(r.from, r.to, r.mode)).join('|')

  useEffect(() => {
    let cancelled = false
    for (const r of requests) {
      if (cachedRoute(r.from, r.to, r.mode)) continue
      getRoute(r.from, r.to, r.mode).then(() => !cancelled && setVersion((v) => v + 1))
    }
    return () => {
      cancelled = true
    }
    // requests 는 매번 새 배열이라 좌표·이동수단 문자열(wanted)이 바뀔 때만 다시 요청한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  /** version: 새 경로가 도착할 때마다 바뀜 (useMemo 의존성용) */
  return { routeOf: cachedRoute, version }
}

/** 경로선의 '거리 기준' 가운데 지점 (구간 라벨 위치) */
export function pathMidpoint(path: LatLngLike[]): LatLngLike {
  if (path.length < 2) return path[0]
  const seg = path.slice(1).map((p, i) => straightDistance(path[i], p))
  let half = seg.reduce((s, d) => s + d, 0) / 2
  for (let i = 0; i < seg.length; i++) {
    if (half <= seg[i] && seg[i] > 0) {
      const t = half / seg[i]
      return { lat: path[i].lat + (path[i + 1].lat - path[i].lat) * t, lng: path[i].lng + (path[i + 1].lng - path[i].lng) * t }
    }
    half -= seg[i]
  }
  return path[path.length - 1]
}

/** 1234 → "1.2km", 340 → "340m" */
export function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km` : `${Math.round(m / 10) * 10}m`
}
