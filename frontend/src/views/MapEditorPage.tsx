'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useCurrentUser } from '../auth'
import { HeaderActions } from '../components/AppRail'
import { PinEditPanel } from '../components/editor/PinEditPanel'
import { PinList } from '../components/editor/PinList'
import { PlaceSearchBox } from '../components/editor/PlaceSearchBox'
import { CollabButton } from '../components/editor/CollabButton'
import { MapLookPicker } from '../components/editor/MapLookPicker'
import { StoryCardButton } from '../components/share/StoryCardButton'
import { MAP_CATEGORIES } from '../components/mapCategories'
import { ThemePicker } from '../components/editor/ThemePicker'
import { useMapDraft } from '../components/editor/useMapDraft'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, GlobeIcon, LockIcon, PinIcon } from '../components/icons'
import { MapView, type MapInsets } from '../components/map'
import { getTheme, themeVars } from '../components/themes'
import { getMapCollab } from '../db/api'
import type { MapCollab } from '../types'
import { MapViewer } from './MapViewer'

/** 왼쪽 세로 메뉴를 없앴다 (오른쪽 위 HeaderActions 로) */
const RAIL_W = 0
const PANEL_W = 380
const DETAIL_W = 360
const DESKTOP_MIN = 768

/** 편집 화면을 불러오는 동안 보여줄 화면 (라우트의 Suspense fallback 으로도 쓴다) */
export function EditorLoading() {
  return (
    <div className="grid h-dvh place-items-center bg-(--c-map-bg)">
      <div className="flex flex-col items-center gap-3 text-sm text-(--c-muted)">
        <span className="size-8 animate-spin rounded-full border-[3px] border-(--c-border) border-t-(--c-accent)" />
        지도를 불러오는 중…
      </div>
    </div>
  )
}

function useViewport() {
  const [vp, setVp] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return { ...vp, desktop: vp.w >= DESKTOP_MIN }
}

/** 모바일 하단 시트: 손잡이를 끌거나 눌러서 높이 조절 (낮게 / 중간 / 높게) */
function useBottomSheet(viewportH: number) {
  const SNAPS = [0.28, 0.52, 0.88]
  const [snap, setSnap] = useState(1)
  const [dragH, setDragH] = useState<number | null>(null)
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null)
  const height = dragH ?? Math.round(SNAPS[snap] * viewportH)

  const handlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      start.current = { y: e.clientY, h: height, moved: false }
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = start.current
      if (!s) return
      const dy = e.clientY - s.y
      if (Math.abs(dy) > 4) s.moved = true
      if (s.moved) setDragH(Math.min(viewportH * 0.92, Math.max(viewportH * 0.18, s.h - dy)))
    },
    onPointerUp: () => {
      const s = start.current
      start.current = null
      if (!s) return
      if (!s.moved) {
        setSnap((i) => (i + 1) % SNAPS.length)
      } else if (dragH != null) {
        const ratio = dragH / viewportH
        let best = 0
        SNAPS.forEach((r, i) => Math.abs(r - ratio) < Math.abs(SNAPS[best] - ratio) && (best = i))
        setSnap(best)
      }
      setDragH(null)
    },
  }
  return { height, dragging: dragH != null, handlers }
}

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const router = useRouter()
  const draft = useMapDraft(mapId)
  const { map, pins, legs } = draft
  const user = useCurrentUser()
  const isOwner = !!user && !!map && map.ownerId === user.id
  // 함께 꾸미기: 주인이 아니어도 공동 편집자면 편집 화면
  const [collab, setCollab] = useState<MapCollab | null>(null)
  const loadCollab = useCallback(() => {
    getMapCollab(mapId).then(setCollab).catch(() => setCollab(null))
  }, [mapId])
  const userId = user?.id
  const mapReady = !!map
  useEffect(() => {
    if (userId && mapReady) loadCollab()
  }, [userId, mapReady, loadCollab])
  const canEdit = isOwner || collab?.myRole === 'editor'

  // 로그인 안 한 상태에서 지도를 못 찾으면 (내 비공개 지도일 수 있으니) 로그인으로
  const needLogin = user === null && draft.status === 'notfound'
  useEffect(() => {
    if (needLogin) router.replace(`/login?next=${encodeURIComponent(`/maps/${mapId}`)}`)
  }, [needLogin, mapId, router])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const vp = useViewport()
  const sheet = useBottomSheet(vp.h || 800)

  const theme = getTheme(map?.theme)
  const selectedIndex = pins.findIndex((p) => p.id === selectedId)
  const selectedPin = selectedIndex >= 0 ? pins[selectedIndex] : null
  const totalMin = legs.reduce((sum, l) => sum + (l.durationMin ?? 0), 0)

  // 저장 안 한 변경이 있으면 창 닫기 전에 확인
  useEffect(() => {
    if (!draft.dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [draft.dirty])

  const save = async () => {
    const idMap = await draft.save()
    if (idMap && selectedId && idMap[selectedId]) setSelectedId(idMap[selectedId])
  }

  // Ctrl/Cmd + S 로 저장
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const goBack = () => {
    if (draft.dirty && !window.confirm('저장하지 않은 변경이 있어요. 나갈까요?')) return
    router.push('/')
  }

  if (draft.status === 'loading' || user === undefined || needLogin) return <EditorLoading />
  if (draft.status !== 'ready' || !map) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <div className="text-5xl" aria-hidden>🧭</div>
          <h1 className="mt-4 text-lg font-bold">{draft.status === 'notfound' ? '지도를 찾을 수 없어요' : '지도를 불러오지 못했어요'}</h1>
          <p className="mt-1 text-sm text-(--c-muted)">{draft.status === 'notfound' ? '삭제됐거나 볼 수 없는 지도예요.' : draft.loadError}</p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-(--c-text) px-5 py-2.5 text-sm font-semibold text-(--c-surface)">
            내 지도로
          </Link>
        </div>
      </div>
    )
  }

  // 로그인했는데 권한 확인 중이면 잠깐 기다린다 (편집자인데 읽기 화면이 깜빡이지 않게)
  if (!isOwner && user && !collab) return <EditorLoading />
  if (!canEdit) {
    // 남의 공개 지도 → 읽기 전용
    return <MapViewer detail={{ map, pins, legs: draft.serverLegs }} />
  }

  // 지도에서 패널이 가리는 부분 (핀 전체보기 때 피해서 맞춤)
  const insets: MapInsets = vp.desktop
    ? { top: 72, right: 0, bottom: 0, left: RAIL_W + PANEL_W + (selectedPin ? DETAIL_W + 24 : 0) }
    : { top: 64, right: 0, bottom: selectedPin ? Math.round(vp.h * 0.62) : sheet.height, left: 0 }

  const saveLabel = draft.saving ? '저장 중…' : draft.dirty ? '저장' : draft.justSaved ? '저장됨' : '저장'

  const saveButton = (
    <button
      type="button"
      onClick={save}
      disabled={draft.saving || !draft.dirty}
      className={`tm-float inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-bold transition ${
        draft.dirty ? 'bg-(--c-accent) text-(--c-accent-text) hover:opacity-90' : 'bg-(--c-surface) text-(--c-muted)'
      }`}
    >
      {!draft.dirty && draft.justSaved && <CheckIcon size={16} />}
      {saveLabel}
    </button>
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-(--c-bg) text-(--c-text)" style={themeVars(theme)}>
      {/* 지도 (전체 화면) */}
      <div className="absolute inset-0">
        <MapView
          pins={pins}
          legs={legs}
          theme={theme}
          look={map}
          selectedPinId={selectedId}
          onSelectPin={(id) => setSelectedId((cur) => (cur === id ? null : id))}
          insets={insets}
          onAddPlace={(place) => setSelectedId(draft.addPlace(place))}
        />
      </div>


      {/* 상단 떠 있는 바 */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2 md:left-auto md:right-4 md:top-4">
        <button
          type="button"
          onClick={goBack}
          className="tm-float pointer-events-auto grid size-10 place-items-center rounded-full bg-(--c-surface) text-(--c-text) md:hidden"
          aria-label="내 지도로"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden md:block">
            <ThemePicker value={map.theme} onChange={draft.setTheme} />
          </div>
          <div className="hidden md:block">
            <MapLookPicker look={map} coverUrl={map.coverUrl} onChange={draft.updateMap} />
          </div>
          {collab && user && (
            <div className="hidden md:block">
              <CollabButton mapId={map.id} myId={user.id} collab={collab} onChange={loadCollab} />
            </div>
          )}
          {saveButton}
          <HeaderActions user={user} active="maps" floating />
        </div>
      </div>

      {draft.saveError && (
        <div role="alert" className="tm-float absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white">
          {draft.saveError}
        </div>
      )}

      {/* 왼쪽 패널 (데스크톱) / 하단 시트 (모바일) */}
      <section
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-(--c-surface) shadow-[0_-8px_30px_rgb(15_23_42/0.12)] md:inset-y-0 md:right-auto md:rounded-none md:border-r md:border-(--c-border) md:shadow-[4px_0_24px_rgb(15_23_42/0.06)] ${
          sheet.dragging ? '' : 'transition-[height] duration-200'
        }`}
        style={vp.desktop ? { left: RAIL_W, width: PANEL_W } : { height: sheet.height }}
        aria-label="지도 편집"
      >
        {/* 시트 손잡이 (모바일) */}
        <div {...sheet.handlers} className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 md:hidden" aria-label="패널 높이 조절" role="button">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>

        <div className="shrink-0 space-y-3 px-4 pb-3 pt-1 md:px-5 md:pt-5">
          <div className="hidden items-center md:flex">
            <button type="button" onClick={goBack} className="-ml-1.5 flex items-center gap-0.5 rounded-lg py-1 pl-1 pr-2 text-sm text-(--c-muted) hover:bg-black/5">
              <ChevronLeftIcon size={16} />내 지도
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={map.title}
              onChange={(e) => draft.updateMap({ title: e.target.value })}
              placeholder="지도 이름 (예: 성수 카페 투어)"
              maxLength={60}
              className="min-w-0 flex-1 rounded-lg bg-transparent py-1 text-xl font-bold outline-none placeholder:text-(--c-muted)/60 focus:bg-black/[0.03]"
              aria-label="지도 이름"
            />
            <button
              type="button"
              onClick={() => isOwner && draft.updateMap({ isPublic: !map.isPublic })}
              disabled={!isOwner}
              className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition ${
                map.isPublic ? 'border-(--c-accent) bg-(--c-accent)/10 text-(--c-accent)' : 'border-(--c-border) text-(--c-muted)'
              }`}
              aria-pressed={map.isPublic}
              title={!isOwner ? '공개 여부는 지도 주인만 바꿀 수 있어요' : map.isPublic ? '누구나 볼 수 있어요' : '나와 함께 꾸미는 사람만 볼 수 있어요'}
            >
              {map.isPublic ? <GlobeIcon size={14} /> : <LockIcon size={14} />}
              {map.isPublic ? '공개' : '비공개'}
            </button>
          </div>

          {/* 카테고리 (둘러보기에서 이 칸으로 보여요) */}
          <div className="tm-scroll -mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-5 md:px-5" role="radiogroup" aria-label="지도 카테고리">
            {MAP_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={map.category === c.id}
                onClick={() => draft.updateMap({ category: c.id })}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${map.category === c.id ? 'border-(--c-ink) bg-(--c-ink) text-(--c-bg)' : 'border-(--c-border) text-(--c-muted) hover:text-(--c-text)'}`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <Link
            href={`/meetups/new?mapId=${map.id}`}
            onClick={(e) => {
              if (draft.dirty && !window.confirm('저장하지 않은 변경이 있어요. 저장하지 않고 모임 만들기로 갈까요?')) e.preventDefault()
            }}
            className="flex items-center gap-2 rounded-xl bg-(--c-accent)/10 px-3 py-2 text-[13px] font-semibold text-(--c-accent) transition hover:bg-(--c-accent)/15"
          >
            <span aria-hidden>🚶</span>
            이 지도로 성지순례 모집하기
            <ChevronRightIcon size={14} className="ml-auto" />
          </Link>
          <StoryCardButton className="h-9 text-[13px]" data={{ map, pins, legs, theme, ownerName: user?.nickname }} />

          {/* 모바일에서는 테마 · 꾸미기를 패널 안에 */}
          <div className="tm-scroll -mx-4 overflow-x-auto px-4 md:hidden">
            <div className="w-max">
              <ThemePicker value={map.theme} onChange={draft.setTheme} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:hidden">
            <MapLookPicker look={map} coverUrl={map.coverUrl} onChange={draft.updateMap} variant="inline" />
            {collab && user && <CollabButton mapId={map.id} myId={user.id} collab={collab} onChange={loadCollab} variant="inline" />}
          </div>

          <PlaceSearchBox
            onPick={(place) => draft.addPlace(place)}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-(--c-border) px-5 py-2.5 text-[13px]">
          <span className="font-semibold">
            장소 <span className="text-(--c-accent)">{pins.length}</span>곳
          </span>
          {totalMin > 0 && <span className="text-(--c-muted)">이동 총 {totalMin >= 60 ? `${Math.floor(totalMin / 60)}시간 ${totalMin % 60}분` : `${totalMin}분`}</span>}
        </div>

        <div className="tm-scroll min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {pins.length === 0 ? (
            <div className="flex flex-col items-center px-8 py-12 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-(--c-accent)/10 text-(--c-accent)">
                <PinIcon size={28} />
              </span>
              <p className="mt-4 font-semibold">첫 장소를 추가해 보세요</p>
              <p className="mt-1 text-sm text-(--c-muted)">
                위 검색창에서 장소를 찾거나, 지도에서 {vp.desktop ? '우클릭' : '길게 눌러'} 원하는 곳에 핀을 꽂아 보세요. 순서대로 선이 이어져요.
              </p>
            </div>
          ) : (
            <PinList
              pins={pins}
              legs={legs}
              selectedPinId={selectedId}
              onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
              onMove={draft.movePin}
              onLegChange={draft.updateLeg}
            />
          )}
        </div>
      </section>

      {/* 핀 꾸미기 패널: 데스크톱은 목록 옆, 모바일은 하단 시트 */}
      {selectedPin && (
        <>
          <div className="absolute inset-0 z-30 bg-black/20 md:hidden" onClick={() => setSelectedId(null)} aria-hidden />
          <section
            className="tm-float absolute inset-x-0 bottom-0 z-40 flex h-[62dvh] flex-col overflow-hidden rounded-t-3xl bg-(--c-surface) md:bottom-4 md:right-auto md:top-4 md:h-auto md:rounded-2xl"
            style={vp.desktop ? { left: RAIL_W + PANEL_W + 12, width: DETAIL_W } : undefined}
            aria-label="핀 꾸미기"
          >
            <PinEditPanel
              key={selectedPin.id}
              pin={selectedPin}
              index={selectedIndex}
              theme={theme}
              onChange={(patch) => draft.updatePin(selectedPin.id, patch)}
              onRename={(name) => draft.renamePlace(selectedPin.id, name)}
              onDelete={() => {
                draft.removePin(selectedPin.id)
                setSelectedId(null)
              }}
              onClose={() => setSelectedId(null)}
            />
          </section>
        </>
      )}
    </div>
  )
}

