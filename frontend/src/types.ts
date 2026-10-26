// 프론트·백엔드 공용 타입. 바꿀 때는 두 담당자가 같이 확인한다.
// DB 는 snake_case, 여기는 camelCase. 변환은 src/db 안에서만 한다.

export type ThemeId = 'default' | 'pastel' | 'dark' | 'vintage'
export type TravelMode = 'walk' | 'bus' | 'subway' | 'car'

export interface User {
  id: string
  nickname: string
}

// 전역 Map(자바스크립트 Map)과 이름이 겹치지 않도록 코드에서는 ConceptMap 을 쓴다.
export interface ConceptMap {
  id: string
  ownerId: string
  title: string
  theme: ThemeId
  isPublic: boolean
  createdAt: string
  updatedAt: string
}
export type { ConceptMap as Map }

export interface Place {
  id: string
  externalId: string // 카카오 장소 ID
  name: string
  lat: number
  lng: number
}

export interface Pin {
  id: string
  mapId: string
  place: Place
  order: number
  icon: string // 이모지
  color: string // #rrggbb
  memo: string
  photoUrl: string | null
  visitedAt: string | null // YYYY-MM-DD
}

export interface Leg {
  id: string
  mapId: string
  fromPinId: string
  toPinId: string
  mode: TravelMode
  durationMin: number | null
  isManual: boolean
}

/** getMap() 결과: 지도 1개 + 핀(order 순) + 이동구간 */
export interface MapDetail {
  map: ConceptMap
  pins: Pin[]
  legs: Leg[]
}

// ---- 저장 함수 입력 ----
// id 가 있으면 수정, 없으면 생성.

export interface MapInput {
  id?: string
  title: string
  theme: ThemeId
  isPublic: boolean
}

/** 핀 저장 시 place 는 externalId 로 찾고, 없으면 새로 만든다. */
export interface PinInput {
  id?: string
  place: Omit<Place, 'id'>
  order: number
  icon: string
  color: string
  memo: string
  photoUrl: string | null
  visitedAt: string | null
}

/** 같은 (fromPinId, toPinId) 구간이 이미 있으면 덮어쓴다. */
export interface LegInput {
  id?: string
  fromPinId: string
  toPinId: string
  mode: TravelMode
  durationMin: number | null
  isManual: boolean
}
