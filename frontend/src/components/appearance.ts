'use client'

import { useSyncExternalStore } from 'react'
import { APPEARANCE_STORAGE_KEY as STORAGE_KEY, SUN_BASE as BASE } from './appearanceScript'

// 라이트 / 다크 화면. 보는 사람마다 고르고(브라우저에 저장), 기본은 '자동' = 일출~일몰은 라이트, 밤은 다크.
// 실제 색은 app/globals.css 의 :root[data-mode='dark'] 에서 바뀐다. 여기서는 <html data-mode> 만 정한다.
// 지도 색 테마(기본·파스텔…)와는 별개다 (themes.ts).

export type AppearancePref = 'auto' | 'light' | 'dark'
export type AppearanceMode = 'light' | 'dark'

/**
 * 그날의 일출 · 일몰 시각 (NOAA 근사식, 오차 1~2분). 백야·극야면 null.
 *
 * @example
 * sunTimes(new Date('2026-10-23T12:00:00+09:00')) // { sunrise: 06:43, sunset: 17:47 } (서울)
 */
export function sunTimes(date: Date, lat = BASE.lat, lng = BASE.lng): { sunrise: Date; sunset: Date } | null {
  const rad = Math.PI / 180
  // 그 날짜의 현지 정오 기준 율리우스일
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  const n = Math.round(noon.getTime() / 86400000 + 2440587.5 - 2451545 + 0.0008)
  const jStar = n - lng / 360
  const M = (357.5291 + 0.98560028 * jStar) % 360
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad)
  const L = (M + C + 180 + 102.9372) % 360
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad)
  const sinD = Math.sin(L * rad) * Math.sin(23.4397 * rad)
  const cosD = Math.cos(Math.asin(sinD))
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD)
  if (cosW < -1 || cosW > 1) return null
  const w = Math.acos(cosW) / rad / 360
  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000)
  return { sunrise: toDate(jTransit - w), sunset: toDate(jTransit + w) }
}

export function modeAt(pref: AppearancePref, now = new Date()): AppearanceMode {
  if (pref !== 'auto') return pref
  const sun = sunTimes(now)
  if (!sun) return 'light'
  return now >= sun.sunrise && now < sun.sunset ? 'light' : 'dark'
}

function readPref(): AppearancePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

// ---- 작은 전역 저장소 (모든 화면의 토글 버튼이 같은 값을 본다) ----
interface State {
  pref: AppearancePref
  mode: AppearanceMode
  /** 자동일 때 다음 전환 안내, 예: '일몰 17:45에 다크로' */
  nextChange: string
}
const SERVER_STATE: State = { pref: 'auto', mode: 'light', nextChange: '' }
let state: State = SERVER_STATE
const listeners = new Set<() => void>()

const hhmm = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

function nextChangeText(pref: AppearancePref, mode: AppearanceMode) {
  if (pref !== 'auto') return ''
  const sun = sunTimes(new Date())
  if (!sun) return ''
  return mode === 'light' ? `일몰 ${hhmm(sun.sunset)}에 다크로` : `일출 ${hhmm(sun.sunrise)}에 라이트로`
}

function apply(pref: AppearancePref) {
  const mode = modeAt(pref)
  document.documentElement.dataset.mode = mode
  const nextChange = nextChangeText(pref, mode)
  if (pref !== state.pref || mode !== state.mode || nextChange !== state.nextChange) {
    state = { pref, mode, nextChange }
    listeners.forEach((l) => l())
  }
}

/** 지금 설정 · 시각으로 <html data-mode> 를 맞춘다. 1분마다, 다른 탭에서 바꿨을 때 불린다. */
export function syncAppearance() {
  apply(readPref())
}

export function setAppearancePref(pref: AppearancePref) {
  try {
    if (pref === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // 저장을 못 해도 이번 화면에는 적용
  }
  apply(pref)
}

function subscribe(l: () => void) {
  listeners.add(l)
  if (listeners.size === 1) syncAppearance()
  return () => listeners.delete(l)
}

/** 현재 라이트/다크 설정과 실제 적용 중인 모드 */
export function useAppearance(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  )
}
