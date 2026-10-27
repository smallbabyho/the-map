'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '../auth'
import { HeaderActions } from '../components/AppRail'
import { PinEditPanel } from '../components/editor/PinEditPanel'
import { PinList } from '../components/editor/PinList'
import { OptimizeCourseButton } from '../components/editor/OptimizeCourseButton'
import { PlaceSearchBox } from '../components/editor/PlaceSearchBox'
import { CollabButton } from '../components/editor/CollabButton'
import { MapLookButton, MapLookPanel } from '../components/editor/MapLookPicker'
import { ShareMenu } from '../components/editor/ShareMenu'
import { LinkImportDialog } from '../components/editor/LinkImportDialog'
import { useMapDraft } from '../components/editor/useMapDraft'
import { CheckIcon, ChevronLeftIcon, GlobeIcon, LockIcon, PinIcon } from '../components/icons'
import { MapView, type MapInsets } from '../components/map'
import { getTheme, themeVars } from '../components/themes'
import { canEditMap, getMapCollab } from '../db/api'
import type { MapCollab, Pin } from '../types'
import { Tour, type TourStep } from '../components/onboarding/Tour'
import { MapViewer } from './MapViewer'
import { daysUntil, planDday } from '../lib/planDate'
import { MAP_PURPOSES, mapPurpose } from '../components/mapPurpose'

/** 지도 편집 화면을 처음 연 사람에게 한 번 보여주는 안내 */
const EDITOR_TOUR: TourStep[] = [
  { target: 'place-search', title: '장소 추가', body: '검색해서 핀을 꽂아요. 지도를 누르면 그 근처 가게 · 건물을 골라 꽂을 수도 있어요.' },
  { target: 'pins', title: '핀 목록', body: '핀을 누르면 사진 · 다녀온 날짜 · 메모를 남겨요. 끌어서 순서를 바꾸면 길이 다시 이어져요.' },
  { target: 'map-look', title: '🎨 지도 꾸미기', body: '대표색, 마커, 코스 선, 커버, 카테고리를 여기서 골라요. 장소를 누르면 같은 자리에 그 핀 꾸미기가 열려요.' },
  { target: 'collab', title: '함께 꾸미기', body: '초대 링크를 보내면 친구와 한 지도를 같이 짜요.' },
  { target: 'map-public', title: '공개 설정', body: '공개하면 둘러보기에 올라가요. 비공개면 나와 함께 꾸미는 사람만 봐요.' },
  { target: 'save', title: '저장', body: '고친 내용은 1분마다 자동으로 저장돼요. 바로 남기고 싶으면 저장을 눌러요.' },
]

/** 왼쪽 세로 메뉴를 없앴다 (오른쪽 위 HeaderActions 로) */
const RAIL_W = 0
const PANEL_W = 380
const DETAIL_W = 360
const DESKTOP_MIN = 768
/** 자동 저장 간격 */
const AUTOSAVE_MS = 60_000

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

const SHEET_SNAPS = [0.28, 0.52, 0.88]

/** 시트 높이를 DOM 에 바로 쓴다 (animate: 손을 뗀 뒤 단계로 맞출 때만 부드럽게) */
function setSheetHeight(el: HTMLElement, px: number, animate: boolean) {
  el.style.transition = animate ? '' : 'none'
  el.style.height = `${px}px`
}

/**
 * 모바일 하단 시트: 손잡이를 끌거나 눌러서 높이 조절 (낮게 / 중간 / 높게).
 * 끄는 동안엔 화면을 다시 그리지 않고 시트 높이만 직접 바꾼다 (손가락이 움직일 때마다 편집 화면 전체를 그리면 휴대폰에서 버벅인다).
 * 손을 떼면 가까운 단계로 맞추고, 그때 한 번 지도 · 패널 영역이 바뀐다.
 */
function useBottomSheet(viewportH: number) {
  const [snap, setSnap] = useState(1)
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null)
  const [handleEl, setHandleEl] = useState<HTMLElement | null>(null)
  const height = Math.round(SHEET_SNAPS[snap] * viewportH)

  useEffect(() => {
    if (!sheetEl || !handleEl) return
    let drag: { y: number; h: number; moved: boolean; last: number } | null = null
    const down = (e: PointerEvent) => {
      handleEl.setPointerCapture(e.pointerId)
      const h = sheetEl.getBoundingClientRect().height
      drag = { y: e.clientY, h, moved: false, last: h }
    }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dy = e.clientY - drag.y
      if (Math.abs(dy) > 4) drag.moved = true
      if (!drag.moved) return
      drag.last = Math.min(viewportH * 0.92, Math.max(viewportH * 0.18, drag.h - dy))
      setSheetHeight(sheetEl, drag.last, false)
    }
    const up = () => {
      const d = drag
      drag = null
      if (!d) return
      setSnap((cur) => {
        let next = (cur + 1) % SHEET_SNAPS.length // 그냥 누르면 다음 단계
        if (d.moved) {
          const ratio = d.last / viewportH
          next = 0
          SHEET_SNAPS.forEach((r, i) => Math.abs(r - ratio) < Math.abs(SHEET_SNAPS[next] - ratio) && (next = i))
        }
        // 같은 단계로 돌아오면 React 가 style 을 다시 쓰지 않으니 여기서 맞춘다
        setSheetHeight(sheetEl, Math.round(SHEET_SNAPS[next] * viewportH), true)
        return next
      })
    }
    handleEl.addEventListener('pointerdown', down)
    handleEl.addEventListener('pointermove', move)
    handleEl.addEventListener('pointerup', up)
    handleEl.addEventListener('pointercancel', up)
    return () => {
      handleEl.removeEventListener('pointerdown', down)
      handleEl.removeEventListener('pointermove', move)
      handleEl.removeEventListener('pointerup', up)
      handleEl.removeEventListener('pointercancel', up)
    }
  }, [sheetEl, handleEl, viewportH])

  return { height, setSheetEl, setHandleEl }
}

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const router = useRouter()
  const draft = useMapDraft(mapId)
  const { map, pins, legs } = draft
  const user = useCurrentUser()
  const isOwner = !!user && !!map && map.ownerId === user.id
  const purpose = map ? mapPurpose(map) : 'plan'
  /** 다녀왔어요: 계획 → 기록. 다녀온 날이 비어 있는 핀은 가는 날(없으면 오늘)로 채운다 */
  const markVisited = () => {
    if (!map || !window.confirm('이 계획을 다녀온 기록으로 바꿀까요? 장소마다 사진과 메모를 남겨 보세요.')) return
    const day = map.plannedDate && daysUntil(map.plannedDate) <= 0 ? map.plannedDate : new Date().toLocaleDateString('sv-SE')
    for (const p of pins) if (!p.visitedAt) draft.updatePin(p.id, { visitedAt: day })
    draft.updateMap({ purpose: 'record' })
  }
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
  // 순례방에서 '코스 고치기' 로 왔으면 (?meetup=모임id): 모임 참여자도 고칠 수 있다 (DB 가 다시 확인한다)
  const meetupId = useSearchParams().get('meetup')
  const [courseEditor, setCourseEditor] = useState<boolean | null>(null)
  useEffect(() => {
    if (!meetupId || !userId || !mapReady) return
    let cancelled = false
    canEditMap(mapId)
      .then((ok) => !cancelled && setCourseEditor(ok))
      .catch(() => !cancelled && setCourseEditor(false))
    return () => {
      cancelled = true
    }
  }, [meetupId, userId, mapReady, mapId])
  const collabEditor = isOwner || collab?.myRole === 'editor'
  const canEdit = collabEditor || courseEditor === true

  // 로그인 안 한 상태에서 지도를 못 찾으면 (내 비공개 지도일 수 있으니) 로그인으로
  const needLogin = user === null && draft.status === 'notfound'
  useEffect(() => {
    if (needLogin) router.replace(`/login?next=${encodeURIComponent(`/maps/${mapId}`)}`)
  }, [needLogin, mapId, router])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const vp = useViewport()
  const { height: sheetHeight, setSheetEl, setHandleEl } = useBottomSheet(vp.h || 800)

  const theme = getTheme(map?.theme)
  const selectedIndex = pins.findIndex((p) => p.id === selectedId)
  const selectedPin = selectedIndex >= 0 ? pins[selectedIndex] : null
  // 옆 창: 핀을 고르면 핀 꾸미기, 🎨 지도 꾸미기를 누르면 지도 꾸미기 (같은 자리, 하나만)
  const [decoOpen, setDecoOpen] = useState(false)
  /** 🔗 링크로 한 번에 채우기 창 */
  const [linkOpen, setLinkOpen] = useState(false)
  /** 목록에서 방금 지운 핀 (5초 동안 되돌리기) */
  const [undo, setUndo] = useState<{ pin: Pin; index: number } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 5000)
    return () => window.clearTimeout(t)
  }, [undo])
  /** 핀을 꾸미다가 지도 꾸미기를 열었으면 그 핀. 지도 꾸미기를 닫으면 그 핀 꾸미기로 돌아간다 */
  const [returnPinId, setReturnPinId] = useState<string | null>(null)
  // 지도 꾸미기를 연 채로 핀을 고르면 지도 꾸미기는 닫는다 (핀 창을 닫았을 때 다시 뜨지 않게)
  if (decoOpen && selectedPin) {
    setDecoOpen(false)
    setReturnPinId(null)
  }
  const mapDecoOpen = decoOpen && !selectedPin
  const sidePanelOpen = !!selectedPin || mapDecoOpen
  const closeMapDeco = () => {
    setDecoOpen(false)
    if (returnPinId && pins.some((p) => p.id === returnPinId)) setSelectedId(returnPinId)
    setReturnPinId(null)
  }
  const toggleMapDeco = () => {
    if (mapDecoOpen) return closeMapDeco()
    setReturnPinId(selectedId)
    setSelectedId(null)
    setDecoOpen(true)
  }
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
    if (idMap && returnPinId && idMap[returnPinId]) setReturnPinId(idMap[returnPinId])
  }

  // Ctrl/Cmd + S 로 저장
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  // 자동 저장: 고치기 시작하고 1분 뒤 (계속 고쳐도 1분마다 한 번). 실패하면 1분 뒤 다시.
  // 다른 탭으로 가거나 앱을 내리면 바로 저장한다
  useEffect(() => {
    if (!draft.dirty || draft.saving) return
    const t = window.setTimeout(() => saveRef.current(), AUTOSAVE_MS)
    return () => window.clearTimeout(t)
  }, [draft.dirty, draft.saving])
  useEffect(() => {
    if (!draft.dirty) return
    const onHide = () => document.visibilityState === 'hidden' && saveRef.current()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [draft.dirty])
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

  /** 나가기: 순례방에서 왔으면 순례방으로 (고친 코스는 저장하고 간다), 아니면 내 지도로 */
  const goBack = async () => {
    if (meetupId && draft.dirty) await saveRef.current()
    if (draft.dirty && !meetupId && !window.confirm('저장하지 않은 변경이 있어요. 나갈까요?')) return
    router.push(meetupId ? `/meetups/${meetupId}/room` : '/')
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
  if (!isOwner && user && (!collab || (meetupId && courseEditor === null && collab.myRole !== 'editor'))) return <EditorLoading />
  if (!canEdit) {
    // 남의 공개 지도 → 읽기 전용
    return <MapViewer detail={{ map, pins, legs: draft.serverLegs }} />
  }

  // 지도에서 패널이 가리는 부분 (핀 전체보기 때 피해서 맞춤)
  const insets: MapInsets = vp.desktop
    ? { top: 72, right: 0, bottom: 0, left: RAIL_W + PANEL_W + (sidePanelOpen ? DETAIL_W + 24 : 0) }
    : { top: 64, right: 0, bottom: sidePanelOpen ? Math.round(vp.h * 0.62) : sheetHeight, left: 0 }

  const saveLabel = draft.saving ? '저장 중…' : draft.dirty ? '저장' : draft.justSaved ? '저장됨' : '저장'

  /** 목록에서 바로 지우기: 확인 창 대신 5초 동안 '되돌리기' */
  const removeFromList = (pinId: string) => {
    const index = pins.findIndex((p) => p.id === pinId)
    if (index < 0) return
    setUndo({ pin: pins[index], index })
    draft.removePin(pinId)
    if (selectedId === pinId) setSelectedId(null)
  }

  /** 공유 메뉴: 데스크톱은 오른쪽 위, 모바일은 시트 안 (한 화면에 하나만 그린다: 이미지 카드 · 내보내기 창이 겹치지 않게) */
  const shareMenu = (align: 'left' | 'right') => (
    <ShareMenu map={map} pins={pins} story={{ map, pins, legs, theme, ownerName: user?.nickname }} exportData={{ map, pins, legs }} dirty={draft.dirty} align={align} />
  )

  const saveButton = (
    <button
      type="button"
      onClick={save}
      disabled={draft.saving || !draft.dirty}
      title="1분마다 자동으로 저장돼요 (⌘/Ctrl + S 로 바로 저장)"
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
          autoLocate={pins.length === 0 ? 'center' : 'show'}
        />
      </div>


      {/* 상단 떠 있는 바 */}
      {/* 상단 떠 있는 바: (모바일) ← · 장소 검색 · 저장 / (데스크톱) 장소 검색 · 꾸미기 · 같이 꾸미기 · 공유 · 저장 · 프로필 */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start gap-2 md:left-auto md:right-4 md:top-4">
        <button
          type="button"
          onClick={goBack}
          className="tm-float pointer-events-auto grid size-10 shrink-0 place-items-center rounded-full bg-(--c-surface) text-(--c-text) md:hidden"
          aria-label="내 지도로"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <div className="pointer-events-auto min-w-0 flex-1 md:w-64 md:flex-none lg:w-80" data-tour="place-search">
          <PlaceSearchBox variant="floating" onPick={(place) => draft.addPlace(place)} />
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <div className="hidden md:block" data-tour="map-look">
            <MapLookButton open={mapDecoOpen} onClick={toggleMapDeco} />
          </div>
          {collab && user && collabEditor && (
            <div className="hidden md:block" data-tour="collab">
              <CollabButton mapId={map.id} myId={user.id} collab={collab} onChange={loadCollab} />
            </div>
          )}
          {vp.desktop && shareMenu('right')}
          <div data-tour="save">{saveButton}</div>
          <div className="hidden md:block">
            <HeaderActions user={user} active="maps" floating showSearch={false} />
          </div>
        </div>
      </div>

      {linkOpen && (
        <LinkImportDialog
          onAdd={(items) => {
            for (const { place, memo } of items) {
              const id = draft.addPlace(place)
              if (memo) draft.updatePin(id, { memo })
            }
          }}
          onClose={() => setLinkOpen(false)}
        />
      )}

      {undo && (
        <div role="status" className="tm-float absolute left-1/2 top-16 z-40 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900/90 py-2 pl-4 pr-2 text-sm text-white backdrop-blur md:top-20">
          <span className="truncate">‘{undo.pin.place.name}’ 지웠어요</span>
          <button
            type="button"
            onClick={() => {
              draft.restorePin(undo.pin, undo.index)
              setUndo(null)
            }}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1 font-bold hover:bg-white/25"
          >
            되돌리기
          </button>
        </div>
      )}

      {draft.saveError && (
        <div role="alert" className="tm-float absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white">
          {draft.saveError}
        </div>
      )}

      <Tour id="editor" userId={user?.id} steps={EDITOR_TOUR} />

      {/* 왼쪽 패널 (데스크톱) / 하단 시트 (모바일) */}
      <section
        ref={setSheetEl}
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-(--c-surface) shadow-[0_-8px_30px_rgb(15_23_42/0.12)] transition-[height] duration-200 md:inset-y-0 md:right-auto md:rounded-none md:border-r md:border-(--c-border) md:shadow-[4px_0_24px_rgb(15_23_42/0.06)]"
        style={vp.desktop ? { left: RAIL_W, width: PANEL_W } : { height: sheetHeight }}
        aria-label="지도 편집"
      >
        {/* 시트 손잡이 (모바일) */}
        <div ref={setHandleEl} className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 md:hidden" aria-label="패널 높이 조절" role="button">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>

        <div className="shrink-0 space-y-3 px-4 pb-3 pt-1 md:px-5 md:pt-5">
          <div className="hidden items-center md:flex">
            <button type="button" onClick={goBack} className="-ml-1.5 flex items-center gap-0.5 rounded-lg py-1 pl-1 pr-2 text-sm text-(--c-muted) hover:bg-black/5">
              <ChevronLeftIcon size={16} />
              {meetupId ? '순례방으로' : '내 지도'}
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
              data-tour="map-public"
              title={!isOwner ? '공개 여부는 지도 주인만 바꿀 수 있어요' : map.isPublic ? '누구나 볼 수 있어요' : '나와 함께 꾸미는 사람만 볼 수 있어요'}
            >
              {map.isPublic ? <GlobeIcon size={14} /> : <LockIcon size={14} />}
              {map.isPublic ? '공개' : '비공개'}
            </button>
          </div>

          {/* 용도: 기록(다녀온 곳) / 계획(갈 곳) */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full bg-black/[0.05] p-0.5" role="radiogroup" aria-label="지도 용도">
              {MAP_PURPOSES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={purpose === p.id}
                  title={p.hint}
                  onClick={() => draft.updateMap({ purpose: p.id })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${purpose === p.id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          {purpose === 'plan' ? (
            // 가는 날 (나와 같이 꾸미는 사람에게만 보여요) + 다녀왔으면 기록으로
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <span className="shrink-0 font-semibold">📅 가는 날</span>
                <input
                  type="date"
                  value={map.plannedDate ?? ''}
                  onChange={(e) => draft.updateMap({ plannedDate: e.target.value || null })}
                  className="h-8 min-w-0 rounded-lg border border-(--c-border) bg-(--c-surface) px-2 text-sm outline-none focus:border-(--c-accent)"
                  aria-label="가는 날"
                />
              </label>
              {map.plannedDate && <span className="text-xs font-semibold text-(--c-accent)">{planDday(map.plannedDate)}</span>}
              {pins.length > 0 && (
                <button
                  type="button"
                  onClick={markVisited}
                  className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${map.plannedDate && daysUntil(map.plannedDate) <= 0 ? 'bg-(--c-accent) text-(--c-accent-text)' : 'border border-(--c-border) text-(--c-muted) hover:text-(--c-text)'}`}
                  title="이 계획을 다녀온 기록으로 바꿔요"
                >
                  ✅ 다녀왔어요
                </button>
              )}
            </div>
          ) : (
            !map.isPublic &&
            isOwner &&
            pins.length > 0 && (
              <p className="flex items-center gap-2 rounded-xl bg-(--c-accent)/10 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1">공개하면 이 기록이 다른 사람의 계획이 될 수 있어요.</span>
                <button type="button" onClick={() => draft.updateMap({ isPublic: true })} className="shrink-0 font-bold text-(--c-accent)">
                  공개하기
                </button>
              </p>
            )
          )}

          {/* (모바일) 꾸미기 · 같이 꾸미기 · 공유. 데스크톱은 오른쪽 위에 있다 */}
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            <span className="md:hidden" data-tour="map-look">
              <MapLookButton open={mapDecoOpen} onClick={toggleMapDeco} variant="inline" />
            </span>
            {collab && user && collabEditor && (
              <span className="md:hidden" data-tour="collab">
                <CollabButton mapId={map.id} myId={user.id} collab={collab} onChange={loadCollab} variant="inline" />
              </span>
            )}
            {!vp.desktop && shareMenu('left')}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-(--c-border) px-5 py-2.5 text-[0.8125rem]">
          <span className="shrink-0 font-semibold">
            장소 <span className="text-(--c-accent)">{pins.length}</span>곳
            {totalMin > 0 && <span className="ml-2 font-normal text-(--c-muted)">이동 총 {totalMin >= 60 ? `${Math.floor(totalMin / 60)}시간 ${totalMin % 60}분` : `${totalMin}분`}</span>}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-(--c-muted) transition hover:bg-black/5 hover:text-(--c-text)"
              title="블로그 글에 나온 장소를 한 번에 추가"
            >
              🔗 링크로 채우기
            </button>
            {pins.length > 1 && (
              <button
                type="button"
                onClick={() => draft.reorderPins([...pins].reverse().map((p) => p.id))}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-(--c-muted) transition hover:bg-black/5 hover:text-(--c-text)"
                title="코스 순서를 거꾸로 (도착지에서 출발)"
              >
                ⇅ 순서 뒤집기
              </button>
            )}
            <OptimizeCourseButton pins={pins} onReorder={draft.reorderPins} />
          </div>
        </div>

        <div className="tm-scroll min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]" data-tour="pins">
          {pins.length === 0 ? (
            <div className="flex flex-col items-center px-8 py-12 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-(--c-accent)/10 text-(--c-accent)">
                <PinIcon size={28} />
              </span>
              <p className="mt-4 font-semibold">첫 장소를 추가해 보세요</p>
              <p className="mt-1 text-sm text-(--c-muted)">
                위쪽 검색창에서 장소를 찾거나, 지도를 눌러 근처 장소를 골라 핀을 꽂아 보세요. 순서대로 선이 이어져요.
              </p>
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="tm-btn mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-(--c-accent) px-5 text-sm font-bold text-(--c-accent-text)"
              >
                🔗 링크로 한 번에 채우기
              </button>
              <p className="mt-2 text-xs text-(--c-muted)">블로그 글에 나온 장소를 한 번에 핀으로 꽂아요</p>
            </div>
          ) : (
            <PinList
              pins={pins}
              legs={legs}
              selectedPinId={selectedId}
              onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
              onMove={draft.movePin}
              onLegChange={draft.updateLeg}
              onRemove={removeFromList}
            />
          )}
        </div>
      </section>

      {/* 옆 창 (핀 꾸미기 · 지도 꾸미기): 데스크톱은 목록 옆, 모바일은 하단 시트 */}
      {mapDecoOpen && (
        <>
          <div className="absolute inset-0 z-30 bg-black/20 md:hidden" onClick={closeMapDeco} aria-hidden />
          <section
            className="tm-float absolute inset-x-0 bottom-0 z-40 flex h-[62dvh] flex-col overflow-hidden rounded-t-3xl bg-(--c-surface) md:bottom-4 md:right-auto md:top-4 md:h-auto md:rounded-2xl"
            style={vp.desktop ? { left: RAIL_W + PANEL_W + 12, width: DETAIL_W } : undefined}
            aria-label="지도 꾸미기"
          >
            <MapLookPanel
              look={map}
              coverUrl={map.coverUrl}
              onChange={draft.updateMap}
              theme={map.theme}
              onTheme={draft.setTheme}
              category={map.category}
              categoryLabel={map.categoryLabel ?? null}
              onClose={closeMapDeco}
            />
          </section>
        </>
      )}
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

