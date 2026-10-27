'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteLeg, deletePin, getMap, saveLeg, saveMap, savePin } from '../../db/api'
import type { ConceptMap, Leg, MapDetail, Pin, ThemeId, TravelMode } from '../../types'
import { useRoutes, type PlaceSearchResult, type Route } from '../map'
import { getTheme, similarColors } from '../themes'

// 편집 화면 상태. 바꾼 내용은 저장 버튼을 누를 때 한 번에 db 함수로 반영한다.
// 아직 저장 안 된 새 핀은 'tmp-' 로 시작하는 임시 id 를 쓴다.

export interface LegDraft {
  mode: TravelMode
  durationMin: number | null
  isManual: boolean
}
export interface DraftLeg extends LegDraft {
  fromPinId: string
  toPinId: string
  /** 길찾기 결과 (거리 · 경로). 아직 없으면 undefined */
  route?: Route
}

const TMP = 'tmp-'
const pairKey = (from: string, to: string) => `${from}>${to}`
const DEFAULT_LEG: LegDraft = { mode: 'walk', durationMin: null, isManual: false }
const at = (p: Pin) => ({ lat: p.place.lat, lng: p.place.lng })

function tmpId() {
  return TMP + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()))
}

export type DraftStatus = 'loading' | 'ready' | 'notfound' | 'error'

export function useMapDraft(mapId: string) {
  const [status, setStatus] = useState<DraftStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [map, setMap] = useState<ConceptMap | null>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [legDrafts, setLegDrafts] = useState<Record<string, LegDraft>>({})
  const [removedPinIds, setRemovedPinIds] = useState<string[]>([])
  const serverLegs = useRef<Leg[]>([])
  const [loadedLegs, setLoadedLegs] = useState<Leg[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  /** 고칠 때마다 1씩: 저장하는 사이에 또 고쳤는지 알아본다 (자동 저장 중에도 계속 편집하니까) */
  const editVersion = useRef(0)

  const apply = useCallback((d: MapDetail) => {
    setMap(d.map)
    setPins(d.pins)
    setLegDrafts(
      Object.fromEntries(
        d.legs.map((l) => [pairKey(l.fromPinId, l.toPinId), { mode: l.mode, durationMin: l.durationMin, isManual: l.isManual }]),
      ),
    )
    serverLegs.current = d.legs
    setLoadedLegs(d.legs)
    setRemovedPinIds([])
    setDirty(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    getMap(mapId)
      .then((d) => {
        if (cancelled) return
        if (!d) return setStatus('notfound')
        apply(d)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : '지도를 불러오지 못했어요.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [mapId, apply])

  /** 핀 순서대로 이어지는 구간 목록 (항상 핀 순서에서 계산) */
  const pairs = useMemo(
    () =>
      pins.slice(1).map((to, i) => {
        const from = pins[i]
        return { from, to, draft: legDrafts[pairKey(from.id, to.id)] ?? DEFAULT_LEG }
      }),
    [pins, legDrafts],
  )
  const { routeOf, version } = useRoutes(pairs.map((p) => ({ from: at(p.from), to: at(p.to), mode: p.draft.mode })))
  /** 시간을 직접 적지 않은 구간은 길찾기 시간으로 채운다 */
  const legs: DraftLeg[] = useMemo(
    () =>
      pairs.map(({ from, to, draft }) => {
        const route = routeOf(at(from), at(to), draft.mode)
        return {
          fromPinId: from.id,
          toPinId: to.id,
          ...draft,
          // 시간은 길찾기 결과로만 (직접 적기는 없앴다. 예전에 적어 둔 값도 길찾기가 오면 덮는다)
          isManual: false,
          durationMin: route?.durationMin ?? draft.durationMin,
          route,
        }
      }),
    // version: 길찾기 결과가 도착하면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairs, routeOf, version],
  )

  const touch = () => {
    editVersion.current++
    setDirty(true)
    setJustSaved(false)
    setSaveError('')
  }

  const updateMap = (patch: Partial<Pick<ConceptMap, 'title' | 'isPublic' | 'category' | 'markerShape' | 'lineStyle' | 'lineWidth' | 'coverUrl' | 'plannedDate' | 'purpose' | 'categoryLabel'>>) => {
    setMap((m) => (m ? { ...m, ...patch } : m))
    touch()
  }

  /** 테마를 바꾸면 이전 테마 팔레트 색을 쓰던 핀은 새 팔레트의 같은 자리 색으로 바꾼다. */
  const setTheme = (themeId: ThemeId) => {
    if (!map || map.theme === themeId) return
    const from = getTheme(map.theme).palette
    const to = getTheme(themeId).palette
    setPins((ps) =>
      ps.map((p) => {
        const idx = from.indexOf(p.color)
        return idx >= 0 ? { ...p, color: to[idx % to.length] } : p
      }),
    )
    setMap({ ...map, theme: themeId })
    touch()
  }

  /** 검색 결과로 핀 추가. 새 핀 id 를 돌려준다. */
  const addPlace = (place: PlaceSearchResult): string => {
    // 새 핀 색: 지도 대표색과 비슷한 계열을 돌아가며
    const palette = similarColors(getTheme(map?.theme).accent)
    const id = tmpId()
    setPins((ps) => [
      ...ps,
      {
        id,
        mapId,
        place: { id: '', externalId: place.externalId, name: place.name, lat: place.lat, lng: place.lng },
        order: ps.length,
        icon: '📍',
        color: palette[ps.length % palette.length],
        memo: '',
        photoUrl: null,
        visitedAt: null,
      },
    ])
    touch()
    return id
  }

  const updatePin = (pinId: string, patch: Partial<Pick<Pin, 'icon' | 'color' | 'memo' | 'photoUrl' | 'visitedAt'>>) => {
    setPins((ps) => ps.map((p) => (p.id === pinId ? { ...p, ...patch } : p)))
    touch()
  }

  /** 직접 찍은 위치(custom:)의 장소 이름 바꾸기 */
  const renamePlace = (pinId: string, name: string) => {
    setPins((ps) => ps.map((p) => (p.id === pinId ? { ...p, place: { ...p.place, name } } : p)))
    touch()
  }

  const removePin = (pinId: string) => {
    setPins((ps) => ps.filter((p) => p.id !== pinId))
    if (!pinId.startsWith(TMP)) setRemovedPinIds((ids) => [...ids, pinId])
    touch()
  }

  /** 방금 지운 핀 되돌리기 (원래 자리로) */
  const restorePin = (pin: Pin, index: number) => {
    // 그 사이 자동 저장으로 서버에서 이미 지워졌으면 새 핀으로 다시 넣는다
    const back = pin.id.startsWith(TMP) || removedPinIds.includes(pin.id) ? pin : { ...pin, id: tmpId() }
    setPins((ps) => (ps.some((p) => p.id === back.id) ? ps : [...ps.slice(0, index), back, ...ps.slice(index)]))
    setRemovedPinIds((ids) => ids.filter((id) => id !== pin.id))
    touch()
  }

  const movePin = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setPins((ps) => {
      const next = [...ps]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    touch()
  }

  /** 핀 순서를 통째로 바꾸기 (코스 최적화 · 되돌리기). 없는 id 는 무시하고, 빠진 핀은 뒤에 그대로 */
  const reorderPins = (pinIds: string[]) => {
    setPins((ps) => {
      const byId = new Map(ps.map((p) => [p.id, p]))
      const picked = pinIds.map((id) => byId.get(id)).filter((p): p is Pin => p != null)
      return [...picked, ...ps.filter((p) => !pinIds.includes(p.id))]
    })
    touch()
  }

  /**
   * 이동수단을 바꾸면 시간은 다시 자동(길찾기)으로.
   * 시간을 적으면 직접 입력, 비우면 다시 자동.
   */
  const updateLeg = (fromPinId: string, toPinId: string, patch: Partial<Omit<LegDraft, 'isManual'>>) => {
    const key = pairKey(fromPinId, toPinId)
    setLegDrafts((d) => {
      const cur = d[key] ?? DEFAULT_LEG
      const next: LegDraft =
        patch.mode !== undefined && patch.mode !== cur.mode
          ? { mode: patch.mode, durationMin: null, isManual: false }
          : 'durationMin' in patch
            ? { ...cur, durationMin: patch.durationMin ?? null, isManual: patch.durationMin != null }
            : cur
      return { ...d, [key]: next }
    })
    touch()
  }

  /**
   * 저장: 지도 → 지운 핀 → 핀(순서 포함) → 구간 순서로 반영하고, 끝나면 다시 불러온다.
   * 임시 id 가 실제 id 로 바뀌므로 { 임시id: 실제id } 를 돌려준다.
   */
  const save = async (): Promise<Record<string, string> | null> => {
    if (!map || saving) return null
    setSaving(true)
    setSaveError('')
    const startVersion = editVersion.current
    try {
      await saveMap({
        id: map.id,
        title: map.title.trim(),
        theme: map.theme,
        isPublic: map.isPublic,
        category: map.category,
        markerShape: map.markerShape,
        lineStyle: map.lineStyle,
        lineWidth: map.lineWidth,
        coverUrl: map.coverUrl,
        plannedDate: map.plannedDate ?? null,
        purpose: map.purpose,
        categoryLabel: map.category === 'etc' ? (map.categoryLabel ?? null) : null,
      })

      for (const id of removedPinIds) await deletePin(id)

      const idMap: Record<string, string> = {}
      for (const [i, pin] of pins.entries()) {
        const saved = await savePin(map.id, {
          id: pin.id.startsWith(TMP) ? undefined : pin.id,
          place: { externalId: pin.place.externalId, name: pin.place.name.trim() || '지정한 위치', lat: pin.place.lat, lng: pin.place.lng },
          order: i,
          icon: pin.icon,
          color: pin.color,
          memo: pin.memo,
          photoUrl: pin.photoUrl,
          visitedAt: pin.visitedAt,
        })
        idMap[pin.id] = saved.id
      }

      // 지금 순서에서 더 이상 이어지지 않는 예전 구간은 지운다
      const wanted = new Set(legs.map((l) => pairKey(idMap[l.fromPinId], idMap[l.toPinId])))
      for (const old of serverLegs.current) {
        if (!wanted.has(pairKey(old.fromPinId, old.toPinId))) await deleteLeg(old.id)
      }
      for (const leg of legs) {
        await saveLeg(map.id, {
          fromPinId: idMap[leg.fromPinId],
          toPinId: idMap[leg.toPinId],
          mode: leg.mode,
          durationMin: leg.durationMin,
          isManual: leg.isManual,
        })
      }

      const fresh = await getMap(map.id)
      if (editVersion.current !== startVersion) {
        // 저장하는 사이에 더 고쳤다 → 화면은 그대로 두고 임시 id 만 실제 id 로 바꾼다 (고친 내용은 다음 저장에)
        const real = (id: string) => idMap[id] ?? id
        setPins((ps) => ps.map((p) => (idMap[p.id] ? { ...p, id: idMap[p.id], mapId: map.id } : p)))
        setLegDrafts((d) =>
          Object.fromEntries(
            Object.entries(d).map(([key, leg]) => {
              const [from, to] = key.split('>')
              return [pairKey(real(from), real(to)), leg]
            }),
          ),
        )
        setRemovedPinIds((ids) => ids.filter((id) => !removedPinIds.includes(id)))
        if (fresh) {
          serverLegs.current = fresh.legs
          setLoadedLegs(fresh.legs)
        }
      } else {
        if (fresh) apply(fresh)
        setJustSaved(true)
      }
      return idMap
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return null
    } finally {
      setSaving(false)
    }
  }

  return {
    status,
    loadError,
    /** 마지막으로 불러온(저장된) 이동구간 — 읽기 전용 화면용 */
    serverLegs: loadedLegs,
    map,
    pins,
    legs,
    dirty,
    saving,
    saveError,
    justSaved,
    updateMap,
    setTheme,
    addPlace,
    updatePin,
    renamePlace,
    removePin,
    restorePin,
    movePin,
    reorderPins,
    updateLeg,
    save,
  }
}
