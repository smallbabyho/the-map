import type { LatLngLike } from './routing'

// 누비기 기록 (이 브라우저 localStorage). 오른쪽 아래 일정 창도 읽어서 지도 코드 없이 가볍게 따로 둔다.

const STORE_PREFIX = 'the-map:nubi:v1:'
/** 이보다 오래된 누비기는 이어 하지 않고 새로 시작 */
const RESUME_MS = 24 * 3600_000

export interface Saved {
  startedAt: number
  visited: string[]
  trail: LatLngLike[]
  /** 오른쪽 아래 일정 창의 '누비는 중' 목록에 보여 줄 요약 */
  summary?: NubiSummary
}

export interface NubiSummary {
  title: string
  percent: number
  done: number
  total: number
  /** 코스를 다 돌았나 (건너뛴 장소가 있어도 마지막까지 왔으면 끝) */
  finished?: boolean
}

export function load(key: string): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_PREFIX + key) ?? 'null') as Saved | null
    return s && Date.now() - s.startedAt < RESUME_MS ? s : null
  } catch {
    return null
  }
}
export function store(key: string, s: Saved | null) {
  try {
    if (s) localStorage.setItem(STORE_PREFIX + key, JSON.stringify(s))
    else localStorage.removeItem(STORE_PREFIX + key)
  } catch {
    // 저장 공간이 없으면 이어 하기만 안 된다
  }
}

/** 이 코스를 누비던 중이었나 (시작 버튼을 '이어서 누비기'로) */
export function hasNubiInProgress(key: string) {
  return typeof window !== 'undefined' && load(key) != null
}

/** 누비기 화면을 바로 여는 주소 (`map:<id>` → 지도, `meetup:<id>` → 순례방). ?nubi=1 이면 누비기 버튼이 저절로 열린다 */
export function nubiHref(key: string) {
  const [kind, id] = key.split(':')
  return kind === 'meetup' ? `/meetups/${id}/room?nubi=1` : `/maps/${id}?nubi=1`
}

/** 이 브라우저에서 누비던 중인 코스들 (다 돈 코스는 빼고, 최근 시작한 순) */
export function listNubiInProgress(): (NubiSummary & { key: string; href: string; startedAt: number })[] {
  const out: (NubiSummary & { key: string; href: string; startedAt: number })[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i)
      if (!full?.startsWith(STORE_PREFIX)) continue
      const key = full.slice(STORE_PREFIX.length)
      const s = load(key)
      if (s?.summary && !(s.summary.finished ?? s.summary.done >= s.summary.total)) out.push({ ...s.summary, key, href: nubiHref(key), startedAt: s.startedAt })
    }
  } catch {
    // 저장소를 못 읽으면 빈 목록
  }
  return out.sort((a, b) => b.startedAt - a.startedAt)
}

