'use client'

import { useEffect, useRef, useState } from 'react'
import { legLabel, modeMeta } from '../legModes'
import { MapControls } from './MapControls'
import { PickPopup } from './PickPopup'
import { pathMidpoint } from './routing'
import type { Segment } from './segments'
import { DEFAULT_CENTER, NO_INSETS, type MapViewProps, type PickedPoint } from './types'
import { useLongPress } from './useLongPress'

interface Props extends MapViewProps {
  segments: Segment[]
  notice: string
}

/**
 * 카카오 키가 없거나 불러오기 실패했을 때 보여주는 미리보기 지도.
 * 실제 지도 타일 없이 핀 위치·순서·경로만 비율대로 그린다.
 */
export function FallbackMap({ pins, segments, theme, selectedPinId, onSelectPin, insets = NO_INSETS, onAddPlace, notice }: Props) {
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
  useLongPress(ref, canPick, (x, y) => {
    pickedAtRef.current = Date.now()
    setPicked(unproject(x, y))
  })
  const pickedAt = picked ? project(picked.lat, picked.lng) : null

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
      {size.w > 0 && segments.length > 0 && (
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h}>
          {segments.map((seg) => {
            const lines = seg.parts?.length
              ? seg.parts.map((p) => ({ path: p.path, color: p.walk ? theme.route : (p.color ?? theme.route), dash: p.walk ? modeMeta('walk').line.svg : undefined }))
              : [{ path: seg.path, color: theme.route, dash: modeMeta(seg.mode).line.svg }]
            return (
              <g key={seg.key} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={seg.loading ? 0.4 : 1}>
                {lines.map((l, i) => {
                  const points = l.path.map((p) => project(p.lat, p.lng)).map((p) => `${p.x},${p.y}`).join(' ')
                  return (
                    <g key={i}>
                      <polyline points={points} stroke="#fff" strokeWidth={9} strokeOpacity={0.9} />
                      <polyline points={points} stroke={l.color} strokeWidth={5} strokeOpacity={0.95} strokeDasharray={l.dash} />
                    </g>
                  )
                })}
              </g>
            )
          })}
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
              {legLabel(seg.mode, seg.durationMin)}
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
                style={{ ['--pin' as string]: pin.color }}
                onClick={() => onSelectPin(pin.id)}
                aria-label={`${i + 1}번 ${pin.place.name}`}
              >
                <span className="tm-marker-head" />
                <span className="tm-marker-emoji">{pin.icon}</span>
                <span className="tm-marker-no">{i + 1}</span>
                <span className="tm-marker-label">{pin.place.name}</span>
              </button>
            </div>
          )
        })}

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
        className="tm-float absolute left-1/2 z-10 max-w-[90%] -translate-x-1/2 rounded-full bg-white/95 px-3.5 py-1.5 text-center text-xs font-medium text-gray-600 backdrop-blur"
        style={{ top: insets.top + 12, marginLeft: (insets.left - insets.right) / 2 }}
      >
        {notice}
      </div>

      <MapControls insets={insets} />
    </div>
  )
}
