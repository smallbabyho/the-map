'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { modeMeta } from '../legModes'
import { loadKakao } from './loadKakao'
import { createLegLabelElement, createMarkerElement, createMyLocationElement } from './markerElement'
import { MapControls } from './MapControls'
import { PickPopup } from './PickPopup'
import { pathMidpoint } from './routing'
import type { Segment } from './segments'
import { useLongPress } from './useLongPress'
import { DEFAULT_CENTER, NO_INSETS, type MapViewProps, type PickedPoint } from './types'
import { useMyLocation, type MyPosition } from './useMyLocation'

interface Props extends MapViewProps {
  segments: Segment[]
  onLoadError: (message: string) => void
}

export function KakaoMap({ pins, segments, theme, selectedPinId, onSelectPin, insets = NO_INSETS, onAddPlace, onLoadError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const [ready, setReady] = useState(false)
  const me = useMyLocation()
  const canPick = onAddPlace != null
  const [picked, setPicked] = useState<PickedPoint | null>(null)
  const pickedAtRef = useRef(0)
  // 우클릭 팝업을 그릴 DOM (카카오 CustomOverlay 안에 React 포털로 렌더)
  const popupHost = useMemo(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    el.className = 'tm-overlay'
    return el
  }, [])

  // 최신 콜백/값을 이벤트 핸들러에서 쓰기 위한 ref (effect 재실행 없이)
  const onSelectRef = useRef(onSelectPin)
  const onErrorRef = useRef(onLoadError)
  const insetsRef = useRef(insets)
  const pinsRef = useRef(pins)
  const onAddRef = useRef(onAddPlace)
  useEffect(() => {
    onAddRef.current = onAddPlace
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

  // 2) 경로선 · 구간 라벨 그리기
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const k = window.kakao!
    const drawn: { setMap(m: kakao.maps.Map | null): void }[] = []

    // 구간마다 실제 길: 흰 테두리 + 이동수단별 선 모양 (도보 점선, 대중교통 짧은 대시, 자동차 실선, 자전거 대시)
    // 대중교통 상세가 있으면 단계별로: 걷기는 점선, 버스·지하철은 노선 색 실선
    for (const seg of segments) {
      const lines = seg.parts?.length
        ? seg.parts.map((p) => ({ path: p.path, color: p.walk ? theme.route : (p.color ?? theme.route), style: p.walk ? 'shortdot' : 'solid' }))
        : [{ path: seg.path, color: theme.route, style: modeMeta(seg.mode).line.kakao }]
      for (const l of lines) {
        const path = l.path.map((p) => new k.maps.LatLng(p.lat, p.lng))
        drawn.push(
          new k.maps.Polyline({ path, strokeWeight: 9, strokeColor: '#ffffff', strokeOpacity: seg.loading ? 0.4 : 0.9, strokeStyle: 'solid' }),
          new k.maps.Polyline({ path, strokeWeight: 5, strokeColor: l.color, strokeOpacity: seg.loading ? 0.35 : 0.95, strokeStyle: l.style }),
        )
      }

      const mid = pathMidpoint(seg.path)
      drawn.push(new k.maps.CustomOverlay({ position: new k.maps.LatLng(mid.lat, mid.lng), content: createLegLabelElement(seg, theme.route), yAnchor: 0.5, zIndex: 1 }))
    }
    drawn.forEach((o) => o.setMap(map))
    return () => drawn.forEach((o) => o.setMap(null))
  }, [ready, segments, theme.route])

  // 3) 핀 마커 (선택이 바뀌어도 경로선은 다시 그리지 않는다)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const k = window.kakao!
    const drawn: kakao.maps.CustomOverlay[] = []
    const pos = new Map(pins.map((p) => [p.id, new k.maps.LatLng(p.place.lat, p.place.lng)]))

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
  }, [ready, pins, selectedPinId])

  // 4) 핀 개수가 바뀌면 전체가 보이게 맞춤
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

  // 5) 선택한 핀으로 이동. 패널이 가린 부분을 빼고 '보이는 영역'의 가운데로 온다.
  useEffect(() => {
    const map = mapRef.current
    const pin = pinsRef.current.find((p) => p.id === selectedPinId)
    if (!ready || !map || !pin) return
    const ins = insetsRef.current
    map.setCenter(new window.kakao!.maps.LatLng(pin.place.lat, pin.place.lng))
    map.panBy(-(ins.left - ins.right) / 2, -(ins.top - ins.bottom) / 2)
  }, [ready, selectedPinId])

  // 6) 내 위치 (파란 점 + 오차 범위)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !me.pos) return
    const k = window.kakao!
    const center = new k.maps.LatLng(me.pos.lat, me.pos.lng)
    const circle = new k.maps.Circle({
      center,
      radius: Math.min(me.pos.accuracy, 500),
      strokeWeight: 1,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.4,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
    })
    const dot = new k.maps.CustomOverlay({ position: center, content: createMyLocationElement(), yAnchor: 0.5, xAnchor: 0.5, zIndex: 5 })
    circle.setMap(map)
    dot.setMap(map)
    return () => {
      circle.setMap(null)
      dot.setMap(null)
    }
  }, [ready, me.pos])

  // 7) 우클릭 → 그 지점에 팝업. 지도 빈 곳을 누르면 닫힘.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !canPick) return
    const ev = window.kakao!.maps.event
    const onRight = (e: kakao.maps.event.MouseEvent) => setPicked({ lat: e.latLng.getLat(), lng: e.latLng.getLng() })
    // 길게 누르기 직후 손을 떼면 click 이 같이 오므로, 방금 연 팝업은 닫지 않는다
    const onClick = () => Date.now() - pickedAtRef.current > 700 && setPicked(null)
    ev.addListener(map, 'rightclick', onRight)
    ev.addListener(map, 'click', onClick)
    return () => {
      ev.removeListener(map, 'rightclick', onRight)
      ev.removeListener(map, 'click', onClick)
    }
  }, [ready, canPick])

  // 8) 확대·축소 애니메이션 동안 경로선을 잠깐 숨긴다.
  // 카카오는 줌 애니메이션 프레임마다 경로선(SVG)을 다시 그려서 선이 많으면 버벅인다 (측정상 렌더링 비용 약 60% 감소).
  const zoomWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = mapRef.current
    const wrap = zoomWrapRef.current
    if (!ready || !map || !wrap) return
    const ev = window.kakao!.maps.event
    let timer: ReturnType<typeof setTimeout> | undefined
    const onStart = () => {
      clearTimeout(timer)
      wrap.classList.add('tm-zooming')
    }
    const onEnd = () => {
      clearTimeout(timer)
      timer = setTimeout(() => wrap.classList.remove('tm-zooming'), 150)
    }
    ev.addListener(map, 'zoom_start', onStart)
    ev.addListener(map, 'zoom_changed', onEnd)
    return () => {
      clearTimeout(timer)
      ev.removeListener(map, 'zoom_start', onStart)
      ev.removeListener(map, 'zoom_changed', onEnd)
    }
  }, [ready])

  // 모바일: 길게 누르기 = 우클릭
  const pressRef = useRef<HTMLDivElement>(null)
  useLongPress(pressRef, ready && canPick, (x, y) => {
    const ll = mapRef.current?.getProjection().coordsFromContainerPoint(new window.kakao!.maps.Point(x, y))
    if (!ll) return
    pickedAtRef.current = Date.now()
    setPicked({ lat: ll.getLat(), lng: ll.getLng() })
  })

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !picked || !popupHost) return
    const overlay = new window.kakao!.maps.CustomOverlay({
      position: new window.kakao!.maps.LatLng(picked.lat, picked.lng),
      content: popupHost,
      yAnchor: 1,
      zIndex: 20,
      clickable: true,
    })
    overlay.setMap(map)
    return () => overlay.setMap(null)
  }, [ready, picked, popupHost])

  const goToMe = () =>
    me.locate((p: MyPosition) => {
      const map = mapRef.current
      if (!map) return
      if (map.getLevel() > 4) map.setLevel(4)
      const ins = insetsRef.current
      map.setCenter(new window.kakao!.maps.LatLng(p.lat, p.lng))
      map.panBy(-(ins.left - ins.right) / 2, -(ins.top - ins.bottom) / 2)
    })

  return (
    <>
      {/* 테마 톤(필터)은 바깥 div 에 건다. 카카오가 지도 컨테이너의 class 를 건드릴 수 있어서. */}
      <div
        className={`absolute inset-0 ${theme.id !== 'default' ? `tm-map-${theme.id}` : ''}`}
        ref={pressRef}
        onContextMenu={(e) => canPick && e.preventDefault()}
      >
        <div ref={zoomWrapRef} className="absolute inset-0">
          <div ref={containerRef} className="absolute inset-0" />
        </div>
      </div>
      {picked &&
        popupHost &&
        createPortal(
          <PickPopup
            point={picked}
            onAdd={(place) => {
              onAddRef.current?.(place)
              setPicked(null)
            }}
            onClose={() => setPicked(null)}
          />,
          popupHost,
        )}
      {ready && (
        <MapControls
          insets={insets}
          onZoomIn={() => mapRef.current?.setLevel(Math.max(1, mapRef.current.getLevel() - 1))}
          onZoomOut={() => mapRef.current?.setLevel(Math.min(14, mapRef.current.getLevel() + 1))}
          onFit={pins.length > 0 ? fitAll : undefined}
          onLocate={goToMe}
          locating={me.locating}
          located={me.pos != null}
        />
      )}
      {me.error && (
        <div
          role="alert"
          className="tm-float absolute left-1/2 z-40 w-max max-w-[calc(100%-32px)] -translate-x-1/2 rounded-2xl bg-gray-900/90 px-4 py-2.5 text-center text-sm font-medium text-white backdrop-blur"
          style={{ top: insets.top + 12, marginLeft: (insets.left - insets.right) / 2 }}
        >
          {me.error}
        </div>
      )}
    </>
  )
}
