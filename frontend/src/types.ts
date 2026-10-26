// 프론트·백엔드 공용 타입. 바꿀 때는 두 담당자가 같이 확인한다.
// DB 는 snake_case, 여기는 camelCase. 변환은 src/db 안에서만 한다.

/** 색 테마 프리셋. 배경(라이트/다크)은 테마가 아니라 보는 사람 설정 (components/appearance.ts) */
export type ThemePreset = 'default' | 'pastel' | 'vintage' | 'neon' | 'forest'
/** 지도 색 테마: 프리셋 id 또는 직접 고른 색 '#rrggbb' */
export type ThemeId = ThemePreset | `#${string}`
/** 이동수단: 도보 · 대중교통 · 자동차 · 자전거 */
export type TravelMode = 'walk' | 'transit' | 'car' | 'bike'

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

// ---- 관리자 ----

export interface AdminUserRow {
  id: string
  email: string
  nickname: string
  role: UserRole
  suspended: boolean
  createdAt: string
}

export interface AdminUser extends AdminUserRow {
  mapCount: number
  meetupCount: number // 연 모임 수
}

export interface AdminStats {
  users: number
  suspended: number
  maps: number
  publicMaps: number
  meetupsOpen: number
  usesThisMonth: number
}

// ---- 프로필 꾸미기 (다이어리처럼) ----

/** 속지: 무지 · 줄노트 · 모눈 · 도트 · 크라프트지 · 미색 */
export type PaperId = 'plain' | 'lined' | 'grid' | 'dot' | 'kraft' | 'cream'
/** 글꼴: 기본 · 손글씨 · 동글동글 · 명조 · 펜글씨 */
export type ProfileFont = 'basic' | 'hand' | 'round' | 'serif' | 'pen'
/** 대표 지도 카드 모양: 폴라로이드 · 마스킹테이프 */
export type MapCardStyle = 'polaroid' | 'tape'

/** 프로필에 붙인 스티커 1개. x · y 는 꾸미기 판 안에서의 위치(%), size 는 px, rotate 는 도 */
export interface Sticker {
  id: string
  emoji: string
  x: number
  y: number
  size: number
  rotate: number
}

/** 꾸미기 요소별로 보일지 말지 (원하는 것만 골라 쓰기) */
export interface ProfileSections {
  intro: boolean // 소개글 · 오늘의 한마디
  stickers: boolean
  maps: boolean // 대표 지도
}

export interface ProfileDeco {
  userId: string
  paper: PaperId
  /** 속지 색 '#rrggbb' */
  color: string
  font: ProfileFont
  bio: string // 150자까지
  mood: string // 오늘의 한마디, 40자까지
  stickers: Sticker[] // 30개까지
  pinnedMapIds: string[] // 내 공개 지도 중 6개까지, 고른 순서대로
  mapStyle: MapCardStyle
  sections: ProfileSections
  updatedAt: string
}

export type ProfileDecoInput = Omit<ProfileDeco, 'userId' | 'updatedAt'>

/** getProfile() 결과: 사람 + 꾸미기 + 공개 지도(대표 지도 먼저) */
export interface ProfilePage {
  user: User
  deco: ProfileDeco
  maps: PublicMapSummary[]
}
