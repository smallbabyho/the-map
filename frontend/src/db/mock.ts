// 백엔드가 붙기 전까지 쓰는 가짜 데이터 함수 (localStorage 저장).
// 진짜 Supabase 버전(src/db/index.ts)은 이 파일과 함수 이름·입력·반환 형태가 완전히 같아야 한다.
// 화면 코드는 반드시 src/db/api.ts 를 통해서만 이 함수들을 쓴다.

import type {
  ConceptMap,
  Leg,
  LegInput,
  MapDetail,
  MapInput,
  Pin,
  PinInput,
  Place,
  User,
} from '../types'
import { mockCurrentUser } from '../auth/mock'

const STORAGE_KEY = 'the-map:mock-db:v1'

interface Db {
  maps: ConceptMap[]
  places: Place[]
  pins: (Omit<Pin, 'place'> & { placeId: string })[]
  legs: Leg[]
}

function emptyDb(): Db {
  return { maps: [], places: [], pins: [], legs: [] }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw) as Partial<Db>
    return { ...emptyDb(), ...parsed }
  } catch {
    // 저장된 값이 깨졌거나 localStorage 를 못 쓰는 환경이면 빈 DB 로 시작
    return emptyDb()
  }
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
 * await saveLeg(mapId, { fromPinId: a.id, toPinId: b.id, mode: 'subway', durationMin: 15, isManual: true })
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
