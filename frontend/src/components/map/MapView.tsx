'use client'

import { useState } from 'react'
import { FallbackMap } from './FallbackMap'
import { KakaoMap } from './KakaoMap'
import { hasKakaoKey } from './loadKakao'
import { useSegments } from './segments'
import type { MapViewProps } from './types'

/**
 * 지도 컴포넌트. 키가 있으면 카카오맵, 없거나 실패하면 미리보기 지도.
 * 핀 사이는 이동수단별 실제 길로 그린다 (routing.ts).
 * 다른 컴포넌트는 카카오 SDK 대신 이것만 쓴다 (나중에 Mapbox 로 바꿀 때 이 폴더만 고치면 됨).
 *
 * @example
 * <MapView pins={pins} legs={legs} theme={theme} selectedPinId={id} onSelectPin={setId} insets={{ top: 72, left: 460, right: 0, bottom: 0 }} />
 */
export function MapView(props: MapViewProps) {
  const [loadError, setLoadError] = useState<string | null>(null)
  const segments = useSegments(props.pins, props.legs)

  if (!hasKakaoKey || loadError) {
    const notice = loadError
      ? `${loadError} · 미리보기 지도로 보여드려요`
      : '카카오맵 키가 없어 미리보기 지도로 보여드려요'
    return <FallbackMap {...props} segments={segments} notice={notice} />
  }
  return <KakaoMap {...props} segments={segments} onLoadError={setLoadError} />
}
