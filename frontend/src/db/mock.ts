// 백엔드가 붙기 전까지 쓰는 가짜 데이터 함수 (localStorage 저장).
// 진짜 Supabase 버전(src/db/index.ts)은 이 파일과 함수 이름·입력·반환 형태가 완전히 같아야 한다.
// 화면 코드는 반드시 src/db/api.ts 를 통해서만 이 함수들을 쓴다.

import type {
  AdminStats,
  AdminUser,
  AdminUserRow,
  ConceptMap,
  Leg,
  LegInput,
  MapDetail,
  MapInput,
  MapRankingEntry,
  Meetup,
  MeetupFilter,
  MeetupInput,
  MeetupStatus,
  MeetupSummary,
  Pin,
  PinInput,
  Place,
  ProfileDeco,
  ProfileDecoInput,
  ProfilePage,
  PublicMapSummary,
  User,
} from '../types'
import { mockCurrentUser, mockDeleteUser, mockListUsers, mockUpdateUser, mockUserById } from '../auth/mock'

const STORAGE_KEY = 'the-map:mock-db:v1'

interface MemberRow {
  meetupId: string
  userId: string
  joinedAt: string
}
/** 지도 사용 기록 (월간 순위용): 누가 언제 이 지도를 사용했는지 */
interface UseRow {
  mapId: string
  userId: string
  usedAt: string
  kind: 'copy' | 'meetup'
}

interface Db {
  maps: ConceptMap[]
  places: Place[]
  pins: (Omit<Pin, 'place'> & { placeId: string })[]
  legs: Leg[]
  meetups: Meetup[]
  members: MemberRow[]
  uses: UseRow[]
  decos: ProfileDeco[]
  seeded?: boolean
}

function emptyDb(): Db {
  return { maps: [], places: [], pins: [], legs: [], meetups: [], members: [], uses: [], decos: [] }
}

function load(): Db {
  let db = emptyDb()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) db = { ...emptyDb(), ...(JSON.parse(raw) as Partial<Db>) }
  } catch {
    // 저장된 값이 깨졌거나 localStorage 를 못 쓰는 환경이면 빈 DB 로 시작
  }
  // 예전 '다크' 테마는 색만 남겨 네온으로 (배경 라이트/다크는 이제 보는 사람 설정)
  for (const m of db.maps) if ((m.theme as string) === 'dark') m.theme = 'neon'
  // 예전 이동수단(버스·지하철)은 대중교통으로
  for (const leg of db.legs) if ((leg.mode as string) === 'bus' || (leg.mode as string) === 'subway') leg.mode = 'transit'
  if (!db.seeded) {
    seed(db)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      // 저장 실패해도 화면은 동작
    }
  }
  return db
}

function persist(db: Db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    throw new Error('브라우저 저장 공간이 가득 찼어요. 사진을 몇 장 지우고 다시 시도해 주세요.')
  }
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const now = () => new Date().toISOString()

// 실제 네트워크처럼 아주 짧게 기다려서, 로딩 상태 처리를 미리 확인할 수 있게 한다.
const tick = () => new Promise((r) => setTimeout(r, 80))

function requireUser(): User {
  const user = mockCurrentUser()
  if (!user) throw new Error('로그인이 필요해요.')
  return user
}

function toPin(db: Db, row: Db['pins'][number]): Pin {
  const { placeId, ...rest } = row
  const place = db.places.find((p) => p.id === placeId)
  if (!place) throw new Error('핀의 장소 정보를 찾을 수 없어요.')
  return { ...rest, place }
}

function ownMapOrThrow(db: Db, mapId: string): ConceptMap {
  const map = db.maps.find((m) => m.id === mapId)
  if (!map) throw new Error('지도를 찾을 수 없어요.')
  if (map.ownerId !== requireUser().id) throw new Error('내 지도만 수정할 수 있어요.')
  return map
}

/**
 * 로그인한 사용자. 로그인 안 했으면 null.
 *
 * @example
 * const user = await getCurrentUser()
 * if (!user) navigate('/login')
 */
export async function getCurrentUser(): Promise<User | null> {
  await tick()
  return mockCurrentUser()
}

/**
 * 내 지도 목록 (최근 수정 순).
 *
 * @example
 * const maps = await getMyMaps()
 */
export async function getMyMaps(): Promise<ConceptMap[]> {
  await tick()
  const user = requireUser()
  return load()
    .maps.filter((m) => m.ownerId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * 지도 1개 + 핀(order 순) + 이동구간. 없거나 볼 권한이 없으면 null.
 *
 * @example
 * const detail = await getMap(mapId)
 * if (!detail) return <NotFound />
 * detail.map.title; detail.pins[0].place.name; detail.legs
 */
export async function getMap(mapId: string): Promise<MapDetail | null> {
  await tick()
  const db = load()
  const map = db.maps.find((m) => m.id === mapId)
  if (!map) return null
  if (!map.isPublic && map.ownerId !== mockCurrentUser()?.id) return null
  const pins = db.pins
    .filter((p) => p.mapId === mapId)
    .sort((a, b) => a.order - b.order)
    .map((p) => toPin(db, p))
  const legs = db.legs.filter((l) => l.mapId === mapId)
  return { map, pins, legs }
}

/**
 * 지도 생성(id 없음) 또는 수정(id 있음).
 *
 * @example
 * const map = await saveMap({ title: '성수 카페 투어', theme: 'pastel', isPublic: false })
 * await saveMap({ ...map, title: '새 제목' })
 */
export async function saveMap(mapData: MapInput): Promise<ConceptMap> {
  await tick()
  const db = load()
  const user = requireUser()
  if (mapData.id) {
    const map = ownMapOrThrow(db, mapData.id)
    Object.assign(map, {
      title: mapData.title,
      theme: mapData.theme,
      isPublic: mapData.isPublic,
      updatedAt: now(),
    })
    persist(db)
    return map
  }
  const map: ConceptMap = {
    id: newId(),
    ownerId: user.id,
    title: mapData.title,
    theme: mapData.theme,
    isPublic: mapData.isPublic,
    createdAt: now(),
    updatedAt: now(),
  }
  db.maps.push(map)
  persist(db)
  return map
}

/**
 * 지도 삭제. 핀과 이동구간도 같이 지워진다.
 *
 * @example
 * await deleteMap(map.id)
 */
export async function deleteMap(mapId: string): Promise<void> {
  await tick()
  const db = load()
  ownMapOrThrow(db, mapId)
  db.maps = db.maps.filter((m) => m.id !== mapId)
  db.pins = db.pins.filter((p) => p.mapId !== mapId)
  db.legs = db.legs.filter((l) => l.mapId !== mapId)
  persist(db)
}

/**
 * 핀 생성(id 없음) 또는 수정(id 있음).
 * place 는 externalId(카카오 장소 ID)로 찾고 없으면 새로 만든다.
 *
 * @example
 * const pin = await savePin(mapId, {
 *   place: { externalId: '8134820', name: '카페 어니언 성수', lat: 37.5446, lng: 127.0583 },
 *   order: 0, icon: '☕', color: '#f97316', memo: '', photoUrl: null, visitedAt: null,
 * })
 */
export async function savePin(mapId: string, pinData: PinInput): Promise<Pin> {
  await tick()
  const db = load()
  const map = ownMapOrThrow(db, mapId)

  let place = db.places.find((p) => p.externalId === pinData.place.externalId)
  if (!place) {
    place = { id: newId(), ...pinData.place }
    db.places.push(place)
  }

  const fields = {
    placeId: place.id,
    order: pinData.order,
    icon: pinData.icon,
    color: pinData.color,
    memo: pinData.memo,
    photoUrl: pinData.photoUrl,
    visitedAt: pinData.visitedAt,
  }

  let row = pinData.id ? db.pins.find((p) => p.id === pinData.id && p.mapId === mapId) : undefined
  if (row) {
    Object.assign(row, fields)
  } else {
    row = { id: newId(), mapId, ...fields }
    db.pins.push(row)
  }
  map.updatedAt = now()
  persist(db)
  return toPin(db, row)
}

/**
 * 핀 삭제. 이 핀에 연결된 이동구간도 같이 지워진다.
 *
 * @example
 * await deletePin(pin.id)
 */
export async function deletePin(pinId: string): Promise<void> {
  await tick()
  const db = load()
  const row = db.pins.find((p) => p.id === pinId)
  if (!row) return
  ownMapOrThrow(db, row.mapId)
  db.pins = db.pins.filter((p) => p.id !== pinId)
  db.legs = db.legs.filter((l) => l.fromPinId !== pinId && l.toPinId !== pinId)
  persist(db)
}

/**
 * 핀 사이 이동구간 생성/수정. 같은 (fromPinId, toPinId) 구간이 있으면 덮어쓴다.
 *
 * @example
 * await saveLeg(mapId, { fromPinId: a.id, toPinId: b.id, mode: 'transit', durationMin: 15, isManual: true })
 */
export async function saveLeg(mapId: string, legData: LegInput): Promise<Leg> {
  await tick()
  const db = load()
  ownMapOrThrow(db, mapId)
  const inMap = (id: string) => db.pins.some((p) => p.id === id && p.mapId === mapId)
  if (!inMap(legData.fromPinId) || !inMap(legData.toPinId)) {
    throw new Error('같은 지도의 핀끼리만 이을 수 있어요.')
  }

  const fields = {
    fromPinId: legData.fromPinId,
    toPinId: legData.toPinId,
    mode: legData.mode,
    durationMin: legData.durationMin,
    isManual: legData.isManual,
  }
  let leg =
    db.legs.find((l) => l.mapId === mapId && l.id === legData.id) ??
    db.legs.find((l) => l.mapId === mapId && l.fromPinId === legData.fromPinId && l.toPinId === legData.toPinId)
  if (leg) {
    Object.assign(leg, fields)
  } else {
    leg = { id: newId(), mapId, ...fields }
    db.legs.push(leg)
  }
  persist(db)
  return leg
}

/**
 * 이동구간 삭제 (핀 순서가 바뀌어 더 이상 이어지지 않는 구간 정리용).
 *
 * @example
 * await deleteLeg(leg.id)
 */
export async function deleteLeg(legId: string): Promise<void> {
  await tick()
  const db = load()
  const leg = db.legs.find((l) => l.id === legId)
  if (!leg) return
  ownMapOrThrow(db, leg.mapId)
  db.legs = db.legs.filter((l) => l.id !== legId)
  persist(db)
}

/**
 * 핀 사진 업로드 후 URL 반환.
 * mock 은 서버가 없어서, 긴 변 1024px JPEG 로 줄인 data URL 을 돌려준다 (localStorage 용량 절약).
 *
 * @example
 * const url = await uploadPinPhoto(file)
 * await savePin(mapId, { ...pinInput, photoUrl: url })
 */
export async function uploadPinPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요.')
  if (file.size > 15 * 1024 * 1024) throw new Error('사진이 너무 커요. 15MB 이하로 올려 주세요.')
  return resizeToDataUrl(file, 1024, 0.8)
}

function resizeToDataUrl(file: File, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이 사진은 열 수 없어요. JPG나 PNG로 다시 시도해 주세요.'))
    }
    img.src = url
  })
}

// ===========================================================================
// 성지순례 (모임)
// ===========================================================================

function toMeetupSummary(db: Db, m: Meetup): MeetupSummary {
  const map = db.maps.find((x) => x.id === m.mapId)
  const members = db.members
    .filter((r) => r.meetupId === m.id)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .map((r) => ({ userId: r.userId, nickname: mockUserById(r.userId).nickname, joinedAt: r.joinedAt }))
  return {
    ...m,
    host: mockUserById(m.hostId),
    members,
    map: {
      id: m.mapId,
      title: map?.title || '삭제된 지도',
      theme: map?.theme ?? 'default',
      pinCount: db.pins.filter((p) => p.mapId === m.mapId).length,
    },
  }
}

function recordUse(db: Db, mapId: string, userId: string, kind: UseRow['kind']) {
  const map = db.maps.find((m) => m.id === mapId)
  if (!map || map.ownerId === userId) return // 내 지도를 내가 쓰는 건 세지 않음
  db.uses.push({ mapId, userId, usedAt: now(), kind })
}

/**
 * 성지순례 모임 목록 (가까운 날짜 순, 취소된 모임 제외).
 * filter: 'all' 전체 · 'joined' 내가 참여한 · 'hosting' 내가 연
 *
 * @example
 * const list = await getMeetups('joined')
 */
export async function getMeetups(filter: MeetupFilter = 'all'): Promise<MeetupSummary[]> {
  await tick()
  const db = load()
  const me = mockCurrentUser()
  if (filter !== 'all' && !me) return []
  return db.meetups
    .filter((m) => m.status !== 'canceled' || m.hostId === me?.id)
    .filter((m) => {
      if (filter === 'hosting') return m.hostId === me!.id
      if (filter === 'joined') return db.members.some((r) => r.meetupId === m.id && r.userId === me!.id)
      return true
    })
    .map((m) => toMeetupSummary(db, m))
    .sort((a, b) => a.meetAt.localeCompare(b.meetAt))
}

/**
 * 모임 1개 + 순례할 지도. 없으면 null.
 *
 * @example
 * const res = await getMeetup(id)
 * res?.meetup.members; res?.mapDetail.pins
 */
export async function getMeetup(meetupId: string): Promise<{ meetup: MeetupSummary; mapDetail: MapDetail | null } | null> {
  await tick()
  const db = load()
  const m = db.meetups.find((x) => x.id === meetupId)
  if (!m) return null
  const map = db.maps.find((x) => x.id === m.mapId)
  // 모임 지도는 비공개여도 모임 화면에서는 보여준다
  const mapDetail: MapDetail | null = map
    ? {
        map,
        pins: db.pins.filter((p) => p.mapId === map.id).sort((a, b) => a.order - b.order).map((p) => toPin(db, p)),
        legs: db.legs.filter((l) => l.mapId === map.id),
      }
    : null
  return { meetup: toMeetupSummary(db, m), mapDetail }
}

/**
 * 모임 만들기(id 없음) / 고치기(id 있음, 주최자만). 주최자는 자동으로 참여자가 된다.
 * 내 지도뿐 아니라 남의 공개 지도로도 모임을 열 수 있다 (그 지도의 '사용'으로 기록).
 *
 * @example
 * const m = await saveMeetup({ mapId, title: '성수 빵지순례', description: '', meetAt: '2026-11-01T11:00',
 *   meetPoint: '성수역 3번 출구', capacity: 6 })
 */
export async function saveMeetup(input: MeetupInput): Promise<MeetupSummary> {
  await tick()
  const db = load()
  const me = requireUser()
  const title = input.title.trim()
  if (!title) throw new Error('모임 이름을 입력해 주세요.')
  if (!input.meetAt || Number.isNaN(Date.parse(input.meetAt))) throw new Error('모이는 날짜와 시간을 정해 주세요.')
  if (Date.parse(input.meetAt) < Date.now()) throw new Error('지난 시간으로는 모임을 만들 수 없어요.')
  if (!input.meetPoint.trim()) throw new Error('모이는 곳을 입력해 주세요.')
  const capacity = Math.round(input.capacity)
  if (!(capacity >= 2 && capacity <= 50)) throw new Error('정원은 2명에서 50명 사이로 정해 주세요.')
  const map = db.maps.find((x) => x.id === input.mapId)
  if (!map || (!map.isPublic && map.ownerId !== me.id)) throw new Error('이 지도로는 모임을 열 수 없어요.')

  const fields = {
    mapId: input.mapId,
    title,
    description: input.description.trim(),
    meetAt: new Date(input.meetAt).toISOString(),
    meetPoint: input.meetPoint.trim(),
    capacity,
  }
  let meetup: Meetup
  if (input.id) {
    const found = db.meetups.find((x) => x.id === input.id)
    if (!found) throw new Error('모임을 찾을 수 없어요.')
    if (found.hostId !== me.id) throw new Error('주최자만 고칠 수 있어요.')
    const count = db.members.filter((r) => r.meetupId === found.id).length
    if (capacity < count) throw new Error(`이미 ${count}명이 참여했어요. 정원을 ${count}명 이상으로 정해 주세요.`)
    Object.assign(found, fields)
    meetup = found
  } else {
    meetup = { id: newId(), hostId: me.id, status: 'open', createdAt: now(), ...fields }
    db.meetups.push(meetup)
    db.members.push({ meetupId: meetup.id, userId: me.id, joinedAt: now() })
    recordUse(db, map.id, me.id, 'meetup')
  }
  persist(db)
  return toMeetupSummary(db, meetup)
}

/**
 * 모임 참여. 모집 중이고 자리가 있어야 한다.
 *
 * @example
 * await joinMeetup(id) // 실패 시 '정원이 다 찼어요.' 등
 */
export async function joinMeetup(meetupId: string): Promise<MeetupSummary> {
  await tick()
  const db = load()
  const me = requireUser()
  const m = db.meetups.find((x) => x.id === meetupId)
  if (!m) throw new Error('모임을 찾을 수 없어요.')
  if (m.status === 'canceled') throw new Error('취소된 모임이에요.')
  if (m.status === 'closed' || Date.parse(m.meetAt) < Date.now()) throw new Error('모집이 끝난 모임이에요.')
  const members = db.members.filter((r) => r.meetupId === m.id)
  if (members.some((r) => r.userId === me.id)) throw new Error('이미 참여한 모임이에요.')
  if (members.length >= m.capacity) throw new Error('정원이 다 찼어요.')
  db.members.push({ meetupId: m.id, userId: me.id, joinedAt: now() })
  recordUse(db, m.mapId, me.id, 'meetup')
  persist(db)
  return toMeetupSummary(db, m)
}

/**
 * 참여 취소. 주최자는 나갈 수 없다 (모임 취소를 쓴다).
 *
 * @example
 * await leaveMeetup(id)
 */
export async function leaveMeetup(meetupId: string): Promise<MeetupSummary> {
  await tick()
  const db = load()
  const me = requireUser()
  const m = db.meetups.find((x) => x.id === meetupId)
  if (!m) throw new Error('모임을 찾을 수 없어요.')
  if (m.hostId === me.id) throw new Error('주최자는 나갈 수 없어요. 모임을 취소해 주세요.')
  db.members = db.members.filter((r) => !(r.meetupId === m.id && r.userId === me.id))
  persist(db)
  return toMeetupSummary(db, m)
}

/**
 * 모집 상태 바꾸기 (주최자만): 'open' 모집 중 · 'closed' 모집 마감 · 'canceled' 모임 취소
 *
 * @example
 * await setMeetupStatus(id, 'closed')
 */
export async function setMeetupStatus(meetupId: string, status: MeetupStatus): Promise<MeetupSummary> {
  await tick()
  const db = load()
  const me = requireUser()
  const m = db.meetups.find((x) => x.id === meetupId)
  if (!m) throw new Error('모임을 찾을 수 없어요.')
  if (m.hostId !== me.id && me.role !== 'admin') throw new Error('주최자만 바꿀 수 있어요.')
  m.status = status
  persist(db)
  return toMeetupSummary(db, m)
}

// ===========================================================================
// 공개 지도 · 가져오기 · 월간 순위
// ===========================================================================

function toPublicSummary(db: Db, map: ConceptMap): PublicMapSummary {
  return { map, owner: mockUserById(map.ownerId), pinCount: db.pins.filter((p) => p.mapId === map.id).length }
}

/**
 * 지도 주인 정보 (읽기 전용 화면에서 "누구의 지도" 표시용)
 *
 * @example
 * const owner = await getUser(map.ownerId)
 */
export async function getUser(userId: string): Promise<User> {
  await tick()
  return mockUserById(userId)
}

// ===========================================================================
// 프로필 꾸미기
// ===========================================================================

const PAPERS = ['plain', 'lined', 'grid', 'dot', 'kraft', 'cream']
const FONTS = ['basic', 'hand', 'round', 'serif', 'pen']

function defaultDeco(userId: string): ProfileDeco {
  return {
    userId,
    paper: 'plain',
    color: '#ffffff',
    font: 'basic',
    bio: '',
    mood: '',
    stickers: [],
    pinnedMapIds: [],
    mapStyle: 'polaroid',
    sections: { intro: true, stickers: true, maps: true },
    updatedAt: now(),
  }
}

/**
 * 공개 프로필: 꾸미기 + 공개 지도 (대표로 고른 지도가 고른 순서대로 먼저). 꾸민 적 없으면 기본값.
 *
 * @example
 * const { user, deco, maps } = await getProfile(userId)
 */
export async function getProfile(userId: string): Promise<ProfilePage> {
  await tick()
  const db = load()
  const deco = db.decos.find((d) => d.userId === userId) ?? defaultDeco(userId)
  const publicMaps = db.maps.filter((m) => m.ownerId === userId && m.isPublic)
  const pinned = deco.pinnedMapIds.map((id) => publicMaps.find((m) => m.id === id)).filter((m): m is ConceptMap => !!m)
  const rest = publicMaps.filter((m) => !deco.pinnedMapIds.includes(m.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  // 비공개로 바꾼 지도는 대표 지도에서 빠진다
  const visible = { ...deco, pinnedMapIds: pinned.map((m) => m.id) }
  return { user: mockUserById(userId), deco: visible, maps: [...pinned, ...rest].map((m) => toPublicSummary(db, m)) }
}

/**
 * 내 프로필 꾸미기 저장. 범위를 벗어난 값은 잘라서 저장한다 (DB 제약과 같게).
 *
 * @example
 * await saveProfileDeco({ ...deco, paper: 'lined', stickers: [...deco.stickers, sticker] })
 */
export async function saveProfileDeco(input: ProfileDecoInput): Promise<ProfileDeco> {
  await tick()
  const db = load()
  const me = requireUser()
  const isColor = /^#[0-9a-fA-F]{6}$/.test(input.color)
  const myPublic = new Set(db.maps.filter((m) => m.ownerId === me.id && m.isPublic).map((m) => m.id))
  const deco: ProfileDeco = {
    userId: me.id,
    paper: PAPERS.includes(input.paper) ? input.paper : 'plain',
    color: isColor ? input.color : '#ffffff',
    font: FONTS.includes(input.font) ? input.font : 'basic',
    bio: input.bio.trim().slice(0, 150),
    mood: input.mood.trim().slice(0, 40),
    stickers: input.stickers.slice(0, 30).map((s) => ({
      ...s,
      x: Math.min(100, Math.max(0, s.x)),
      y: Math.min(100, Math.max(0, s.y)),
      size: Math.min(160, Math.max(20, Math.round(s.size))),
      rotate: Math.round(s.rotate) % 360,
    })),
    pinnedMapIds: input.pinnedMapIds.filter((id) => myPublic.has(id)).slice(0, 6),
    mapStyle: input.mapStyle === 'tape' ? 'tape' : 'polaroid',
    sections: { intro: !!input.sections.intro, stickers: !!input.sections.stickers, maps: !!input.sections.maps },
    updatedAt: now(),
  }
  db.decos = [...db.decos.filter((d) => d.userId !== me.id), deco]
  persist(db)
  return deco
}

/**
 * 남의 공개 지도를 내 지도로 복사 ('사용'으로 기록되어 순위에 반영). 새 지도를 돌려준다.
 *
 * @example
 * const mine = await copyMap(publicMapId); router.push(`/maps/${mine.id}`)
 */
export async function copyMap(mapId: string): Promise<ConceptMap> {
  await tick()
  const db = load()
  const me = requireUser()
  const src = db.maps.find((m) => m.id === mapId)
  if (!src || (!src.isPublic && src.ownerId !== me.id)) throw new Error('가져올 수 없는 지도예요.')
  const copy: ConceptMap = {
    id: newId(),
    ownerId: me.id,
    title: src.ownerId === me.id ? `${src.title} (복사본)` : src.title,
    theme: src.theme,
    isPublic: false,
    createdAt: now(),
    updatedAt: now(),
  }
  db.maps.push(copy)
  const idMap = new Map<string, string>()
  for (const p of db.pins.filter((x) => x.mapId === src.id)) {
    const id = newId()
    idMap.set(p.id, id)
    db.pins.push({ ...p, id, mapId: copy.id })
  }
  for (const l of db.legs.filter((x) => x.mapId === src.id)) {
    const from = idMap.get(l.fromPinId)
    const to = idMap.get(l.toPinId)
    if (from && to) db.legs.push({ ...l, id: newId(), mapId: copy.id, fromPinId: from, toPinId: to })
  }
  recordUse(db, src.id, me.id, 'copy')
  persist(db)
  return copy
}

/**
 * 월간 지도 순위: 그 달에 공개 지도를 '사용'한 사람 수(주인 제외, 한 사람은 한 번) 순.
 * 사용 = 내 지도로 가져오기 / 그 지도로 열린 성지순례 참여·개설.
 * month: 'YYYY-MM' (기본 이번 달)
 *
 * @example
 * const top = await getMonthlyRanking('2026-10') // [{ rank: 1, users: 12, map, owner, pinCount }, …]
 */
export async function getMonthlyRanking(month?: string, limit = 30): Promise<MapRankingEntry[]> {
  await tick()
  const db = load()
  const ym = month ?? new Date().toISOString().slice(0, 7)
  const usersByMap = new Map<string, Set<string>>()
  for (const u of db.uses) {
    if (!sameMonth(u.usedAt, ym)) continue
    const set = usersByMap.get(u.mapId) ?? new Set<string>()
    set.add(u.userId)
    usersByMap.set(u.mapId, set)
  }
  const rows = [...usersByMap.entries()]
    .map(([mapId, set]) => ({ map: db.maps.find((m) => m.id === mapId), users: set.size }))
    .filter((r): r is { map: ConceptMap; users: number } => !!r.map && r.map.isPublic && r.users > 0)
    .sort((a, b) => b.users - a.users || a.map.title.localeCompare(b.map.title))
    .slice(0, limit)
  // 사용자 수가 같으면 같은 순위
  let rank = 0
  return rows.map((r, i) => {
    if (i === 0 || r.users !== rows[i - 1].users) rank = i + 1
    return { ...toPublicSummary(db, r.map), rank, users: r.users }
  })
}

/** 로컬 시간 기준 'YYYY-MM' 비교 */
function sameMonth(iso: string, ym: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === ym
}

// ===========================================================================
// 샘플 데이터 (처음 한 번): 다른 사용자들의 공개 지도 · 모임 · 사용 기록
// ===========================================================================

function seed(db: Db) {
  db.seeded = true
  const day = 864e5
  const at = (days: number, hour = 12) => {
    const d = new Date(Date.now() + days * day)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const place = (externalId: string, name: string, lat: number, lng: number): Place => {
    let p = db.places.find((x) => x.externalId === externalId)
    if (!p) {
      p = { id: newId(), externalId, name, lat, lng }
      db.places.push(p)
    }
    return p
  }
  const makeMap = (
    ownerId: string,
    title: string,
    theme: ConceptMap['theme'],
    stops: { place: Place; icon: string; color: string; memo?: string }[],
    modes: Leg['mode'][],
  ) => {
    const map: ConceptMap = { id: newId(), ownerId, title, theme, isPublic: true, createdAt: at(-30), updatedAt: at(-2) }
    db.maps.push(map)
    const ids = stops.map((s, i) => {
      const id = newId()
      db.pins.push({ id, mapId: map.id, placeId: s.place.id, order: i, icon: s.icon, color: s.color, memo: s.memo ?? '', photoUrl: null, visitedAt: null })
      return id
    })
    ids.slice(1).forEach((to, i) =>
      db.legs.push({ id: newId(), mapId: map.id, fromPinId: ids[i], toPinId: to, mode: modes[i] ?? 'walk', durationMin: 10 + i * 5, isManual: true }),
    )
    return map
  }

  const seongsuBakery = place('sample-16', '성수 베이커리 카페', 37.542, 127.056)
  const seongsuCafe = place('sample-1', '성수 카페거리', 37.5446, 127.0559)
  const seoulForest = place('sample-2', '서울숲', 37.5444, 127.0374)
  const gyeongbok = place('sample-6', '경복궁', 37.5796, 126.977)
  const bukchon = place('sample-7', '북촌 한옥마을', 37.5826, 126.9831)
  const ikseon = place('sample-5', '익선동 한옥거리', 37.5741, 126.9895)
  const hannam = place('sample-12', '한남동 카페 골목', 37.5378, 127.001)
  const itaewon = place('sample-9', '이태원 베이커리 골목', 37.5345, 126.9946)
  const mangwon = place('sample-4', '망원시장', 37.556, 126.906)
  const yeonnam = place('sample-3', '연남동 경의선숲길', 37.56, 126.923)

  const bread = makeMap('u-bread', '성수 빵지순례 🥐', 'pastel', [
    { place: seongsuBakery, icon: '🍞', color: '#f9a8d4', memo: '소금빵 필수' },
    { place: seongsuCafe, icon: '☕', color: '#a5b4fc' },
    { place: seoulForest, icon: '🌳', color: '#86efac', memo: '빵 들고 피크닉' },
  ], ['walk', 'walk'])
  const drama = makeMap('u-drama', '도깨비 촬영지 투어', 'vintage', [
    { place: gyeongbok, icon: '🏛️', color: '#b45309' },
    { place: bukchon, icon: '🎬', color: '#7c2d12', memo: '2화 그 골목' },
    { place: ikseon, icon: '📸', color: '#4d7c0f' },
  ], ['walk', 'transit'])
  const cafe = makeMap('u-cafe', '한남·이태원 카페 산책', 'default', [
    { place: hannam, icon: '☕', color: '#f97316' },
    { place: itaewon, icon: '🍰', color: '#ef4444' },
  ], ['walk'])
  const mangwonMap = makeMap('u-cafe', '망원·연남 먹방 코스', 'neon', [
    { place: mangwon, icon: '🍜', color: '#facc15' },
    { place: yeonnam, icon: '🍺', color: '#22d3ee' },
  ], ['walk'])

  const meetup = (mapId: string, hostId: string, title: string, description: string, meetAt: string, meetPoint: string, capacity: number, memberIds: string[], status: MeetupStatus = 'open') => {
    const m: Meetup = { id: newId(), mapId, hostId, title, description, meetAt, meetPoint, capacity, status, createdAt: at(-5) }
    db.meetups.push(m)
    ;[hostId, ...memberIds].forEach((userId, i) => db.members.push({ meetupId: m.id, userId, joinedAt: at(-5 + i * 0.3) }))
  }
  meetup(bread.id, 'u-bread', '성수 빵지순례 같이 돌아요 🥐', '오픈런부터 서울숲 피크닉까지! 빵 좋아하시는 분 누구나 환영해요. 각자 먹고 싶은 빵 하나씩 사서 나눠 먹어요 🥐', at(3, 11), '성수역 3번 출구', 6, ['u-drama', 'u-cafe'])
  meetup(drama.id, 'u-drama', '도깨비 촬영지 정주행 투어', '경복궁에서 시작해서 북촌, 익선동까지 걸어요. 드라마 장면 사진 들고 오시면 똑같이 찍어 드려요 📸', at(8, 14), '경복궁역 5번 출구', 4, ['u-bread', 'u-cafe'])
  meetup(cafe.id, 'u-cafe', '한남동 카페 3곳 도장깨기', '커피 3잔 각오하고 오세요. 디카페인도 있어요!', at(1, 15), '한강진역 1번 출구', 3, ['u-bread', 'u-drama'], 'closed')
  meetup(mangwonMap.id, 'u-cafe', '망원시장 먹방 번개', '시장 한 바퀴 돌고 연남동에서 마무리', at(12, 18), '망원역 2번 출구', 8, [])

  // 사용 기록: 이번 달과 지난 달 (가상 사용자 포함)
  const thisMonth = (d: number) => {
    const t = new Date()
    t.setDate(Math.max(1, Math.min(t.getDate(), 1 + d)))
    return t.toISOString()
  }
  const lastMonth = (d: number) => {
    const t = new Date()
    t.setDate(1)
    t.setMonth(t.getMonth() - 1)
    t.setDate(1 + d)
    return t.toISOString()
  }
  const addUses = (mapId: string, count: number, when: (i: number) => string) => {
    for (let i = 0; i < count; i++) db.uses.push({ mapId, userId: `u-guest-${i}`, usedAt: when(i % 20), kind: i % 3 === 0 ? 'meetup' : 'copy' })
  }
  addUses(bread.id, 14, thisMonth)
  addUses(drama.id, 9, thisMonth)
  addUses(cafe.id, 9, thisMonth)
  addUses(mangwonMap.id, 4, thisMonth)
  addUses(drama.id, 17, lastMonth)
  addUses(bread.id, 11, lastMonth)
  addUses(cafe.id, 6, lastMonth)
}

// ===========================================================================
// 관리자 (role === 'admin' 만)
// ===========================================================================

/**
 * 관리자 대시보드 숫자.
 *
 * @example
 * const stats = await adminGetStats() // { users: 5, maps: 12, … }
 */
export async function adminGetStats(): Promise<AdminStats> {
  await tick()
  const users = mockListUsers() // 관리자 아니면 여기서 에러
  const db = load()
  const ym = new Date().toISOString().slice(0, 7)
  return {
    users: users.length,
    suspended: users.filter((u) => u.suspended).length,
    maps: db.maps.length,
    publicMaps: db.maps.filter((m) => m.isPublic).length,
    meetupsOpen: db.meetups.filter((m) => m.status === 'open' && Date.parse(m.meetAt) >= Date.now()).length,
    usesThisMonth: db.uses.filter((u) => sameMonth(u.usedAt, ym)).length,
  }
}

/**
 * 회원 목록 + 활동 수 (가입 최신순).
 *
 * @example
 * const users = await adminListUsers()
 */
export async function adminListUsers(): Promise<AdminUser[]> {
  await tick()
  const rows = mockListUsers()
  const db = load()
  return rows.map((u) => ({
    ...u,
    mapCount: db.maps.filter((m) => m.ownerId === u.id).length,
    meetupCount: db.meetups.filter((m) => m.hostId === u.id).length,
  }))
}

/**
 * 회원 정보 수정: 닉네임 · 권한(role) · 정지(suspended).
 *
 * @example
 * await adminUpdateUser(id, { suspended: true })
 * await adminUpdateUser(id, { role: 'admin' })
 */
export async function adminUpdateUser(userId: string, patch: Partial<Pick<AdminUserRow, 'nickname' | 'role' | 'suspended'>>): Promise<AdminUserRow> {
  await tick()
  return mockUpdateUser(userId, patch)
}

/**
 * 회원 탈퇴 처리: 계정 + 그 사람의 지도·핀·구간·연 모임·참여 기록을 모두 지운다.
 *
 * @example
 * await adminDeleteUser(id)
 */
export async function adminDeleteUser(userId: string): Promise<void> {
  await tick()
  mockDeleteUser(userId) // 권한 확인 포함
  const db = load()
  const mapIds = new Set(db.maps.filter((m) => m.ownerId === userId).map((m) => m.id))
  const meetupIds = new Set(db.meetups.filter((m) => m.hostId === userId || mapIds.has(m.mapId)).map((m) => m.id))
  db.maps = db.maps.filter((m) => !mapIds.has(m.id))
  db.pins = db.pins.filter((p) => !mapIds.has(p.mapId))
  db.legs = db.legs.filter((l) => !mapIds.has(l.mapId))
  db.meetups = db.meetups.filter((m) => !meetupIds.has(m.id))
  db.members = db.members.filter((r) => r.userId !== userId && !meetupIds.has(r.meetupId))
  db.uses = db.uses.filter((u) => u.userId !== userId && !mapIds.has(u.mapId))
  db.decos = db.decos.filter((d) => d.userId !== userId)
  persist(db)
}
