// 프론트·백엔드 공용 타입. 바꿀 때는 두 담당자가 같이 확인한다.
// DB 는 snake_case, 여기는 camelCase. 변환은 src/db 안에서만 한다.

/** 색 테마 프리셋. 배경(라이트/다크)은 테마가 아니라 보는 사람 설정 (components/appearance.ts) */
export type ThemePreset = 'default' | 'pastel' | 'vintage' | 'neon' | 'forest'
/** 지도 색 테마: 프리셋 id 또는 직접 고른 색 '#rrggbb' */
export type ThemeId = ThemePreset | `#${string}`
/** 이동수단: 도보 · 대중교통 · 자동차 · 자전거 */
export type TravelMode = 'walk' | 'transit' | 'car' | 'bike'

export type UserRole = 'user' | 'admin'

/** 지도 카테고리 (둘러보기에서 나눠 보기): 맛집 · 카페 · 데이트 · 1박 2일 · 당일치기 · 산책 · 전시·문화 · 촬영지·덕질 · 기타 */
export type MapCategory = 'food' | 'cafe' | 'date' | 'trip' | 'daytrip' | 'walk' | 'culture' | 'fandom' | 'etc'

/** 마커 모양: 물방울 핀 · 동그라미 · 네모 · 이모지만 */
export type MarkerShape = 'pin' | 'circle' | 'square' | 'emoji'
/** 코스 선 모양. auto 는 이동수단별 (도보 점선 · 대중교통 대시 · 자동차 실선) */
export type LineStyle = 'auto' | 'solid' | 'dash' | 'dot'
export type LineWidth = 'thin' | 'normal' | 'bold'

/** 지도 꾸미기 (마커 · 선 모양) */
export interface MapLook {
  markerShape: MarkerShape
  lineStyle: LineStyle
  lineWidth: LineWidth
}

export interface User {
  id: string
  nickname: string
  role?: UserRole // 없으면 'user'
  /** 프로필 사진. 없으면 닉네임 첫 글자 */
  avatarUrl?: string | null
}

// 전역 Map(자바스크립트 Map)과 이름이 겹치지 않도록 코드에서는 ConceptMap 을 쓴다.
/** 지도 용도: 기록(다녀온 곳, 공유돼서 남의 계획이 된다) / 계획(갈 곳) */
export type MapPurpose = 'record' | 'plan'

export interface ConceptMap {
  id: string
  ownerId: string
  title: string
  theme: ThemeId
  isPublic: boolean
  category: MapCategory
  markerShape: MarkerShape
  lineStyle: LineStyle
  lineWidth: LineWidth
  /** 커버 이미지 (카드 · 공개 지도 상단). 없으면 테마 색 썸네일 */
  coverUrl: string | null
  /** 이 코스를 갈 날 (YYYY-MM-DD). 주인 · 같이 꾸미는 사람 화면에만 보여 준다 */
  plannedDate: string | null
  purpose: MapPurpose
  /** 직접 적은 카테고리 이름 (category 가 'etc' 일 때 '기타' 대신) */
  categoryLabel: string | null
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

/** 함께 꾸미기: 지도 주인 + 공동 편집자 + 초대 코드(주인 · 편집자에게만) */
export interface MapCollab {
  owner: User
  editors: (User & { joinedAt: string })[]
  inviteCode: string | null
  /** 내 권한. 'viewer' = 볼 수만 있음 */
  myRole: 'owner' | 'editor' | 'viewer'
}

/** 초대 링크 미리보기 (참여 전) */
export interface MapInvitePreview {
  mapId: string
  title: string
  owner: User
  pinCount: number
  editorCount: number
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
  /** 아래는 안 보내면 그대로 (새 지도면 기본값) */
  category?: MapCategory
  markerShape?: MarkerShape
  lineStyle?: LineStyle
  lineWidth?: LineWidth
  coverUrl?: string | null
  plannedDate?: string | null
  purpose?: MapPurpose
  categoryLabel?: string | null
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
/** 공개 모집 · 친구끼리 비공개 (초대 링크를 받은 사람만 보고 참여) */
export type MeetupVisibility = 'public' | 'private'

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
  visibility: MeetupVisibility
  /** 비공개 모임 초대 코드. 주최자 · 참여자에게만 내려오고 나머지는 null */
  inviteCode: string | null
  createdAt: string
}

export interface MeetupMember {
  userId: string
  nickname: string
  avatarUrl?: string | null
  joinedAt: string
}

/** 목록·상세에서 쓰는 모임 정보 (주최자·참여자·지도 요약 포함) */
export interface MeetupSummary extends Meetup {
  host: User
  members: MeetupMember[] // 주최자 포함
  map: { id: string; title: string; theme: ThemeId; pinCount: number; coverUrl?: string | null }
}

export interface MeetupInput {
  id?: string
  mapId: string
  title: string
  description: string
  meetAt: string
  meetPoint: string
  capacity: number
  /** 안 보내면 공개 */
  visibility?: MeetupVisibility
}

export type MeetupFilter = 'all' | 'joined' | 'hosting'

/** 모임 댓글 종류: 대화 · 공지(주최자, 맨 위 고정) · 후기(모임 시간이 지난 뒤, 사진 가능) */
export type MeetupCommentKind = 'chat' | 'notice' | 'review'

export interface MeetupComment {
  id: string
  meetupId: string
  author: User
  kind: MeetupCommentKind
  body: string // 500자까지
  photoUrl: string | null
  createdAt: string
}

/** 순례방 도착 체크: 누가 코스의 어느 장소에 도착했는지 */
export interface MeetupCheckin {
  userId: string
  pinId: string
  createdAt: string
}

export interface MeetupCommentInput {
  kind: MeetupCommentKind
  body: string
  photoUrl: string | null
}

// ---- 지도 사용 · 월간 순위 ----

/** 공개 지도 요약 (주인 닉네임 포함) */
export interface PublicMapSummary {
  map: ConceptMap
  owner: User
  pinCount: number
}

/** 둘러보기 목록: 공개 지도 + 이번 달 사용한 사람 수 */
export interface ExploreMapEntry extends PublicMapSummary {
  users: number
}

export type ExploreSort = 'popular' | 'recent'

/** 검색: 지도 필터. region 은 components/regions.ts 의 id */
export interface MapSearchFilters {
  q?: string
  purpose?: MapPurpose
  category?: MapCategory
  region?: string
  /** 장소 몇 곳 이상 */
  minPins?: number
  /** 지금 모집 중인 성지순례가 있는 지도만 */
  hasMeetup?: boolean
  /** relevance: 검색어 관련도순 (검색어가 있을 때 기본) */
  sort?: 'relevance' | 'popular' | 'recent' | 'pins'
}
export interface MapSearchEntry extends ExploreMapEntry {
  /** 지금 모집 중인 공개 성지순례 수 */
  openMeetups: number
}
export interface PersonSearchEntry {
  user: User
  publicMaps: number
}
/** 노쇼 방지: 30일 안 노쇼 수 · 참여가 막힌 기한(ISO, 안 막혔으면 null) */
export interface NoshowStatus {
  recentCount: number
  blockedUntil: string | null
}

export interface MapRankingEntry extends PublicMapSummary {
  rank: number
  /** 그 달에 이 지도를 사용한 사람 수 (주인 제외, 중복 제외) */
  users: number
}

// ---- 신고 · 차단 · 문제 제보 ----

/** 무엇을 신고하나: 사람 · 모임 · 지도 · 댓글 · 서비스 문제(버그·제안) */
export type ReportTarget = 'user' | 'meetup' | 'map' | 'comment' | 'bug' | 'review'
/** 사람·콘텐츠 신고 사유 */
export type AbuseReason = 'spam' | 'abuse' | 'inappropriate' | 'scam' | 'privacy' | 'other'
/** 서비스 문제 종류 */
export type BugReason = 'broken' | 'map' | 'display' | 'suggestion' | 'other'
export type ReportReason = AbuseReason | BugReason
export type ReportStatus = 'open' | 'resolved' | 'dismissed'

export interface Report {
  id: string
  reporter: User | null // 로그인 안 하고 보낸 문제 제보는 null
  target: ReportTarget
  targetId: string | null
  /** 목록에서 알아보기 쉽게: 닉네임 · 모임 이름 · 댓글 앞부분 */
  targetLabel: string
  /** 신고 대상의 주인 (사람 신고면 그 사람, 댓글·모임·지도면 쓴 사람). 관리자가 바로 정지할 때 쓴다 */
  targetUserId: string | null
  reason: ReportReason
  detail: string // 1000자까지
  /** 신고한 화면 주소 (문제 제보 재현용) */
  pageUrl: string
  /** 브라우저 정보 (문제 제보만) */
  userAgent: string
  status: ReportStatus
  adminNote: string
  createdAt: string
  resolvedAt: string | null
}

export type ReportInput = Pick<Report, 'target' | 'targetId' | 'targetLabel' | 'targetUserId' | 'reason' | 'detail' | 'pageUrl'>

// ---- 관리자 ----

export interface AdminUserRow {
  id: string
  email: string
  nickname: string
  avatarUrl?: string | null
  role: UserRole
  suspended: boolean
  createdAt: string
}

export interface AdminUser extends AdminUserRow {
  mapCount: number
  meetupCount: number // 연 모임 수
}

export interface AdminStats {
  /** 처리 안 된 신고 수 */
  reportsOpen: number
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
  /** 프로필 맨 위 배너 사진. 없으면 속지 무늬 + 테마색 */
  bannerUrl: string | null
  updatedAt: string
}

export type ProfileDecoInput = Omit<ProfileDeco, 'userId' | 'updatedAt'>

/** getProfile() 결과: 사람 + 꾸미기 + 공개 지도(대표 지도 먼저) */
export interface ProfilePage {
  user: User
  deco: ProfileDeco
  maps: PublicMapSummary[]
}

// ---- 장소 리뷰 · 인기 장소 ----

/** 장소 통계: 담긴 지도 수(비공개 지도 포함) · 리뷰 수 · 평균 별점(리뷰 없으면 null) */
export interface PlaceStats {
  mapCount: number
  reviewCount: number
  avgRating: number | null
}

export interface PlaceReview {
  id: string
  placeId: string
  author: User
  rating: number // 1~5
  body: string // 한 줄 후기 (100자까지, 비워도 됨)
  /** 신고가 3명 이상 모여 숨겨짐 (쓴 사람 · 관리자에게만 보인다) */
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export interface PlaceReviewInput {
  rating: number
  body: string
}

/** getPlaceDetail() 결과: 장소 + 통계 + 리뷰(최신 순) + 이 장소를 담은 공개 지도 */
export interface PlaceDetail {
  place: Place
  stats: PlaceStats
  reviews: PlaceReview[]
  maps: PublicMapSummary[]
  /** 내가 리뷰를 쓸 수 있나 (내 지도에 담은 장소일 때만) */
  canReview: boolean
}
