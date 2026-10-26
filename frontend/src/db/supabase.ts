// 진짜 데이터 함수 (Supabase). mock.ts 와 함수 이름 · 입력 · 반환 형태가 완전히 같다 (api.ts 가 타입으로 확인).
// DB 는 snake_case, 화면은 camelCase. 변환은 이 파일 안에서만 한다.
// 권한은 DB 의 RLS · 함수가 막는다 (backend/supabase/migrations). 여기서 하는 확인은 친절한 에러 메시지용.

import { fetchMe, notifyProfileChanged } from '../auth/supabase'
import { BANNED_WORD_MESSAGE, hasBannedWord } from '../lib/bannedWords'
import { supabase } from '../lib/supabase'
import type {
  AdminStats,
  AdminUser,
  AdminUserRow,
  ConceptMap,
  ExploreMapEntry,
  ExploreSort,
  Leg,
  LegInput,
  MapCategory,
  MapCollab,
  MapDetail,
  MapInput,
  MapInvitePreview,
  MapRankingEntry,
  Meetup,
  MeetupCheckin,
  MeetupComment,
  MeetupCommentInput,
  MeetupFilter,
  MeetupInput,
  MeetupStatus,
  MeetupSummary,
  Pin,
  PinInput,
  PlaceDetail,
  PlaceReview,
  PlaceReviewInput,
  PlaceStats,
  ProfileDeco,
  ProfileDecoInput,
  ProfilePage,
  PublicMapSummary,
  Report,
  ReportInput,
  ReportStatus,
  User,
  UserRole,
} from '../types'

// ===========================================================================
// 공용: 에러 · 행 변환
// ===========================================================================

/** Supabase 에러 → 한국어. DB 함수가 던진 메시지는 이미 한국어라 그대로 */
function fail(error: { message: string; code?: string } | null, fallback = '잠시 후 다시 시도해 주세요.'): never {
  const msg = error?.message ?? fallback
  if (/row-level security|permission denied|42501/i.test(msg) || error?.code === '42501') {
    // 우리 함수가 42501 로 던진 한국어 메시지는 살린다
    if (/[가-힣]/.test(msg)) throw new Error(msg)
    throw new Error('권한이 없어요. 로그인 상태를 확인해 주세요.')
  }
  if (/JWT|session/i.test(msg)) throw new Error('로그인이 필요해요.')
  throw new Error(msg)
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
async function requireMe(): Promise<string> {
  const id = await myId()
  if (!id) throw new Error('로그인이 필요해요.')
  return id
}

const PROFILE_COLS = 'id, nickname, role, avatar_url'
interface ProfileRow {
  id: string
  nickname: string
  role: UserRole
  avatar_url: string | null
}
const toUser = (p: ProfileRow | null | undefined, id = ''): User => (p ? { id: p.id, nickname: p.nickname, role: p.role, avatarUrl: p.avatar_url } : { id, nickname: '알 수 없음' })

const MAP_COLS = 'id, owner_id, title, theme, is_public, category, marker_shape, line_style, line_width, cover_url, created_at, updated_at'
interface MapRow {
  id: string
  owner_id: string
  title: string
  theme: ConceptMap['theme']
  is_public: boolean
  category: ConceptMap['category']
  marker_shape: ConceptMap['markerShape']
  line_style: ConceptMap['lineStyle']
  line_width: ConceptMap['lineWidth']
  cover_url: string | null
  created_at: string
  updated_at: string
}
const toMap = (r: MapRow): ConceptMap => ({
  id: r.id,
  ownerId: r.owner_id,
  title: r.title,
  theme: r.theme,
  isPublic: r.is_public,
  category: r.category,
  markerShape: r.marker_shape,
  lineStyle: r.line_style,
  lineWidth: r.line_width,
  coverUrl: r.cover_url,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const PIN_COLS = 'id, map_id, sort_order, icon, color, memo, photo_url, visited_at, place:places(id, external_id, name, lat, lng)'
interface PinRow {
  id: string
  map_id: string
  sort_order: number
  icon: string | null
  color: string | null
  memo: string | null
  photo_url: string | null
  visited_at: string | null
  place: { id: string; external_id: string; name: string; lat: number; lng: number }
}
const toPin = (r: PinRow): Pin => ({
  id: r.id,
  mapId: r.map_id,
  order: r.sort_order,
  icon: r.icon ?? '📍',
  color: r.color ?? '#f97316',
  memo: r.memo ?? '',
  photoUrl: r.photo_url,
  visitedAt: r.visited_at,
  place: { id: r.place.id, externalId: r.place.external_id, name: r.place.name, lat: r.place.lat, lng: r.place.lng },
})

const LEG_COLS = 'id, map_id, from_pin_id, to_pin_id, mode, duration_min, is_manual'
interface LegRow {
  id: string
  map_id: string
  from_pin_id: string
  to_pin_id: string
  mode: Leg['mode']
  duration_min: number | null
  is_manual: boolean
}
const toLeg = (r: LegRow): Leg => ({ id: r.id, mapId: r.map_id, fromPinId: r.from_pin_id, toPinId: r.to_pin_id, mode: r.mode, durationMin: r.duration_min, isManual: r.is_manual })

/** 초대 코드: 헷갈리는 글자(0 o 1 l i)를 뺀 8자리 */
function newInviteCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => chars[b % chars.length]).join('')
}

/** 여러 사람 프로필을 한 번에 (id → User) */
async function usersById(ids: string[]): Promise<Map<string, User>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return new Map()
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).in('id', uniq)
  if (error) fail(error)
  return new Map((data as ProfileRow[]).map((p) => [p.id, toUser(p)]))
}

/** 내가 차단한 사람 id */
async function blockedIds(): Promise<Set<string>> {
  if (!(await myId())) return new Set()
  const { data } = await supabase.from('blocks').select('blocked_id')
  return new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id))
}

// ===========================================================================
// 사람 · 지도
// ===========================================================================

export async function getCurrentUser(): Promise<User | null> {
  return fetchMe()
}

export async function getUser(userId: string): Promise<User> {
  const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle<ProfileRow>()
  return toUser(data, userId)
}

export async function getMyMaps(): Promise<ConceptMap[]> {
  const me = await requireMe()
  // 내가 주인인 지도 + 함께 꾸미는 지도
  const { data: shared } = await supabase.from('map_members').select('map_id').eq('user_id', me)
  const ids = (shared ?? []).map((r: { map_id: string }) => r.map_id)
  const filter = ids.length ? `owner_id.eq.${me},id.in.(${ids.join(',')})` : `owner_id.eq.${me}`
  const { data, error } = await supabase.from('maps').select(MAP_COLS).or(filter).order('updated_at', { ascending: false })
  if (error) fail(error)
  return (data as MapRow[]).map(toMap)
}

export async function getMap(mapId: string): Promise<MapDetail | null> {
  const { data: m, error } = await supabase.from('maps').select(MAP_COLS).eq('id', mapId).maybeSingle<MapRow>()
  if (error) fail(error)
  if (!m) return null
  const [pins, legs] = await Promise.all([
    supabase.from('pins').select(PIN_COLS).eq('map_id', mapId).order('sort_order'),
    supabase.from('legs').select(LEG_COLS).eq('map_id', mapId),
  ])
  if (pins.error) fail(pins.error)
  if (legs.error) fail(legs.error)
  return { map: toMap(m), pins: (pins.data as unknown as PinRow[]).map(toPin), legs: (legs.data as LegRow[]).map(toLeg) }
}

export async function saveMap(mapData: MapInput): Promise<ConceptMap> {
  const me = await requireMe()
  const look = {
    ...(mapData.category && { category: mapData.category }),
    ...(mapData.markerShape && { marker_shape: mapData.markerShape }),
    ...(mapData.lineStyle && { line_style: mapData.lineStyle }),
    ...(mapData.lineWidth && { line_width: mapData.lineWidth }),
    ...(mapData.coverUrl !== undefined && { cover_url: mapData.coverUrl }),
  }
  if (mapData.id) {
    // 공개 여부는 주인만 바꾼다 (편집자가 보내면 DB 트리거가 막으므로 아예 안 보냄)
    const { data: cur } = await supabase.from('maps').select('owner_id').eq('id', mapData.id).maybeSingle<{ owner_id: string }>()
    if (!cur) throw new Error('지도를 찾을 수 없어요.')
    const patch = { title: mapData.title, theme: mapData.theme, ...look, ...(cur.owner_id === me && { is_public: mapData.isPublic }) }
    const { data, error } = await supabase.from('maps').update(patch).eq('id', mapData.id).select(MAP_COLS).single<MapRow>()
    if (error) fail(error)
    return toMap(data)
  }
  const { data, error } = await supabase
    .from('maps')
    .insert({ title: mapData.title, theme: mapData.theme, is_public: mapData.isPublic, ...look })
    .select(MAP_COLS)
    .single<MapRow>()
  if (error) fail(error)
  return toMap(data)
}

export async function deleteMap(mapId: string): Promise<void> {
  const { data, error } = await supabase.from('maps').delete().eq('id', mapId).select('id')
  if (error) fail(error)
  if (!data?.length) throw new Error('지도 주인만 삭제할 수 있어요.')
}

export async function savePin(mapId: string, pinData: PinInput): Promise<Pin> {
  await requireMe()
  const { data: placeId, error: pe } = await supabase.rpc('get_or_create_place', {
    p_external_id: pinData.place.externalId,
    p_name: pinData.place.name,
    p_lat: pinData.place.lat,
    p_lng: pinData.place.lng,
  })
  if (pe) fail(pe)
  const row = {
    map_id: mapId,
    place_id: placeId as string,
    sort_order: pinData.order,
    icon: pinData.icon,
    color: pinData.color,
    memo: pinData.memo,
    photo_url: pinData.photoUrl,
    visited_at: pinData.visitedAt,
  }
  const q = pinData.id ? supabase.from('pins').update(row).eq('id', pinData.id) : supabase.from('pins').insert(row)
  const { data, error } = await q.select(PIN_COLS).single()
  if (error) fail(error)
  return toPin(data as unknown as PinRow)
}

export async function deletePin(pinId: string): Promise<void> {
  const { error } = await supabase.from('pins').delete().eq('id', pinId)
  if (error) fail(error)
}

export async function saveLeg(mapId: string, legData: LegInput): Promise<Leg> {
  const { data, error } = await supabase
    .from('legs')
    .upsert(
      { map_id: mapId, from_pin_id: legData.fromPinId, to_pin_id: legData.toPinId, mode: legData.mode, duration_min: legData.durationMin, is_manual: legData.isManual },
      { onConflict: 'map_id,from_pin_id,to_pin_id' },
    )
    .select(LEG_COLS)
    .single<LegRow>()
  if (error) fail(error)
  return toLeg(data)
}

export async function deleteLeg(legId: string): Promise<void> {
  const { error } = await supabase.from('legs').delete().eq('id', legId)
  if (error) fail(error)
}

// ===========================================================================
// 사진 (pin-photos · avatars 버킷, 본인 폴더 {user_id}/...)
// ===========================================================================

function resizeToBlob(file: File, maxSide: number, quality: number): Promise<Blob> {
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 줄이지 못했어요.'))), 'image/jpeg', quality)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이 사진은 열 수 없어요. JPG나 PNG로 다시 시도해 주세요.'))
    }
    img.src = url
  })
}

async function uploadTo(bucket: 'pin-photos' | 'avatars', file: File, maxSide: number, quality: number): Promise<string> {
  const me = await requireMe()
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요.')
  if (file.size > 15 * 1024 * 1024) throw new Error('사진이 너무 커요. 15MB 이하로 올려 주세요.')
  const blob = await resizeToBlob(file, maxSide, quality)
  const path = `${me}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) fail(error, '사진을 올리지 못했어요.')
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function uploadPinPhoto(file: File): Promise<string> {
  return uploadTo('pin-photos', file, 1024, 0.8)
}

export async function uploadAvatar(file: File): Promise<string> {
  return uploadTo('avatars', file, 400, 0.85)
}

export async function updateMyProfile(patch: { nickname?: string; avatarUrl?: string | null }): Promise<User> {
  const me = await requireMe()
  const row: Record<string, unknown> = {}
  if (patch.nickname !== undefined) {
    const nick = patch.nickname.trim()
    if (!nick) throw new Error('닉네임을 입력해 주세요.')
    row.nickname = nick.slice(0, 30)
  }
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl
  const { data, error } = await supabase.from('profiles').update(row).eq('id', me).select(PROFILE_COLS).single<ProfileRow>()
  if (error) fail(error)
  await notifyProfileChanged()
  return toUser(data)
}

// ===========================================================================
// 함께 꾸미기
// ===========================================================================

export async function getMapCollab(mapId: string): Promise<MapCollab> {
  const me = await myId()
  const { data: m } = await supabase.from('maps').select('owner_id').eq('id', mapId).maybeSingle<{ owner_id: string }>()
  if (!m) throw new Error('지도를 찾을 수 없어요.')
  const [{ data: members }, { data: invite }] = await Promise.all([
    supabase.from('map_members').select('user_id, joined_at, profile:profiles(' + PROFILE_COLS + ')').eq('map_id', mapId),
    supabase.from('map_invites').select('code').eq('map_id', mapId).maybeSingle<{ code: string }>(),
  ])
  const rows = (members ?? []) as unknown as { user_id: string; joined_at: string; profile: ProfileRow | null }[]
  const myRole = m.owner_id === me ? 'owner' : rows.some((r) => r.user_id === me) ? 'editor' : 'viewer'
  return {
    owner: await getUser(m.owner_id),
    editors: rows.map((r) => ({ ...toUser(r.profile, r.user_id), joinedAt: r.joined_at })),
    inviteCode: myRole === 'viewer' ? null : (invite?.code ?? null),
    myRole,
  }
}

export async function createMapInvite(mapId: string, reset = false): Promise<string> {
  await requireMe()
  const { data: cur } = await supabase.from('map_invites').select('code').eq('map_id', mapId).maybeSingle<{ code: string }>()
  if (cur && !reset) return cur.code
  const code = newInviteCode()
  const { error } = await supabase.from('map_invites').upsert({ map_id: mapId, code }, { onConflict: 'map_id' })
  if (error) fail(error, '지도 주인만 초대 링크를 만들 수 있어요.')
  return code
}

export async function getMapInvitePreview(mapId: string, code: string): Promise<MapInvitePreview | null> {
  const { data, error } = await supabase.rpc('map_invite_preview', { p_map_id: mapId, p_code: code })
  if (error) fail(error)
  const r = (data as { map_id: string; title: string; owner_id: string; pin_count: number; editor_count: number }[])[0]
  if (!r) return null
  return { mapId: r.map_id, title: r.title || '제목 없는 지도', owner: await getUser(r.owner_id), pinCount: Number(r.pin_count), editorCount: Number(r.editor_count) }
}

export async function joinMapByInvite(mapId: string, code: string): Promise<void> {
  await requireMe()
  const { error } = await supabase.rpc('join_map_by_invite', { p_map_id: mapId, p_code: code })
  if (error) fail(error)
}

export async function removeMapEditor(mapId: string, userId: string): Promise<void> {
  const { data, error } = await supabase.from('map_members').delete().eq('map_id', mapId).eq('user_id', userId).select('user_id')
  if (error) fail(error)
  if (!data?.length) throw new Error('지도 주인만 다른 사람을 뺄 수 있어요.')
}

// ===========================================================================
// 성지순례 (모임)
// ===========================================================================

// invite_code 는 직접 읽을 수 없는 컬럼이라 목록에서 뺀다 (참여자는 meetup_invite_code 함수로)
const MEETUP_COLS = 'id, map_id, host_id, title, description, meet_at, meet_point, capacity, status, visibility, created_at'
interface MeetupRow {
  id: string
  map_id: string
  host_id: string
  title: string
  description: string
  meet_at: string
  meet_point: string
  capacity: number
  status: MeetupStatus
  visibility: Meetup['visibility']
  created_at: string
}

/** 모임 행들 → 화면용 요약 (주최자 · 참여자 · 지도 요약 · 초대 코드) */
async function toSummaries(rows: MeetupRow[]): Promise<MeetupSummary[]> {
  if (!rows.length) return []
  const me = await myId()
  const ids = rows.map((r) => r.id)
  const mapIds = [...new Set(rows.map((r) => r.map_id))]
  const [{ data: members }, { data: maps }, { data: pinCounts }] = await Promise.all([
    supabase.from('meetup_members').select('meetup_id, user_id, joined_at').in('meetup_id', ids).order('joined_at'),
    supabase.from('maps').select('id, title, theme, cover_url').in('id', mapIds),
    supabase.from('pins').select('map_id').in('map_id', mapIds),
  ])
  const memberRows = (members ?? []) as { meetup_id: string; user_id: string; joined_at: string }[]
  const people = await usersById([...rows.map((r) => r.host_id), ...memberRows.map((m) => m.user_id)])
  const mapById = new Map(((maps ?? []) as { id: string; title: string; theme: ConceptMap['theme']; cover_url: string | null }[]).map((m) => [m.id, m]))
  const pinsOf = (mapId: string) => ((pinCounts ?? []) as { map_id: string }[]).filter((p) => p.map_id === mapId).length

  return Promise.all(
    rows.map(async (r) => {
      const ms = memberRows.filter((m) => m.meetup_id === r.id)
      const isMember = !!me && ms.some((m) => m.user_id === me)
      let inviteCode: string | null = null
      if (r.visibility === 'private' && isMember) {
        const { data } = await supabase.rpc('meetup_invite_code', { p_meetup_id: r.id })
        inviteCode = (data as string | null) ?? null
      }
      const map = mapById.get(r.map_id)
      return {
        id: r.id,
        mapId: r.map_id,
        hostId: r.host_id,
        title: r.title,
        description: r.description,
        meetAt: r.meet_at,
        meetPoint: r.meet_point,
        capacity: r.capacity,
        status: r.status,
        visibility: r.visibility,
        inviteCode,
        createdAt: r.created_at,
        host: people.get(r.host_id) ?? toUser(null, r.host_id),
        members: ms.map((m) => {
          const u = people.get(m.user_id) ?? toUser(null, m.user_id)
          return { userId: m.user_id, nickname: u.nickname, avatarUrl: u.avatarUrl ?? null, joinedAt: m.joined_at }
        }),
        map: { id: r.map_id, title: map?.title || '삭제된 지도', theme: map?.theme ?? 'default', pinCount: pinsOf(r.map_id), coverUrl: map?.cover_url ?? null },
      }
    }),
  )
}

export async function getMeetups(filter: MeetupFilter = 'all'): Promise<MeetupSummary[]> {
  const me = await myId()
  if (filter !== 'all' && !me) return []
  let q = supabase.from('meetups').select(MEETUP_COLS).order('meet_at')
  if (filter === 'hosting') q = q.eq('host_id', me!)
  if (filter === 'joined') {
    const { data } = await supabase.from('meetup_members').select('meetup_id').eq('user_id', me!)
    const ids = (data ?? []).map((r: { meetup_id: string }) => r.meetup_id)
    if (!ids.length) return []
    q = q.in('id', ids)
  }
  const { data, error } = await q
  if (error) fail(error)
  // 취소된 모임은 주최자에게만 · 비공개 모임은 RLS 가 참여자에게만 보여준다
  const rows = (data as MeetupRow[]).filter((m) => m.status !== 'canceled' || m.host_id === me)
  return toSummaries(rows)
}

export async function getMeetup(meetupId: string, inviteCode?: string): Promise<{ meetup: MeetupSummary; mapDetail: MapDetail | null } | null> {
  let { data: row } = await supabase.from('meetups').select(MEETUP_COLS).eq('id', meetupId).maybeSingle<MeetupRow>()
  // 비공개 모임: 참여 전에는 초대 코드가 맞아야 보인다
  if (!row && inviteCode) {
    const { data } = await supabase.rpc('meetup_by_invite', { p_meetup_id: meetupId, p_code: inviteCode })
    row = ((data ?? []) as MeetupRow[])[0] ?? null
  }
  if (!row) return null
  const [meetup] = await toSummaries([row])
  return { meetup, mapDetail: await getMap(row.map_id).catch(() => null) }
}

export async function saveMeetup(input: MeetupInput): Promise<MeetupSummary> {
  await requireMe()
  const title = input.title.trim()
  if (!title) throw new Error('모임 이름을 입력해 주세요.')
  if (!input.meetAt || Number.isNaN(Date.parse(input.meetAt))) throw new Error('모이는 날짜와 시간을 정해 주세요.')
  if (!input.meetPoint.trim()) throw new Error('모이는 곳을 입력해 주세요.')
  const capacity = Math.round(input.capacity)
  if (!(capacity >= 2 && capacity <= 50)) throw new Error('정원은 2명에서 50명 사이로 정해 주세요.')
  const row = {
    title,
    description: input.description.trim(),
    meet_at: new Date(input.meetAt).toISOString(),
    meet_point: input.meetPoint.trim(),
    capacity,
    visibility: input.visibility === 'private' ? 'private' : 'public',
  }
  const q = input.id ? supabase.from('meetups').update(row).eq('id', input.id) : supabase.from('meetups').insert({ ...row, map_id: input.mapId })
  const { data, error } = await q.select('id').single<{ id: string }>()
  if (error) fail(error, '이 지도로는 모임을 열 수 없어요.')
  const res = await getMeetup(data.id)
  if (!res) throw new Error('모임을 불러오지 못했어요.')
  return res.meetup
}

async function meetupOrThrow(meetupId: string, inviteCode?: string): Promise<MeetupSummary> {
  const res = await getMeetup(meetupId, inviteCode)
  if (!res) throw new Error('모임을 찾을 수 없어요.')
  return res.meetup
}

export async function joinMeetup(meetupId: string, inviteCode?: string): Promise<MeetupSummary> {
  await requireMe()
  const { error } = await supabase.rpc('join_meetup', { p_meetup_id: meetupId, p_code: inviteCode ?? null })
  if (error) fail(error)
  return meetupOrThrow(meetupId)
}

export async function leaveMeetup(meetupId: string): Promise<MeetupSummary> {
  const me = await requireMe()
  const { data, error } = await supabase.from('meetup_members').delete().eq('meetup_id', meetupId).eq('user_id', me).select('user_id')
  if (error) fail(error)
  if (!data?.length) throw new Error('주최자는 나갈 수 없어요. 모임을 취소해 주세요.')
  return meetupOrThrow(meetupId)
}

export async function setMeetupStatus(meetupId: string, status: MeetupStatus): Promise<MeetupSummary> {
  const { data, error } = await supabase.from('meetups').update({ status }).eq('id', meetupId).select('id')
  if (error) fail(error)
  if (!data?.length) throw new Error('주최자만 바꿀 수 있어요.')
  return meetupOrThrow(meetupId)
}

// ---- 댓글 ----

const COMMENT_COLS = 'id, meetup_id, user_id, kind, body, photo_url, created_at'
interface CommentRow {
  id: string
  meetup_id: string
  user_id: string
  kind: MeetupComment['kind']
  body: string
  photo_url: string | null
  created_at: string
}

export async function getMeetupComments(meetupId: string): Promise<MeetupComment[]> {
  const [{ data, error }, blocked] = await Promise.all([supabase.from('meetup_comments').select(COMMENT_COLS).eq('meetup_id', meetupId), blockedIds()])
  if (error) fail(error)
  const rows = (data as CommentRow[]).filter((c) => !blocked.has(c.user_id))
  const people = await usersById(rows.map((c) => c.user_id))
  const toComment = (c: CommentRow): MeetupComment => ({
    id: c.id,
    meetupId: c.meetup_id,
    author: people.get(c.user_id) ?? toUser(null, c.user_id),
    kind: c.kind,
    body: c.body,
    photoUrl: c.photo_url,
    createdAt: c.created_at,
  })
  // 공지(최신 먼저)가 맨 위, 나머지는 오래된 순
  const notices = rows.filter((c) => c.kind === 'notice').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const rest = rows.filter((c) => c.kind !== 'notice').sort((a, b) => a.created_at.localeCompare(b.created_at))
  return [...notices, ...rest].map(toComment)
}

export async function addMeetupComment(meetupId: string, input: MeetupCommentInput): Promise<MeetupComment> {
  await requireMe()
  const body = input.body.trim().slice(0, 500)
  if (!body && !input.photoUrl) throw new Error('내용을 입력해 주세요.')
  const { data, error } = await supabase
    .from('meetup_comments')
    .insert({ meetup_id: meetupId, kind: input.kind, body, photo_url: input.photoUrl })
    .select(COMMENT_COLS)
    .single<CommentRow>()
  if (error) {
    if (/row-level security/i.test(error.message)) {
      throw new Error(input.kind === 'notice' ? '공지는 주최자만 올릴 수 있어요.' : input.kind === 'review' ? '후기는 모임이 끝난 뒤에 남길 수 있어요.' : '참여한 사람만 댓글을 쓸 수 있어요.')
    }
    fail(error)
  }
  return { id: data.id, meetupId, author: (await fetchMe())!, kind: data.kind, body: data.body, photoUrl: data.photo_url, createdAt: data.created_at }
}

export async function deleteMeetupComment(commentId: string): Promise<void> {
  const { data, error } = await supabase.from('meetup_comments').delete().eq('id', commentId).select('id')
  if (error) fail(error)
  if (!data?.length) throw new Error('내 댓글만 지울 수 있어요.')
}

// ===========================================================================
// 순례방: 도착 체크 · 실시간
// ===========================================================================

export async function getMeetupCheckins(meetupId: string): Promise<MeetupCheckin[]> {
  if (!(await myId())) return []
  const { data, error } = await supabase.from('meetup_checkins').select('user_id, pin_id, created_at').eq('meetup_id', meetupId)
  if (error) fail(error)
  return (data as { user_id: string; pin_id: string; created_at: string }[]).map((r) => ({ userId: r.user_id, pinId: r.pin_id, createdAt: r.created_at }))
}

export async function setMeetupCheckin(meetupId: string, pinId: string, arrived: boolean): Promise<void> {
  const me = await requireMe()
  const { error } = arrived
    ? await supabase.from('meetup_checkins').upsert({ meetup_id: meetupId, user_id: me, pin_id: pinId }, { onConflict: 'meetup_id,user_id,pin_id', ignoreDuplicates: true })
    : await supabase.from('meetup_checkins').delete().eq('meetup_id', meetupId).eq('user_id', me).eq('pin_id', pinId)
  if (error) {
    if (/row-level security/i.test(error.message)) throw new Error('모임에 참여한 사람만 체크할 수 있어요.')
    fail(error)
  }
}

/** 순례방 채팅 · 도착 체크가 바뀌면 onChange (Supabase 실시간). 돌려준 함수로 그만 듣는다 */
export function subscribeMeetupRoom(meetupId: string, onChange: () => void): () => void {
  const filter = `meetup_id=eq.${meetupId}`
  const channel = supabase
    .channel(`meetup-room:${meetupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetup_comments', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetup_checkins', filter }, onChange)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

// ===========================================================================
// 신고 · 차단
// ===========================================================================

export async function submitReport(input: ReportInput): Promise<void> {
  const me = await myId()
  if (!me && input.target !== 'bug') throw new Error('로그인이 필요해요.')
  if (me && input.target === 'user' && input.targetId === me) throw new Error('나는 신고할 수 없어요.')
  const detail = input.detail.trim().slice(0, 1000)
  if (input.target === 'bug' && !detail) throw new Error('어떤 문제인지 적어 주세요.')
  const { error } = await supabase.from('reports').insert({
    reporter_id: me,
    target: input.target,
    target_id: input.targetId,
    target_label: input.targetLabel.slice(0, 80),
    target_user_id: input.targetUserId,
    reason: input.reason,
    detail,
    page_url: input.pageUrl.slice(0, 300),
    user_agent: input.target === 'bug' ? navigator.userAgent.slice(0, 300) : '',
  })
  if (error) fail(error)
}

export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const me = await requireMe()
  if (userId === me) throw new Error('나는 차단할 수 없어요.')
  const { error } = blocked
    ? await supabase.from('blocks').upsert({ user_id: me, blocked_id: userId }, { onConflict: 'user_id,blocked_id' })
    : await supabase.from('blocks').delete().eq('user_id', me).eq('blocked_id', userId)
  if (error) fail(error)
}

export async function getBlockedUsers(): Promise<User[]> {
  if (!(await myId())) return []
  const { data, error } = await supabase.from('blocks').select('blocked_id, created_at').order('created_at', { ascending: false })
  if (error) fail(error)
  const ids = (data as { blocked_id: string }[]).map((r) => r.blocked_id)
  const people = await usersById(ids)
  return ids.map((id) => people.get(id) ?? toUser(null, id))
}

const REPORT_COLS = 'id, reporter_id, target, target_id, target_label, target_user_id, reason, detail, page_url, user_agent, status, admin_note, created_at, resolved_at'
interface ReportRow {
  id: string
  reporter_id: string | null
  target: Report['target']
  target_id: string | null
  target_label: string
  target_user_id: string | null
  reason: Report['reason']
  detail: string
  page_url: string
  user_agent: string
  status: ReportStatus
  admin_note: string
  created_at: string
  resolved_at: string | null
}
async function toReports(rows: ReportRow[]): Promise<Report[]> {
  const people = await usersById(rows.map((r) => r.reporter_id ?? ''))
  return rows.map((r) => ({
    id: r.id,
    reporter: r.reporter_id ? (people.get(r.reporter_id) ?? toUser(null, r.reporter_id)) : null,
    target: r.target,
    targetId: r.target_id,
    targetLabel: r.target_label,
    targetUserId: r.target_user_id,
    reason: r.reason,
    detail: r.detail,
    pageUrl: r.page_url,
    userAgent: r.user_agent,
    status: r.status,
    adminNote: r.admin_note,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }))
}

export async function adminListReports(status?: ReportStatus): Promise<Report[]> {
  let q = supabase.from('reports').select(REPORT_COLS).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) fail(error)
  const rows = data as ReportRow[]
  // 처리 안 된 것 먼저
  return toReports([...rows.filter((r) => r.status === 'open'), ...rows.filter((r) => r.status !== 'open')])
}

export async function adminResolveReport(reportId: string, status: ReportStatus, note: string, opts: { removeContent?: boolean } = {}): Promise<Report> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: reportId, p_status: status, p_note: note.trim(), p_remove_content: !!opts.removeContent })
  if (error) fail(error)
  const { data, error: e2 } = await supabase.from('reports').select(REPORT_COLS).eq('id', reportId).single<ReportRow>()
  if (e2) fail(e2)
  return (await toReports([data]))[0]
}

// ===========================================================================
// 프로필 꾸미기
// ===========================================================================

const defaultDeco = (userId: string): ProfileDeco => ({
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
  bannerUrl: null,
  updatedAt: new Date().toISOString(),
})

interface DecoRow {
  user_id: string
  paper: ProfileDeco['paper']
  color: string
  font: ProfileDeco['font']
  bio: string
  mood: string
  stickers: ProfileDeco['stickers']
  pinned_map_ids: string[]
  map_style: ProfileDeco['mapStyle']
  sections: ProfileDeco['sections']
  banner_url: string | null
  updated_at: string
}
const toDeco = (r: DecoRow): ProfileDeco => ({
  userId: r.user_id,
  paper: r.paper,
  color: r.color,
  font: r.font,
  bio: r.bio,
  mood: r.mood,
  stickers: r.stickers ?? [],
  pinnedMapIds: r.pinned_map_ids ?? [],
  mapStyle: r.map_style,
  sections: r.sections,
  bannerUrl: r.banner_url,
  updatedAt: r.updated_at,
})

/** 지도 행 → 공개 지도 요약 (주인 · 핀 수) */
async function toPublicSummaries(rows: MapRow[]): Promise<PublicMapSummary[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const [people, { data: pins }] = await Promise.all([usersById(rows.map((r) => r.owner_id)), supabase.from('pins').select('map_id').in('map_id', ids)])
  const count = (id: string) => ((pins ?? []) as { map_id: string }[]).filter((p) => p.map_id === id).length
  return rows.map((r) => ({ map: toMap(r), owner: people.get(r.owner_id) ?? toUser(null, r.owner_id), pinCount: count(r.id) }))
}

export async function getProfile(userId: string): Promise<ProfilePage> {
  const [user, { data: deco }, { data: maps }] = await Promise.all([
    getUser(userId),
    supabase.from('profile_decos').select('*').eq('user_id', userId).maybeSingle<DecoRow>(),
    supabase.from('maps').select(MAP_COLS).eq('owner_id', userId).eq('is_public', true).order('updated_at', { ascending: false }),
  ])
  const d = deco ? toDeco(deco) : defaultDeco(userId)
  const publicMaps = (maps ?? []) as MapRow[]
  // 대표 지도(고른 순서) 먼저, 비공개로 바뀐 지도는 대표에서 빠진다
  const pinned = d.pinnedMapIds.map((id) => publicMaps.find((m) => m.id === id)).filter((m): m is MapRow => !!m)
  const rest = publicMaps.filter((m) => !d.pinnedMapIds.includes(m.id))
  return { user, deco: { ...d, pinnedMapIds: pinned.map((m) => m.id) }, maps: await toPublicSummaries([...pinned, ...rest]) }
}

export async function saveProfileDeco(input: ProfileDecoInput): Promise<ProfileDeco> {
  const me = await requireMe()
  const row = {
    user_id: me,
    paper: input.paper,
    color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#ffffff',
    font: input.font,
    bio: input.bio.trim().slice(0, 150),
    mood: input.mood.trim().slice(0, 40),
    stickers: input.stickers.slice(0, 30).map((s) => ({
      ...s,
      x: Math.min(100, Math.max(0, s.x)),
      y: Math.min(100, Math.max(0, s.y)),
      size: Math.min(160, Math.max(20, Math.round(s.size))),
      rotate: Math.round(s.rotate) % 360,
    })),
    pinned_map_ids: input.pinnedMapIds.slice(0, 6),
    map_style: input.mapStyle,
    sections: input.sections,
    banner_url: input.bannerUrl ?? null,
  }
  const { data, error } = await supabase.from('profile_decos').upsert(row, { onConflict: 'user_id' }).select('*').single<DecoRow>()
  if (error) fail(error)
  return toDeco(data)
}

// ===========================================================================
// 가져오기 · 둘러보기 · 순위
// ===========================================================================

export async function copyMap(mapId: string): Promise<ConceptMap> {
  await requireMe()
  const { data: id, error } = await supabase.rpc('copy_map', { p_map_id: mapId })
  if (error) fail(error)
  const res = await getMap(id as string)
  if (!res) throw new Error('가져온 지도를 불러오지 못했어요.')
  return res.map
}

/** id 목록 순서대로 지도 행 가져오기 (함수가 준 순서 유지) */
async function mapsInOrder(ids: string[]): Promise<MapRow[]> {
  if (!ids.length) return []
  const { data, error } = await supabase.from('maps').select(MAP_COLS).in('id', ids)
  if (error) fail(error)
  const byId = new Map((data as MapRow[]).map((m) => [m.id, m]))
  return ids.map((id) => byId.get(id)).filter((m): m is MapRow => !!m)
}

export async function getPublicMaps(opts: { category?: MapCategory; sort?: ExploreSort } = {}): Promise<ExploreMapEntry[]> {
  const { data, error } = await supabase.rpc('explore_maps', { p_category: opts.category ?? null, p_sort: opts.sort ?? 'popular' })
  if (error) fail(error)
  const rows = data as { map_id: string; users: number; pin_count: number }[]
  const [maps, blocked] = await Promise.all([mapsInOrder(rows.map((r) => r.map_id)), blockedIds()])
  const visible = maps.filter((m) => !blocked.has(m.owner_id))
  const people = await usersById(visible.map((m) => m.owner_id))
  return visible.map((m) => {
    const r = rows.find((x) => x.map_id === m.id)!
    return { map: toMap(m), owner: people.get(m.owner_id) ?? toUser(null, m.owner_id), pinCount: Number(r.pin_count), users: Number(r.users) }
  })
}

export async function getMonthlyRanking(month?: string, limit = 30): Promise<MapRankingEntry[]> {
  const { data, error } = await supabase.rpc('monthly_ranking', { p_month: month ?? null, p_limit: limit })
  if (error) fail(error)
  const rows = data as { map_id: string; users: number; rank: number }[]
  const summaries = await toPublicSummaries(await mapsInOrder(rows.map((r) => r.map_id)))
  return summaries.map((s) => {
    const r = rows.find((x) => x.map_id === s.map.id)!
    return { ...s, rank: Number(r.rank), users: Number(r.users) }
  })
}

// ===========================================================================
// 장소 리뷰 · 인기 장소
// ===========================================================================

const REVIEW_MAX = 100

interface PlaceStatsRow {
  external_id: string
  place_id: string
  map_count: number
  review_count: number
  avg_rating: number | string | null
}
const toPlaceStats = (r: PlaceStatsRow | undefined): PlaceStats => ({
  mapCount: Number(r?.map_count ?? 0),
  reviewCount: Number(r?.review_count ?? 0),
  avgRating: r?.avg_rating == null ? null : Number(r.avg_rating),
})

const REVIEW_COLS = 'id, place_id, user_id, rating, body, hidden, created_at, updated_at'
interface PlaceReviewRow {
  id: string
  place_id: string
  user_id: string
  rating: number
  body: string
  hidden: boolean
  created_at: string
  updated_at: string
}
const toPlaceReview = (r: PlaceReviewRow, people: Map<string, User>): PlaceReview => ({
  id: r.id,
  placeId: r.place_id,
  author: people.get(r.user_id) ?? toUser(null, r.user_id),
  rating: r.rating,
  body: r.body,
  hidden: r.hidden,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export async function getPlaceStats(externalIds: string[]): Promise<Record<string, PlaceStats>> {
  const ids = [...new Set(externalIds)].slice(0, 100)
  if (!ids.length) return {}
  const { data, error } = await supabase.rpc('place_stats', { p_external_ids: ids })
  if (error) fail(error)
  return Object.fromEntries((data as PlaceStatsRow[]).map((r) => [r.external_id, toPlaceStats(r)]))
}

export async function getPlaceDetail(externalId: string): Promise<PlaceDetail | null> {
  const { data: place, error } = await supabase
    .from('places')
    .select('id, external_id, name, lat, lng')
    .eq('external_id', externalId)
    .maybeSingle<{ id: string; external_id: string; name: string; lat: number; lng: number }>()
  if (error) fail(error)
  if (!place) return null
  const me = await myId()
  const [stats, reviews, pins, blocked, can] = await Promise.all([
    supabase.rpc('place_stats', { p_external_ids: [externalId] }),
    supabase.from('place_reviews').select(REVIEW_COLS).eq('place_id', place.id).order('created_at', { ascending: false }).limit(200),
    // 핀 읽기 권한(RLS) 때문에 공개 지도 + 내가 볼 수 있는 지도만 온다. 아래에서 공개 지도만 남긴다.
    supabase.from('pins').select('map_id').eq('place_id', place.id),
    blockedIds(),
    me ? supabase.rpc('has_pinned_place', { p_place_id: place.id }) : Promise.resolve({ data: false, error: null }),
  ])
  if (stats.error) fail(stats.error)
  if (reviews.error) fail(reviews.error)
  const reviewRows = (reviews.data as PlaceReviewRow[]).filter((r) => !blocked.has(r.user_id))
  const mapIds = [...new Set(((pins.data ?? []) as { map_id: string }[]).map((r) => r.map_id))]
  const mapRows = (await mapsInOrder(mapIds))
    .filter((m) => m.is_public && !blocked.has(m.owner_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const [people, maps] = await Promise.all([usersById(reviewRows.map((r) => r.user_id)), toPublicSummaries(mapRows)])
  return {
    place: { id: place.id, externalId: place.external_id, name: place.name, lat: place.lat, lng: place.lng },
    stats: toPlaceStats((stats.data as PlaceStatsRow[])[0]),
    reviews: reviewRows.map((r) => toPlaceReview(r, people)),
    maps,
    canReview: can.data === true,
  }
}

export async function savePlaceReview(placeId: string, input: PlaceReviewInput): Promise<PlaceReview> {
  const me = await requireMe()
  const rating = Math.round(input.rating)
  if (!(rating >= 1 && rating <= 5)) throw new Error('별점을 골라 주세요.')
  const body = input.body.trim()
  if (body.length > REVIEW_MAX) throw new Error(`후기는 ${REVIEW_MAX}자까지 쓸 수 있어요.`)
  // 금지어 · 가입 하루 · 하루 10개는 DB 트리거가 막는다 (여기선 금지어만 먼저 알려준다)
  if (hasBannedWord(body)) throw new Error(BANNED_WORD_MESSAGE)
  const { data, error } = await supabase
    .from('place_reviews')
    .upsert({ place_id: placeId, user_id: me, rating, body }, { onConflict: 'place_id,user_id' })
    .select(REVIEW_COLS)
    .single<PlaceReviewRow>()
  if (error) {
    if (/row-level security|42501/i.test(error.message) || error.code === '42501') throw new Error('내 지도에 담은 장소만 리뷰를 남길 수 있어요.')
    fail(error)
  }
  return toPlaceReview(data, await usersById([me]))
}

export async function deletePlaceReview(reviewId: string): Promise<void> {
  await requireMe()
  const { error } = await supabase.from('place_reviews').delete().eq('id', reviewId)
  if (error) fail(error)
}

// ===========================================================================
// 관리자 (DB 함수가 관리자인지 확인)
// ===========================================================================

export async function adminGetStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) fail(error)
  const r = (data as Record<string, number>[])[0]
  return {
    reportsOpen: Number(r.reports_open),
    users: Number(r.users),
    suspended: Number(r.suspended),
    maps: Number(r.maps),
    publicMaps: Number(r.public_maps),
    meetupsOpen: Number(r.meetups_open),
    usesThisMonth: Number(r.uses_this_month),
  }
}

interface AdminUserDbRow {
  id: string
  email: string
  nickname: string
  avatar_url: string | null
  role: UserRole
  suspended: boolean
  created_at: string
  map_count: number
  meetup_count: number
}
const toAdminUser = (r: AdminUserDbRow): AdminUser => ({
  id: r.id,
  email: r.email,
  nickname: r.nickname,
  avatarUrl: r.avatar_url,
  role: r.role,
  suspended: r.suspended,
  createdAt: r.created_at,
  mapCount: Number(r.map_count),
  meetupCount: Number(r.meetup_count),
})

export async function adminListUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) fail(error)
  return (data as AdminUserDbRow[]).map(toAdminUser)
}

export async function adminUpdateUser(userId: string, patch: Partial<Pick<AdminUserRow, 'nickname' | 'role' | 'suspended'>>): Promise<AdminUserRow> {
  const { error } = await supabase.rpc('admin_update_user', {
    p_user_id: userId,
    p_nickname: patch.nickname ?? null,
    p_role: patch.role ?? null,
    p_suspended: patch.suspended ?? null,
  })
  if (error) fail(error)
  const user = (await adminListUsers()).find((u) => u.id === userId)
  if (!user) throw new Error('회원을 찾을 수 없어요.')
  return { id: user.id, email: user.email, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role, suspended: user.suspended, createdAt: user.createdAt }
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
  if (error) fail(error)
}
