'use client'

import { useEffect, useRef, useState } from 'react'
import { legLabel, modeMeta } from '../legModes'
import { MapControls } from './MapControls'
import { PickPopup } from './PickPopup'
import { pathMidpoint } from './routing'
import { NUBI_DONE } from './nubiColors'
import { DEFAULT_LOOK, LINE_WIDTH, partLine, styledLine, type Segment } from './segments'
import { DEFAULT_CENTER, NO_INSETS, type MapViewProps, type PickedPoint } from './types'
import { PressRing, useLongPress } from './useLongPress'

interface Props extends MapViewProps {
  segments: Segment[]
  notice: string
}

/**
 * 카카오 키가 없거나 불러오기 실패했을 때 보여주는 미리보기 지도.
 * 실제 지도 타일 없이 핀 위치·순서·경로만 비율대로 그린다.
 */
export function FallbackMap({ pins, segments, theme, look = DEFAULT_LOOK, selectedPinId, onSelectPin, insets = NO_INSETS, onAddPlace, notice, live }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [picked, setPicked] = useState<PickedPoint | null>(null)
  const pickedAtRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 패널을 피한 영역 안에 핀을 배치 (위도는 위가 북쪽)
  const pad = 70
  const area = {
    x: insets.left + pad,
    y: insets.top + pad,
    w: Math.max(40, size.w - insets.left - insets.right - pad * 2),
    h: Math.max(40, size.h - insets.top - insets.bottom - pad * 2),
  }
  // 핀이 없으면 서울시청 주변을 기준으로 그린다
  const lats = pins.length ? pins.map((p) => p.place.lat) : [DEFAULT_CENTER.lat]
  const lngs = pins.length ? pins.map((p) => p.place.lng) : [DEFAULT_CENTER.lng]
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const spanLat = Math.max(maxLat - minLat, 0.002)
  const spanLng = Math.max(maxLng - minLng, 0.002)
  const scale = Math.min(area.w / spanLng, area.h / spanLat)
  const cx = area.x + area.w / 2
  const cy = area.y + area.h / 2
  const project = (lat: number, lng: number) => ({
    x: cx + (lng - (minLng + maxLng) / 2) * scale,
    y: cy - (lat - (minLat + maxLat) / 2) * scale,
  })
  const unproject = (x: number, y: number): PickedPoint => ({
    lat: (cy - y) / scale + (minLat + maxLat) / 2,
    lng: (x - cx) / scale + (minLng + maxLng) / 2,
  })
  const pos = new Map(pins.map((p) => [p.id, project(p.place.lat, p.place.lng)]))
  const canPick = onAddPlace != null
  const pressing = useLongPress(ref, canPick, (x, y) => {
    pickedAtRef.current = Date.now()
    setPicked(unproject(x, y))
  })
  const pickedAt = picked ? project(picked.lat, picked.lng) : null
  const toPoints = (path: { lat: number; lng: number }[]) => path.map((p) => project(p.lat, p.lng)).map((p) => `${p.x},${p.y}`).join(' ')
  const visited = new Set(live?.visited)
  const meAt = live?.me ? project(live.me.lat, live.me.lng) : null

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden"
      onContextMenu={(e) => {
        if (!canPick) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        setPicked(unproject(e.clientX - rect.left, e.clientY - rect.top))
      }}
      onClick={() => Date.now() - pickedAtRef.current > 700 && setPicked(null)}
      style={{
        backgroundColor: 'var(--c-map-bg)',
        backgroundImage:
          'linear-gradient(var(--c-map-grid) 1px, transparent 1px), linear-gradient(90deg, var(--c-map-grid) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    >
      <PressRing at={pressing} />
      {size.w > 0 && segments.length > 0 && (
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h}>
          {segments.map((seg) => {
            const lines = seg.parts?.length
              ? seg.parts.map((p) => ({ path: p.path, color: p.color ?? theme.route, dash: styledLine(partLine(p.kind), look.lineStyle, p.kind).svg }))
              : [{ path: seg.path, color: theme.route, dash: styledLine(modeMeta(seg.mode).line, look.lineStyle).svg }]
            const [outer, inner] = LINE_WIDTH[look.lineWidth]
            return (
              <g key={seg.key} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={seg.loading ? 0.4 : 1}>
                {lines.map((l, i) => {
                  const points = l.path.map((p) => project(p.lat, p.lng)).map((p) => `${p.x},${p.y}`).join(' ')
                  return (
                    <g key={i}>
                      <polyline points={points} stroke="#fff" strokeWidth={outer} strokeOpacity={0.9} />
                      <polyline points={points} stroke={l.color} strokeWidth={inner} strokeOpacity={0.95} strokeDasharray={l.dash} />
                    </g>
                  )
                })}
              </g>
            )
          })}
          {/* 누비기: 지나온 코스 + 실제로 움직인 길 */}
          {live && live.donePath.length > 1 && (
            <g fill="none" strokeLinejoin="round" strokeLinecap="round">
              <polyline points={toPoints(live.donePath)} stroke="#fff" strokeWidth={LINE_WIDTH[look.lineWidth][0] + 4} />
              <polyline points={toPoints(live.donePath)} stroke={NUBI_DONE} strokeWidth={LINE_WIDTH[look.lineWidth][1] + 3} />
            </g>
          )}
          {live && live.trail.length > 1 && <polyline points={toPoints(live.trail)} fill="none" stroke="#3b82f6" strokeOpacity={0.75} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />}
        </svg>
      )}

      {size.w > 0 &&
        segments.map((seg) => {
          const mid = pathMidpoint(seg.path)
          const p = project(mid.lat, mid.lng)
          return (
            <div
              key={seg.key}
              className="tm-leg-label absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: p.x, top: p.y, ['--route' as string]: theme.route }}
            >
              {legLabel(seg.mode, seg.durationMin, seg.icon)}
            </div>
          )
        })}

      {size.w > 0 &&
        pins.map((pin, i) => {
          const p = pos.get(pin.id)!
          const selected = pin.id === selectedPinId
          return (
            <div key={pin.id} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: p.x, top: p.y, zIndex: selected ? 10 : 2 }}>
              <button
                type="button"
                className="tm-marker"
                data-selected={selected}
                data-shape={look.markerShape}
                data-visited={visited.has(pin.id) || undefined}
                style={{ ['--pin' as string]: pin.color }}
                onClick={() => onSelectPin(pin.id)}
                aria-label={`${i + 1}번 ${pin.place.name}`}
              >
                <span className="tm-marker-head" />
                <span className="tm-marker-emoji">{pin.icon}</span>
                <span className="tm-marker-no">{visited.has(pin.id) ? '✓' : i + 1}</span>
                <span className="tm-marker-label">{pin.place.name}</span>
              </button>
            </div>
          )
        })}

      {meAt && <div className="tm-me absolute z-[5] -translate-x-1/2 -translate-y-1/2" style={{ left: meAt.x, top: meAt.y }} aria-label="내 위치" />}

      {picked && pickedAt && (
        <div className="absolute z-20 -translate-x-1/2 -translate-y-full" style={{ left: pickedAt.x, top: pickedAt.y }}>
          <PickPopup
            point={picked}
            onAdd={(place) => {
              onAddPlace?.(place)
              setPicked(null)
            }}
            onClose={() => setPicked(null)}
          />
        </div>
      )}

      <div
        className="tm-float absolute left-1/2 z-10 max-w-[90%] -translate-x-1/2 rounded-full bg-(--c-surface) px-3.5 py-1.5 text-center text-xs font-medium text-(--c-muted)"
        style={{ top: insets.top + 12, marginLeft: (insets.left - insets.right) / 2 }}
      >
        {notice}
      </div>

      <MapControls insets={insets} />
    </div>
  )
}
