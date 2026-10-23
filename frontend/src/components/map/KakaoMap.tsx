'use client'

import { useEffect, useRef, useState } from 'react'
import { loadKakao } from './loadKakao'
import { createLegLabelElement, createMarkerElement } from './markerElement'
import { MapControls } from './MapControls'
import { DEFAULT_CENTER, NO_INSETS, type MapViewProps } from './types'

interface Props extends MapViewProps {
  onLoadError: (message: string) => void
}

export function KakaoMap({ pins, legs, theme, selectedPinId, onSelectPin, insets = NO_INSETS, onLoadError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const [ready, setReady] = useState(false)

  // 최신 콜백/값을 이벤트 핸들러에서 쓰기 위한 ref (effect 재실행 없이)
  const onSelectRef = useRef(onSelectPin)
  const onErrorRef = useRef(onLoadError)
  const insetsRef = useRef(insets)
  const pinsRef = useRef(pins)
  useEffect(() => {
    onSelectRef.current = onSelectPin
    onErrorRef.current = onLoadError
    insetsRef.current = insets
    pinsRef.current = pins
  })

  // 1) SDK 로드 + 지도 생성 (한 번)
  useEffect(() => {
    let cancelled = false
    loadKakao()
      .then((k) => {
        if (cancelled || !containerRef.current) return
        mapRef.current = new k.maps.Map(containerRef.current, {
          center: new k.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          level: 7,
        })
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) onErrorRef.current(e instanceof Error ? e.message : '카카오맵을 불러오지 못했어요.')
      })
    const onResize = () => mapRef.current?.relayout()
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // 2) 마커 · 경로 · 구간 라벨 그리기
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const k = window.kakao!
    const drawn: { setMap(m: kakao.maps.Map | null): void }[] = []
    const pos = new Map(pins.map((p) => [p.id, new k.maps.LatLng(p.place.lat, p.place.lng)]))

    if (pins.length > 1) {
      const line = new k.maps.Polyline({
        path: pins.map((p) => pos.get(p.id)!),
        strokeWeight: 5,
        strokeColor: theme.route,
        strokeOpacity: 0.85,
        strokeStyle: 'solid',
      })
      line.setMap(map)
      drawn.push(line)
    }

    for (const leg of legs) {
      const a = pos.get(leg.fromPinId)
      const b = pos.get(leg.toPinId)
      if (!a || !b) continue
      const mid = new k.maps.LatLng((a.getLat() + b.getLat()) / 2, (a.getLng() + b.getLng()) / 2)
      const label = new k.maps.CustomOverlay({ position: mid, content: createLegLabelElement(leg, theme.route), yAnchor: 0.5, zIndex: 1 })
      label.setMap(map)
      drawn.push(label)
    }

    pins.forEach((pin, i) => {
      const selected = pin.id === selectedPinId
      const overlay = new k.maps.CustomOverlay({
        position: pos.get(pin.id)!,
        content: createMarkerElement(pin, i, selected, () => onSelectRef.current(pin.id)),
        yAnchor: 1,
        zIndex: selected ? 10 : 2,
        clickable: true,
      })
      overlay.setMap(map)
      drawn.push(overlay)
    })

    return () => drawn.forEach((o) => o.setMap(null))
  }, [ready, pins, legs, selectedPinId, theme.route])

  // 3) 핀 개수가 바뀌면 전체가 보이게 맞춤
  const fitAll = () => {
    const map = mapRef.current
    const list = pinsRef.current
    if (!map || list.length === 0) return
    const k = window.kakao!
    if (list.length === 1) {
      map.setLevel(4)
      map.setCenter(new k.maps.LatLng(list[0].place.lat, list[0].place.lng))
      return
    }
    const bounds = new k.maps.LatLngBounds()
    list.forEach((p) => bounds.extend(new k.maps.LatLng(p.place.lat, p.place.lng)))
    // 패널이 너무 많이 가려서 보이는 영역이 작으면 그 방향 여백은 무시 (지도가 지나치게 축소되는 것 방지)
    const el = containerRef.current
    const ins = { ...insetsRef.current }
    if (el && el.clientHeight - ins.top - ins.bottom < 220) ins.bottom = 0
    if (el && el.clientWidth - ins.left - ins.right < 220) ins.left = 0
    map.setBounds(bounds, ins.top + 60, ins.right + 60, ins.bottom + 60, ins.left + 60)
  }
  const pinCount = pins.length
  useEffect(() => {
    if (ready) fitAll()
  }, [ready, pinCount])

  // 4) 선택한 핀으로 이동. 패널이 가린 부분을 빼고 '보이는 영역'의 가운데로 온다.
  useEffect(() => {
    const map = mapRef.current
    const pin = pinsRef.current.find((p) => p.id === selectedPinId)
    if (!ready || !map || !pin) return
    const ins = insetsRef.current
    map.setCenter(new window.kakao!.maps.LatLng(pin.place.lat, pin.place.lng))
    map.panBy(-(ins.left - ins.right) / 2, -(ins.top - ins.bottom) / 2)
  }, [ready, selectedPinId])

  return (
    <>
      {/* 테마 톤(필터)은 바깥 div 에 건다. 카카오가 지도 컨테이너의 class 를 건드릴 수 있어서. */}
      <div className={`absolute inset-0 ${theme.id !== 'default' ? `tm-map-${theme.id}` : ''}`}>
        <div ref={containerRef} className="absolute inset-0" />
      </div>
      {ready && (
        <MapControls
          insets={insets}
          onZoomIn={() => mapRef.current?.setLevel(Math.max(1, mapRef.current.getLevel() - 1))}
          onZoomOut={() => mapRef.current?.setLevel(Math.min(14, mapRef.current.getLevel() + 1))}
          onFit={pins.length > 0 ? fitAll : undefined}
        />
      )}
    </>
  )
}
