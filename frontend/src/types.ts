// 프론트·백엔드 공용 타입. 바꿀 때는 두 담당자가 같이 확인한다.
// DB 는 snake_case, 여기는 camelCase. 변환은 src/db 안에서만 한다.

export type ThemeId = 'default' | 'pastel' | 'dark' | 'vintage'
export type TravelMode = 'walk' | 'bus' | 'subway' | 'car'

export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  nickname: string
  role?: UserRole // 없으면 'user'
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

// ---- 성지순례(모임) ----

export type MeetupStatus = 'open' | 'closed' | 'canceled'

export interface Meetup {
  id: string
  mapId: string
  hostId: string
  title: string
  description: string
  meetAt: string // ISO 날짜·시간
  meetPoint: string // 모이는 곳 (예: 첫 번째 핀 이름)
  capacity: number // 주최자 포함 최대 인원
  status: MeetupStatus
  createdAt: string
}

export interface MeetupMember {
  userId: string
  nickname: string
  joinedAt: string
}

/** 목록·상세에서 쓰는 모임 정보 (주최자·참여자·지도 요약 포함) */
export interface MeetupSummary extends Meetup {
  host: User
  members: MeetupMember[] // 주최자 포함
  map: { id: string; title: string; theme: ThemeId; pinCount: number }
}

export interface MeetupInput {
  id?: string
  mapId: string
  title: string
  description: string
  meetAt: string
  meetPoint: string
  capacity: number
}

export type MeetupFilter = 'all' | 'joined' | 'hosting'

// ---- 지도 사용 · 월간 순위 ----

/** 공개 지도 요약 (주인 닉네임 포함) */
export interface PublicMapSummary {
  map: ConceptMap
  owner: User
  pinCount: number
}

export interface MapRankingEntry extends PublicMapSummary {
  rank: number
  /** 그 달에 이 지도를 사용한 사람 수 (주인 제외, 중복 제외) */
  users: number
}
