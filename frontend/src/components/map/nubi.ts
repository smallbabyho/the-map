'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Pin } from '../../types'
import { ARRIVAL_RADIUS_M, currentPosition, distanceMeters } from '../../lib/arrival'
import { formatDistance, type LatLngLike } from './routing'
import { useSegments } from './segments'
import type { LiveTrack, MapLegView } from './types'
import { LOCATION_ERRORS, type MyPosition } from './useMyLocation'
import { load, store, type Saved } from './nubiStore'

// 누비기 모드: 코스를 따라 움직이는 동안 지금 위치 · 지나온 길 · 다음 장소까지 남은 거리 · 코스 진행도(%)를 계산한다.
// - 장소 근처(ARRIVE_M)에 들어가면 자동으로 '도착' 체크. 순서를 건너뛴 장소는 그대로 두고 다음으로 넘어간다.
// - 진행도는 도착한 곳 수가 아니라 '코스선 위에서 얼마나 왔는지' (지난 구간 길이 + 지금 구간에서 온 만큼) / 전체 길이.
// - 위치 · 지나온 길은 이 브라우저에만 저장한다 (새로고침해도 이어서). 서버로 보내지 않는다.

/** 이만큼 가까워지면 도착 (+ GPS 오차를 조금 봐준다). 성지순례 인증 반경(300m)보다 훨씬 좁게 잡아 지나치기만 해도 체크되지 않게 */
export const ARRIVE_M = 50
const ARRIVE_SLACK_MAX = 30
/** 코스선에서 이보다 멀면 '길을 벗어남' → 남은 거리는 직선으로 */
const OFF_ROUTE_M = 120
/** 오차가 이보다 크면 지나온 길에 넣지 않는다 (실내 · 건물 사이에서 튀는 점) */
const TRAIL_MAX_ACCURACY = 60
/** 이만큼 움직여야 지나온 길에 점을 더한다 */
const TRAIL_STEP_M = 8
const TRAIL_MAX = 3000
/** 위치를 지켜보는 중일 때 도착 버튼이 다시 재지 않고 믿는 마지막 위치의 나이 */
const STALE_WATCH_MS = 3 * 60_000
/** 경로선 길이(m) */
export function pathLength(path: LatLngLike[]) {
  let s = 0
  for (let i = 1; i < path.length; i++) s += distanceMeters(path[i - 1], path[i])
  return s
}

/** 경로선에서 p 와 가장 가까운 지점: 출발부터 그 지점까지 거리(along) · 떨어진 거리(off) */
export function projectOnPath(path: LatLngLike[], p: LatLngLike): { along: number; off: number } {
  if (path.length < 2) return { along: 0, off: path[0] ? distanceMeters(path[0], p) : Infinity }
  let best = { along: 0, off: Infinity }
  let walked = 0
  // 가까운 거리라 평면으로 보고 계산 (m 단위 x, y)
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180)
  const ky = 111320
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky
    const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0
    const off = Math.hypot(ax + dx * t, ay + dy * t)
    const len = Math.sqrt(len2)
    if (off < best.off) best = { along: walked + len * t, off }
    walked += len
  }
  return best
}

/** 경로선의 처음부터 distance(m)까지 잘라낸 선 */
export function slicePath(path: LatLngLike[], distance: number): LatLngLike[] {
  if (path.length < 2 || distance <= 0) return path.slice(0, 1)
  const out = [path[0]]
  let left = distance
  for (let i = 1; i < path.length; i++) {
    const d = distanceMeters(path[i - 1], path[i])
    if (d >= left) {
      const t = d ? left / d : 0
      out.push({ lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t })
      return out
    }
    out.push(path[i])
    left -= d
  }
  return out
}

export interface NubiState {
  /** 위치를 받고 있나 */
  active: boolean
  pos: MyPosition | null
  error: string
  startedAt: number | null
  /** 도착한 장소 id */
  visited: Set<string>
  /** 다음에 갈 장소 (다 돌았으면 null) */
  next: { pin: Pin; index: number } | null
  /** 다음 장소까지 남은 거리(m). 위치를 모르면 null */
  toNextM: number | null
  /** 다음 장소까지 남은 시간(분) 어림. 구간 이동 시간을 남은 거리 비율로 나눈 값 (코스를 벗어났거나 모르면 null) */
  toNextMin: number | null
  /** 코스를 벗어났나 (남은 거리가 직선거리) */
  offRoute: boolean
  /** 코스 진행도 0~100 */
  percent: number
  /** 코스 전체 길이(m) */
  totalM: number
  /** 장소마다 코스 위 위치(%) — 진행 띠에 장소 점을 찍는다 */
  pinPercents: number[]
  /** 실제로 움직인 거리(m) */
  movedM: number
  finished: boolean
  /** 지도에 넘길 값 */
  live: LiveTrack
  start: () => void
  stop: () => void
  /** 처음부터 다시 (도착 기록 · 지나온 길 지움) */
  reset: () => void
  /** 버튼으로 도착 체크: 지금 위치가 장소 ARRIVAL_RADIUS_M 안일 때만. 안 되면 이유(한 줄)를 돌려준다 */
  arriveHere: (pinId: string) => Promise<string | null>
}

/**
 * 누비기 모드 상태. storageKey 별로 이 브라우저에 이어서 저장된다 (지도 id, 순례방이면 모임 id).
 * onArrive: 자동으로 도착 체크될 때 (그때 위치와 함께). 순례방이면 이걸로 도착 인증을 보낸다.
 *
 * @example
 * const nubi = useNubi(pins, legs, `map:${map.id}`, map.title)
 * <MapView … live={nubi.live} />
 * nubi.percent // 37
 */
export function useNubi(pins: Pin[], legs: MapLegView[], storageKey: string, title: string, onArrive?: (pin: Pin, at: MyPosition) => void): NubiState {
  const segments = useSegments(pins, legs)
  const [saved, setSaved] = useState<Saved | null>(() => (typeof window === 'undefined' ? null : load(storageKey)))
  const [pos, setPos] = useState<MyPosition | null>(null)
  /** pos 를 받은 시각 (버튼 도착 체크 때 너무 오래된 위치면 다시 잰다) */
  const posAt = useRef(0)
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const watchId = useRef<number | null>(null)
  // 지금 구간에서 가장 멀리 온 만큼 (GPS 가 뒤로 튀어도 진행도가 줄지 않게)
  const [best, setBest] = useState<{ leg: number; along: number }>({ leg: -1, along: 0 })
  // 위치 콜백(이벤트)에서 최신 값을 읽기 위한 ref
  const latest = useRef({ pins, segments, saved, onArrive })
  const posRef = useRef(pos)
  // 도착 처리한 장소: 위치가 연달아 오거나 도착 버튼과 겹쳐도 같은 곳을 두 번 도착 처리하지 않게 바로 반영 (saved 는 다음 화면에서야 바뀐다)
  const doneRef = useRef(new Set(saved?.visited))
  // 마지막으로 저장한 '누비는 중' 요약. 위치가 올 때마다 저장하는 값에 같이 넣는다
  const summaryRef = useRef(saved?.summary)
  useEffect(() => {
    latest.current = { pins, segments, saved, onArrive }
    posRef.current = pos
  })

  const visited = useMemo(() => new Set(saved?.visited ?? []), [saved?.visited])
  const update = useCallback(
    (fn: (s: Saved) => Saved) =>
      setSaved((cur) => {
        const next = { ...fn(cur ?? { startedAt: Date.now(), visited: [], trail: [] }), summary: summaryRef.current }
        store(storageKey, next)
        return next
      }),
    [storageKey],
  )

  const stopWatch = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }
  useEffect(() => stopWatch, [])

  /** 새 위치 → 지나온 길에 더하고, 가까운 장소는 도착 체크, 지금 구간에서 온 만큼 기록 */
  const onPosition = useCallback(
    (p: MyPosition) => {
      setError('')
      setPos(p)
      posAt.current = Date.now()
      const { pins, segments, saved, onArrive } = latest.current
      const done = doneRef.current
      const slack = Math.min(p.accuracy, ARRIVE_SLACK_MAX)
      const arrived = pins.filter((pin) => !done.has(pin.id) && distanceMeters(p, pin.place) <= ARRIVE_M + slack)
      const last = saved?.trail[saved.trail.length - 1]
      const addTrail = p.accuracy <= TRAIL_MAX_ACCURACY && (!last || distanceMeters(last, p) >= TRAIL_STEP_M)
      if (arrived.length || addTrail) {
        update((s) => ({
          ...s,
          visited: arrived.length ? [...s.visited, ...arrived.map((a) => a.id).filter((id) => !s.visited.includes(id))] : s.visited,
          trail: addTrail ? [...s.trail, { lat: p.lat, lng: p.lng }].slice(-TRAIL_MAX) : s.trail,
        }))
      }
      for (const a of arrived) {
        done.add(a.id)
        onArrive?.(a, p)
      }
      if (arrived.length) navigator.vibrate?.(200)
      const leg = legProgress(pins, segments, done, p)
      if (leg) setBest((b) => (b.leg === leg.leg ? (leg.along > b.along ? { leg: leg.leg, along: leg.along } : b) : { leg: leg.leg, along: leg.along }))
    },
    [update],
  )

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) return setError('이 브라우저에서는 위치 기능을 쓸 수 없어요.')
    if (!window.isSecureContext) return setError('위치 기능은 https 또는 localhost 에서만 쓸 수 있어요.')
    setError('')
    setActive(true)
    update((s) => s)
    stopWatch()
    // 정확한 위치(GPS)는 첫 값이 늦거나 컴퓨터 · 실내에선 안 올 수 있어서, 대략 위치(와이파이)를 먼저 받아 둔다
    navigator.geolocation.getCurrentPosition(
      (p) => posAt.current === 0 && onPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => {},
      // 몇 분 전 위치라도 바로 띄워 두면 GPS 가 잡히는 동안 덜 기다린다 (곧 정확한 위치로 바뀐다)
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 },
    )
    watchId.current = navigator.geolocation.watchPosition(
      (p) => onPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        // 시간 초과는 지켜보기가 계속되니, 이미 위치가 있으면 조용히 넘어간다
        if (e.code === 3 && posAt.current) return
        setError(LOCATION_ERRORS[e.code] ?? '현재 위치를 가져오지 못했어요.')
        if (e.code === 1) {
          stopWatch()
          setActive(false)
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    )
  }, [update, onPosition])

  const stop = useCallback(() => {
    stopWatch()
    setActive(false)
  }, [])

  const reset = useCallback(() => {
    setBest({ leg: -1, along: 0 })
    doneRef.current = new Set()
    summaryRef.current = undefined
    store(storageKey, null)
    setSaved(active ? { startedAt: Date.now(), visited: [], trail: [] } : null)
  }, [storageKey, active])

  // 자동 체크(ARRIVE_M)보다 넓게: GPS 가 흔들려 자동으로 안 잡힐 때 쓰는 버튼이라 성지순례 도착 인증과 같은 반경
  const arriveHere = useCallback(
    async (pinId: string) => {
      const pin = pins.find((p) => p.id === pinId)
      if (!pin) return null
      let pos = posRef.current
      // 아이폰은 가만히 있으면 새 위치를 안 보내서, 지켜보는 중이면 조금 묵은 위치도 지금 위치로 본다 (다시 재면 10초 넘게 걸린다)
      if (!pos || Date.now() - posAt.current > (watchId.current != null ? STALE_WATCH_MS : 30_000)) {
        try {
          pos = await currentPosition()
        } catch (e) {
          return e instanceof Error ? e.message : '위치를 확인하지 못했어요.'
        }
        onPosition(pos)
        // 다시 잰 위치로 이미 자동 도착 처리됐으면 끝 (두 번 인증하지 않게)
        if (doneRef.current.has(pinId)) return null
      }
      if (pos.accuracy > ARRIVAL_RADIUS_M) return `위치가 정확하지 않아요 (오차 ${formatDistance(pos.accuracy)}). 밖으로 나가서 다시 눌러 주세요.`
      const d = distanceMeters(pos, pin.place)
      if (d > ARRIVAL_RADIUS_M) return `장소에서 ${formatDistance(d)} 떨어져 있어요. ${ARRIVAL_RADIUS_M}m 안에서 눌러 주세요.`
      if (doneRef.current.has(pinId)) return null
      doneRef.current.add(pinId)
      update((s) => (s.visited.includes(pinId) ? s : { ...s, visited: [...s.visited, pinId] }))
      latest.current.onArrive?.(pin, pos)
      return null
    },
    [pins, update, onPosition],
  )

  // 화면이 꺼지지 않게 (지원하는 브라우저만). 다른 앱에 갔다 오면 풀리므로 다시 건다
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const acquire = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [active])

  const state = useMemo(() => {
    const lengths = segments.map((s) => pathLength(s.path))
    const totalM = lengths.reduce((a, b) => a + b, 0)
    const pinPercents: number[] = []
    for (let i = 0, acc = 0; i < pins.length; acc += lengths[i] ?? 0, i++) {
      pinPercents.push(totalM ? (acc / totalM) * 100 : pins.length > 1 ? (i / (pins.length - 1)) * 100 : 0)
    }
    const prog = legProgress(pins, segments, visited, pos)
    const nextIndex = prog?.nextIndex ?? -1
    const finished = pins.length > 0 && nextIndex < 0
    const next = nextIndex >= 0 ? { pin: pins[nextIndex], index: nextIndex } : null

    let percent = finished ? 100 : 0
    let toNextM: number | null = prog?.toNextM ?? null
    let toNextMin: number | null = null
    let donePath: LatLngLike[] = []
    if (prog && prog.leg >= 0) {
      const { leg, len } = prog
      const along = Math.min(len, best.leg === leg ? Math.max(best.along, prog.along) : prog.along)
      const before = lengths.slice(0, leg).reduce((a, b) => a + b, 0)
      percent = totalM ? ((before + along) / totalM) * 100 : pinPercents[leg]
      donePath = [...segments.slice(0, leg).flatMap((s) => s.path), ...slicePath(segments[leg]?.path ?? [], along)]
      const legMin = segments[leg]?.durationMin
      if (toNextM != null && !prog.offRoute && legMin && len) toNextMin = Math.max(1, Math.round((legMin * toNextM) / len))
    } else if (finished) {
      donePath = segments.flatMap((s) => s.path)
      toNextM = null
    }

    return {
      active,
      pos,
      error,
      startedAt: saved?.startedAt ?? null,
      visited,
      next,
      toNextM,
      toNextMin,
      offRoute: prog?.offRoute ?? false,
      percent: Math.min(100, Math.max(0, percent)),
      totalM,
      pinPercents,
      movedM: pathLength(saved?.trail ?? []),
      finished,
      live: { me: pos, trail: saved?.trail ?? [], donePath, visited: [...visited] },
      start,
      stop,
      reset,
      arriveHere,
    }
  }, [segments, pins, visited, pos, active, error, saved, start, stop, reset, arriveHere, best])

  // 오른쪽 아래 일정 창 '누비는 중' 목록용 요약을 같이 저장 (진행도가 바뀔 때만)
  const percent = Math.round(state.percent)
  const done = state.visited.size
  const { finished } = state
  useEffect(() => {
    if (!saved) return
    const summary = { title, percent, done, total: pins.length, finished }
    const cur = summaryRef.current
    if (cur && cur.title === title && cur.percent === percent && cur.done === done && cur.total === summary.total && cur.finished === finished) return
    summaryRef.current = summary
    store(storageKey, { ...saved, summary })
  }, [saved, title, percent, done, pins.length, finished, storageKey])

  return state
}

/**
 * 지금 어디쯤인가: 다음 장소(마지막으로 도착한 곳 다음의 아직 안 간 곳 · 건너뛴 곳은 남겨 둔다)와
 * 지금 구간(앞 장소 → 다음 장소, 출발지로 가는 중이면 leg = -1)에서 온 거리 · 남은 거리. 다 돌았으면 null.
 */
function legProgress(pins: Pin[], segments: { path: LatLngLike[] }[], visited: Set<string>, pos: LatLngLike | null) {
  const lastDone = pins.reduce((m, p, i) => (visited.has(p.id) ? i : m), -1)
  const nextIndex = pins.findIndex((p, i) => i > lastDone && !visited.has(p.id))
  if (nextIndex < 0) return null
  const target = pins[nextIndex].place
  const straight = pos ? distanceMeters(pos, target) : null
  if (nextIndex === 0) return { nextIndex, leg: -1, len: 0, along: 0, offRoute: false, toNextM: straight }
  const leg = nextIndex - 1
  const path = segments[leg]?.path ?? []
  const len = pathLength(path)
  if (!pos || straight == null) return { nextIndex, leg, len, along: 0, offRoute: false, toNextM: null }
  const proj = projectOnPath(path, pos)
  const offRoute = proj.off > OFF_ROUTE_M
  const along = Math.min(len, offRoute ? Math.max(0, len - straight) : proj.along)
  return { nextIndex, leg, len, along, offRoute, toNextM: offRoute ? straight : Math.max(0, len - along) }
}
