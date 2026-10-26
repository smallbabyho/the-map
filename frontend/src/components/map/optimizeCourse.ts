'use client'

import { straightDistance, type LatLngLike } from './routing'

// 핀 순서를 이동 거리가 가장 짧아지게 다시 짠다 (첫 핀 = 출발지는 그대로, 끝은 어디든).
// 거리는 OpenStreetMap 길찾기(OSRM)의 '걷는 길' 거리표를 한 번에 받아 쓰고, 실패하면 직선거리로.
// 핀이 EXACT_MAX 개 이하면 모든 순서를 따져 가장 짧은 것을, 그보다 많으면 가까운 곳 잇기 + 꼬인 구간 풀기(2-opt).

const EXACT_MAX = 13

export interface CourseResult {
  /** 새 순서 (원래 배열의 index) */
  order: number[]
  beforeM: number
  afterM: number
  /** true 면 실제 길 대신 직선거리로 계산 */
  estimated: boolean
}

/**
 * @example
 * const r = await optimizeCourse(pins.map((p) => p.place))
 * // r.order = [0, 2, 1, 3], r.beforeM = 4200, r.afterM = 3100
 */
export async function optimizeCourse(points: LatLngLike[]): Promise<CourseResult> {
  const n = points.length
  const identity = points.map((_, i) => i)
  if (n < 3) return { order: identity, beforeM: 0, afterM: 0, estimated: true }

  let estimated = false
  let dist = await walkingMatrix(points).catch(() => null)
  if (!dist) {
    estimated = true
    dist = points.map((a) => points.map((b) => straightDistance(a, b)))
  }
  const length = (order: number[]) => order.slice(1).reduce((sum, to, i) => sum + dist[order[i]][to], 0)
  const order = n <= EXACT_MAX ? exactOrder(dist) : twoOpt(nearestOrder(dist), length)
  const beforeM = length(identity)
  const afterM = length(order)
  // 더 짧아지지 않으면 원래 순서 그대로
  return afterM < beforeM ? { order, beforeM, afterM, estimated } : { order: identity, beforeM, afterM: beforeM, estimated }
}

/** OSRM table: 모든 핀 사이 걷는 거리(m). 길이 없는 칸은 직선거리로 채운다 */
async function walkingMatrix(points: LatLngLike[]): Promise<number[][]> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const res = await fetch(`https://routing.openstreetmap.de/routed-foot/table/v1/driving/${coords}?annotations=distance`)
  if (!res.ok) throw new Error(`거리표 실패 (${res.status})`)
  const data = (await res.json()) as { code: string; distances?: (number | null)[][] }
  if (data.code !== 'Ok' || !data.distances) throw new Error('거리표를 받지 못했어요')
  return data.distances.map((row, i) => row.map((d, j) => d ?? straightDistance(points[i], points[j])))
}

/** 0 에서 출발해 모두 들르는 가장 짧은 순서 (Held-Karp, n ≤ EXACT_MAX) */
function exactOrder(dist: number[][]): number[] {
  const n = dist.length
  const m = n - 1 // 0 을 뺀 나머지
  const size = 1 << m
  const best = new Float64Array(size * m).fill(Infinity)
  const prev = new Int8Array(size * m).fill(-1)
  for (let j = 0; j < m; j++) best[(1 << j) * m + j] = dist[0][j + 1]
  for (let mask = 1; mask < size; mask++) {
    for (let j = 0; j < m; j++) {
      const cur = best[mask * m + j]
      if (!(mask & (1 << j)) || cur === Infinity) continue
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue
        const next = mask | (1 << k)
        const d = cur + dist[j + 1][k + 1]
        if (d < best[next * m + k]) {
          best[next * m + k] = d
          prev[next * m + k] = j
        }
      }
    }
  }
  const full = size - 1
  let last = 0
  for (let j = 1; j < m; j++) if (best[full * m + j] < best[full * m + last]) last = j
  const order: number[] = []
  for (let mask = full, j = last; j !== -1; ) {
    order.push(j + 1)
    const p = prev[mask * m + j]
    mask &= ~(1 << j)
    j = p
  }
  return [0, ...order.reverse()]
}

/** 가장 가까운 곳부터 잇기 */
function nearestOrder(dist: number[][]): number[] {
  const left = new Set(dist.map((_, i) => i).slice(1))
  const order = [0]
  while (left.size) {
    const from = order[order.length - 1]
    let pick = -1
    for (const i of left) if (pick < 0 || dist[from][i] < dist[from][pick]) pick = i
    order.push(pick)
    left.delete(pick)
  }
  return order
}

/** 구간을 뒤집어 보며 더 짧아지면 반영 (첫 핀은 고정) */
function twoOpt(order: number[], length: (o: number[]) => number): number[] {
  let best = order
  let bestLen = length(best)
  for (let improved = true; improved; ) {
    improved = false
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const next = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)]
        const len = length(next)
        if (len < bestLen - 0.5) {
          best = next
          bestLen = len
          improved = true
        }
      }
    }
  }
  return best
}
