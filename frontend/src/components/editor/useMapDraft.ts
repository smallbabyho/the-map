'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteLeg, deletePin, getMap, saveLeg, saveMap, savePin } from '../../db/api'
import type { ConceptMap, Leg, MapDetail, Pin, ThemeId, TravelMode } from '../../types'
import type { PlaceSearchResult } from '../map'
import { getTheme } from '../themes'

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
}

const TMP = 'tmp-'
const pairKey = (from: string, to: string) => `${from}>${to}`
const DEFAULT_LEG: LegDraft = { mode: 'walk', durationMin: null, isManual: false }

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
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const apply = useCallback((d: MapDetail) => {
    setMap(d.map)
    setPins(d.pins)
    setLegDrafts(
      Object.fromEntries(
        d.legs.map((l) => [pairKey(l.fromPinId, l.toPinId), { mode: l.mode, durationMin: l.durationMin, isManual: l.isManual }]),
      ),
    )
    serverLegs.current = d.legs
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
  const legs: DraftLeg[] = useMemo(
    () =>
      pins.slice(1).map((to, i) => {
        const from = pins[i]
        return { fromPinId: from.id, toPinId: to.id, ...(legDrafts[pairKey(from.id, to.id)] ?? DEFAULT_LEG) }
      }),
    [pins, legDrafts],
  )

  const touch = () => {
    setDirty(true)
    setJustSaved(false)
    setSaveError('')
  }

  const updateMap = (patch: Partial<Pick<ConceptMap, 'title' | 'isPublic'>>) => {
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
    const palette = getTheme(map?.theme).palette
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

  const removePin = (pinId: string) => {
    setPins((ps) => ps.filter((p) => p.id !== pinId))
    if (!pinId.startsWith(TMP)) setRemovedPinIds((ids) => [...ids, pinId])
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

  const updateLeg = (fromPinId: string, toPinId: string, patch: Partial<Omit<LegDraft, 'isManual'>>) => {
    const key = pairKey(fromPinId, toPinId)
    setLegDrafts((d) => ({ ...d, [key]: { ...(d[key] ?? DEFAULT_LEG), ...patch, isManual: true } }))
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
    try {
      await saveMap({ id: map.id, title: map.title.trim(), theme: map.theme, isPublic: map.isPublic })

      for (const id of removedPinIds) await deletePin(id)

      const idMap: Record<string, string> = {}
      for (const [i, pin] of pins.entries()) {
        const saved = await savePin(map.id, {
          id: pin.id.startsWith(TMP) ? undefined : pin.id,
          place: { externalId: pin.place.externalId, name: pin.place.name, lat: pin.place.lat, lng: pin.place.lng },
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
      if (fresh) apply(fresh)
      setJustSaved(true)
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
    removePin,
    movePin,
    updateLeg,
    save,
  }
}
