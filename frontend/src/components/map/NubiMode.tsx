'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { MapLook, Pin } from '../../types'
import { formatMinutes } from '../legModes'
import { ChevronLeftIcon } from '../icons'
import { themeVars, type Theme } from '../themes'
import { MapView } from './MapView'
import { useNubi } from './nubi'
import { nubiPercent, subscribeNubi } from './nubiStore'
import { NUBI_DONE } from './nubiColors'
import { formatDistance } from './routing'
import type { MapLegView } from './types'
import type { MyPosition } from './useMyLocation'

interface Props {
  title: string
  pins: Pin[]
  legs: MapLegView[]
  theme: Theme
  look?: MapLook
  /** 이어서 누비기 저장 칸 (지도면 `map:<id>`, 순례방이면 `meetup:<id>`) */
  storageKey: string
  /** 자동 도착 체크될 때 (순례방: 도착 인증 보내기). 실패하면 던진다 → 알림으로 보여 준다 */
  onArrive?: (pin: Pin, at: MyPosition) => Promise<void>
  onClose: () => void
}

/** 누비기 진행 띠 · 다음 장소 카드가 지도를 가리는 높이 (지도가 내 위치를 이만큼 위로 올려 보여 준다) */
const PANEL_H = 250

/**
 * 누비기 모드 (전체 화면): 코스를 따라 움직이는 동안
 * 지도 위에 내 위치 · 지나온 길을 그리고, 아래에 코스 진행도(%) · 다음 장소까지 남은 거리를 띄운다.
 * 장소 근처에 가면 자동으로 도착 체크 (+ 순례방이면 도착 인증).
 */
export function NubiMode({ title, pins, legs, theme, look, storageKey, onArrive, onClose }: Props) {
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const nubi = useNubi(pins, legs, storageKey, title, (pin, at) => {
    setToast({ text: `${pin.icon} ${pin.place.name} 도착!` })
    onArrive?.(pin, at).catch((e: unknown) => setToast({ text: e instanceof Error ? e.message : '도착 인증을 보내지 못했어요.', error: true }))
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), toast.error ? 5000 : 3000)
    return () => window.clearTimeout(t)
  }, [toast])
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 다 돌았으면 위치는 그만 받는다 (배터리)
  const { finished, stop } = nubi
  useEffect(() => {
    if (finished) stop()
  }, [finished, stop])

  const percent = Math.round(nubi.percent)
  const elapsedMin = nubi.startedAt ? Math.max(0, Math.round((now - nubi.startedAt) / 60_000)) : 0
  const started = nubi.startedAt != null

  return createPortal(
    <div className="fixed inset-0 z-[900] bg-(--c-bg) text-(--c-text)" style={themeVars(theme)} role="dialog" aria-modal aria-label="누비기">
      <div className="absolute inset-0">
        <MapView
          pins={pins}
          legs={legs}
          theme={theme}
          look={look}
          selectedPinId={selectedId}
          onSelectPin={(id) => setSelectedId((c) => (c === id ? null : id))}
          insets={{ top: 64, right: 0, bottom: PANEL_H, left: 0 }}
          autoLocate="show"
          live={nubi.live}
        />
      </div>

      {/* 위: 닫기 · 제목 · 진행도 */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center gap-2">
        <button type="button" onClick={onClose} className="tm-float pointer-events-auto grid size-10 shrink-0 place-items-center rounded-full bg-(--c-surface)" aria-label="누비기 닫기">
          <ChevronLeftIcon size={20} />
        </button>
        <div className="tm-float pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-(--c-surface) py-2 pl-4 pr-2">
          <span className="truncate text-sm font-bold">{title}</span>
          {started && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold text-white" style={{ background: NUBI_DONE }}>
              {percent}%
            </span>
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className={`tm-float absolute left-1/2 top-16 z-40 w-max max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold text-white ${toast.error ? 'bg-red-500' : ''}`}
          style={toast.error ? undefined : { background: NUBI_DONE }}
        >
          {toast.text}
        </div>
      )}

      {/* 아래: 진행 띠 + 다음 장소 */}
      <section className="tm-float absolute inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-3xl bg-(--c-surface) p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-label="누비기 진행">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-(--c-muted)">코스 진행도</p>
            <p className="text-3xl font-extrabold leading-none tabular-nums" style={{ color: started ? NUBI_DONE : undefined }}>
              {percent}
              <span className="text-lg">%</span>
            </p>
          </div>
          <p className="text-right text-xs text-(--c-muted)">
            도착 <b className="text-(--c-text)">{nubi.visited.size}</b> / {pins.length}곳
            {started && (
              <>
                <br />
                {formatDistance(nubi.movedM)} 누빔 · {formatMinutes(elapsedMin)}
              </>
            )}
          </p>
        </div>

        {/* 진행 띠: 장소마다 점 (도착하면 ✓) */}
        <div className="relative mx-2 mt-3 h-6">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-black/[0.07]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${nubi.percent}%`, background: NUBI_DONE }} />
          </div>
          {pins.map((p, i) => {
            const done = nubi.visited.has(p.id)
            const isNext = nubi.next?.pin.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                title={`${i + 1}. ${p.place.name}${done ? ' (도착)' : ''}`}
                className={`absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[0.5625rem] font-bold ring-2 ring-(--c-surface) ${
                  done ? 'text-white' : isNext ? 'bg-(--c-text) text-(--c-surface)' : 'bg-(--c-surface) text-(--c-muted) shadow'
                } ${isNext ? 'animate-pulse' : ''}`}
                style={{ left: `${nubi.pinPercents[i] ?? 0}%`, background: done ? NUBI_DONE : undefined }}
              >
                {done ? '✓' : i + 1}
              </button>
            )
          })}
        </div>

        {/* 다음 장소 */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-black/[0.035] p-3">
          {nubi.finished ? (
            <>
              <span className="text-3xl" aria-hidden>🎉</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">코스를 다 누볐어요!</p>
                <p className="text-xs text-(--c-muted)">
                  {formatDistance(nubi.movedM)} · {formatMinutes(elapsedMin)} 동안 {nubi.visited.size}곳
                </p>
              </div>
              <button type="button" onClick={nubi.reset} className="shrink-0 rounded-full border border-(--c-border) px-3 py-1.5 text-xs font-semibold">
                처음부터
              </button>
            </>
          ) : nubi.next ? (
            <>
              <span className="grid size-11 shrink-0 place-items-center rounded-full text-xl" style={{ background: nubi.next.pin.color }}>
                {nubi.next.pin.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] font-semibold text-(--c-muted)">{nubi.next.index === 0 ? '출발지' : `다음 · ${nubi.next.index + 1}번째`}</p>
                <p className="truncate font-bold">{nubi.next.pin.place.name}</p>
                <p className="text-xs text-(--c-muted)">
                  {!nubi.active
                    ? '위치를 켜면 남은 거리를 알려 드려요'
                    : nubi.toNextM == null
                      ? '위치 찾는 중…'
                      : `${formatDistance(nubi.toNextM)} 남음${nubi.toNextMin ? ` · 약 ${formatMinutes(nubi.toNextMin)}` : ''}${nubi.offRoute ? ' · 코스를 벗어났어요 (직선거리)' : ''}`}
                </p>
              </div>
              {nubi.active && (
                <button
                  type="button"
                  disabled={checking}
                  onClick={async () => {
                    setChecking(true)
                    const why = await nubi.arriveHere(nubi.next!.pin.id)
                    setChecking(false)
                    if (why) setToast({ text: why, error: true })
                  }}
                  className="shrink-0 rounded-full border border-(--c-border) px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                  title="자동으로 안 잡힐 때: 지금 위치가 장소 근처인지 확인하고 도착 체크"
                >
                  {checking ? '위치 확인 중…' : '도착 ✓'}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-(--c-muted)">코스에 장소가 없어요.</p>
          )}
        </div>

        {nubi.error && (
          <p role="alert" className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {nubi.error}
          </p>
        )}

        {!nubi.finished && (
          <div className="mt-3 flex gap-2">
            {nubi.active ? (
              <button type="button" onClick={nubi.stop} className="h-11 flex-1 rounded-xl border border-(--c-border) text-sm font-bold">
                ⏸ 잠깐 멈추기
              </button>
            ) : (
              <button type="button" onClick={nubi.start} disabled={pins.length === 0} className="tm-btn h-11 flex-1 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: NUBI_DONE }}>
                📍 {started ? '이어서 누비기' : '누비기 시작'}
              </button>
            )}
            {started && (
              <button
                type="button"
                onClick={() => window.confirm('도착 기록과 지나온 길을 지우고 처음부터 할까요?') && nubi.reset()}
                className="h-11 shrink-0 rounded-xl px-3 text-xs font-semibold text-(--c-muted) hover:bg-black/5"
              >
                처음부터
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-[0.6875rem] text-(--c-muted)">위치는 이 기기에만 남고 서버로 보내지 않아요.{onArrive ? ' (도착 인증은 장소까지 거리만 보내요)' : ''}</p>
      </section>
    </div>,
    document.body,
  )
}

/**
 * [📍 누비기] 버튼 + 누르면 누비기 모드. 누비던 중이면 '이어서 누비기'.
 *
 * @example
 * <NubiButton title={map.title} pins={pins} legs={legs} theme={theme} look={map} storageKey={`map:${map.id}`} />
 */
export function NubiButton({ className = '', ...props }: Omit<Props, 'onClose'> & { className?: string }) {
  // 오른쪽 아래 일정 창의 '누비는 중'에서 들어오면(?nubi=1) 바로 연다. 이 버튼은 지도 · 코스를 불러온 뒤 브라우저에서만 그려진다
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('nubi') === '1')
  // 누비던 중이면 진행도(%), 아니면 -1. localStorage 는 브라우저에서만 읽는다 (서버 화면은 '이 코스 누비기')
  const resume = useSyncExternalStore(subscribeNubi, () => nubiPercent(props.storageKey), () => -1)
  if (props.pins.length === 0) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tm-btn flex h-14 items-center gap-3 rounded-2xl px-4 text-left text-white ${className}`}
        style={{ background: NUBI_DONE }}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 text-lg" aria-hidden>
          📍
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-bold leading-tight">{resume >= 0 ? '이어서 누비기' : '이 코스 누비기'}</span>
          <span className="block truncate text-xs leading-tight opacity-85">
            {resume >= 0 ? `${resume}% 왔어요 · 이어서 남은 코스를 따라가요` : '코스를 따라 진행도 · 남은 거리를 봐요'}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold" style={{ color: NUBI_DONE }}>
          시작
        </span>
      </button>
      {open && (
        <NubiMode
          {...props}
          onClose={() => {
            setOpen(false)
            // 주소의 ?nubi=1 을 지워서 새로고침해도 다시 열리지 않게
            const url = new URL(window.location.href)
            if (url.searchParams.has('nubi')) {
              url.searchParams.delete('nubi')
              window.history.replaceState(window.history.state, '', url)
            }
          }}
        />
      )}
    </>
  )
}
