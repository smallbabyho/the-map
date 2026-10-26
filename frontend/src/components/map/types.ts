import type { MapLook, Pin, TravelMode } from '../../types'
import type { Theme } from '../themes'
import type { PlaceSearchResult } from './placeSearch'

/** 지도 위에 패널이 덮고 있는 영역(px). 핀을 화면에 맞출 때 이만큼 피해서 보여준다. */
export interface MapInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface MapLegView {
  fromPinId: string
  toPinId: string
  mode: TravelMode
  durationMin: number | null
}

export interface MapViewProps {
  pins: Pin[]
  legs: MapLegView[]
  theme: Theme
  /** 마커 모양 · 선 모양/굵기. 없으면 기본 (segments.ts DEFAULT_LOOK) */
  look?: MapLook
  selectedPinId: string | null
  onSelectPin: (pinId: string) => void
  insets?: MapInsets
  /** 지도를 누르면(우클릭 · 길게 누르기도) 뜨는 팝업에서 장소를 고르면 호출. 없으면 지도 찍기 기능 꺼짐. */
  onAddPlace?: (place: PlaceSearchResult) => void
}

/** 지도에서 찍은 지점 */
export interface PickedPoint {
  lat: number
  lng: number
}

export const NO_INSETS: MapInsets = { top: 0, right: 0, bottom: 0, left: 0 }

/** 서울시청 (핀이 없을 때 기본 중심) */
export const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }
