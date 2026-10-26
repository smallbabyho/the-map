// 백엔드(Supabase Auth)가 붙기 전까지 쓰는 가짜 회원 기능 (브라우저 localStorage).
// 진짜 버전도 함수 이름·입력·반환·에러 메시지 형태를 똑같이 맞춘다. 화면은 src/auth/index.ts 로만 import.

import type { AdminUserRow, User, UserRole } from '../types'

const STORAGE_KEY = 'the-map:mock-auth:v1'
const MIN_PASSWORD = 6

interface StoredUser extends User {
  email: string
  passwordHash: string
  role: UserRole
  suspended: boolean
  createdAt: string
}
interface AuthStore {
  users: StoredUser[]
  sessionUserId: string | null
  /** 체험 계정을 넣었는지 (한 번만 넣어야 관리자가 지운 계정이 되살아나지 않는다) */
  demoSeeded?: boolean
}

// 체험용 계정 (비밀번호 모두 test1234). '테스터'는 기존 mock 데이터의 주인과 같은 id.
const DEMO_PASSWORD = 'test1234'
const DEMO_USERS: { id: string; email: string; nickname: string; role: UserRole; daysAgo: number }[] = [
  { id: 'mock-user', email: 'test@example.com', nickname: '테스터', role: 'user', daysAgo: 3 },
  { id: 'u-bread', email: 'bread@example.com', nickname: '빵순이', role: 'user', daysAgo: 41 },
  { id: 'u-drama', email: 'drama@example.com', nickname: '드라마덕후', role: 'user', daysAgo: 25 },
  { id: 'u-cafe', email: 'cafe@example.com', nickname: '카페투어러', role: 'user', daysAgo: 12 },
  { id: 'u-admin', email: 'admin@example.com', nickname: '관리자', role: 'admin', daysAgo: 60 },
]
export const DEMO_ACCOUNT: { email: string; password: string } | null = { email: DEMO_USERS[0].email, password: DEMO_PASSWORD }
export const DEMO_ADMIN = { email: 'admin@example.com', password: DEMO_PASSWORD }

// 비밀번호를 평문으로 두지 않기 위한 간단한 해시 (mock 이라 보안용은 아님)
function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return `h${h.toString(36)}`
}

function load(): AuthStore {
  let store: AuthStore = { users: [], sessionUserId: null }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) store = JSON.parse(raw) as AuthStore
  } catch {
    // 깨졌으면 새로 시작
  }
  // 체험 계정은 처음 한 번만 채워 넣기
  for (const d of store.demoSeeded ? [] : DEMO_USERS) {
    if (!store.users.some((u) => u.id === d.id)) {
      const { daysAgo, ...rest } = d
      store.users.push({ ...rest, passwordHash: hash(DEMO_PASSWORD), suspended: false, createdAt: new Date(Date.now() - daysAgo * 864e5).toISOString() })
    }
  }
  if (!store.demoSeeded) {
    store.demoSeeded = true
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      // 저장 실패해도 화면은 동작
    }
  }
  // 예전 형식 데이터 보정
  for (const u of store.users) {
    u.role ??= 'user'
    u.suspended ??= false
    u.createdAt ??= new Date().toISOString()
  }
  return store
}

function persist(store: AuthStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    throw new Error('브라우저 저장 공간에 문제가 있어요. 잠시 후 다시 시도해 주세요.')
  }
}

const toUser = (u: StoredUser): User => ({ id: u.id, nickname: u.nickname, role: u.role, avatarUrl: u.avatarUrl ?? null })
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `u-${Date.now().toString(36)}`)
const tick = () => new Promise((r) => setTimeout(r, 250))

// ---- 로그인 상태 변화 알림 ----
type Listener = (user: User | null) => void
const listeners = new Set<Listener>()
function emit() {
  const user = mockCurrentUser()
  listeners.forEach((l) => l(user))
}

// ---- db/mock.ts 에서 쓰는 내부 함수 ----

/** 지금 로그인한 사용자 (동기). 화면에서는 getCurrentUser() 를 쓴다. */
export function mockCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const store = load()
  const u = store.users.find((x) => x.id === store.sessionUserId)
  return u && !u.suspended ? toUser(u) : null
}

/** id → 닉네임 (모임 참여자 표시용) */
/** 가입 시각 (리뷰 '가입 후 하루' 확인용). 모르는 사람이면 null */
export function mockUserCreatedAt(id: string): string | null {
  return load().users.find((x) => x.id === id)?.createdAt ?? null
}

/** 닉네임으로 찾기 (검색용, 정지된 사람 제외) */
export function mockSearchUsers(q: string): User[] {
  const k = q.trim().toLowerCase()
  if (!k) return []
  return load().users.filter((u) => !u.suspended && u.nickname.toLowerCase().includes(k)).map(toUser)
}

export function mockUserById(id: string): User {
  const u = load().users.find((x) => x.id === id)
  return u ? toUser(u) : { id, nickname: '알 수 없음' }
}

/** 내 프로필 수정: 닉네임 · 프로필 사진 (null 이면 사진 지우기) */
export function mockUpdateMe(patch: { nickname?: string; avatarUrl?: string | null }): User {
  const store = load()
  const u = store.users.find((x) => x.id === store.sessionUserId)
  if (!u || u.suspended) throw new Error('로그인이 필요해요.')
  if (patch.nickname !== undefined) {
    const nick = patch.nickname.trim()
    if (!nick) throw new Error('닉네임을 입력해 주세요.')
    u.nickname = nick.slice(0, 30)
  }
  if (patch.avatarUrl !== undefined) u.avatarUrl = patch.avatarUrl
  persist(store)
  emit()
  return toUser(u)
}

// ---- 공개 함수 ----

function checkCaptcha(token: string) {
  if (!token) throw new Error('로봇이 아님을 확인해 주세요. (캡차)')
  if (token === 'fail') throw new Error('캡차 인증에 실패했어요. 다시 시도해 주세요.')
}

function checkEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 형식이 올바르지 않아요.')
}

/**
 * 회원가입. 성공하면 바로 로그인된다.
 *
 * @example
 * try {
 *   const user = await signUp('me@example.com', 'secret12', '빵지순례자', captchaToken)
 * } catch (e) {
 *   setError((e as Error).message) // '이미 가입된 이메일이에요.' 등 한국어 메시지
 * }
 */
export async function signUp(email: string, password: string, nickname: string, captchaToken: string): Promise<User> {
  await tick()
  checkCaptcha(captchaToken)
  const mail = email.trim().toLowerCase()
  const nick = nickname.trim()
  checkEmail(mail)
  if (!nick) throw new Error('닉네임을 입력해 주세요.')
  if (nick.length > 30) throw new Error('닉네임은 30자까지 쓸 수 있어요.')
  if (password.length < MIN_PASSWORD) throw new Error(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`)

  const store = load()
  if (store.users.some((u) => u.email === mail)) throw new Error('이미 가입된 이메일이에요.')
  const user: StoredUser = { id: newId(), email: mail, nickname: nick, passwordHash: hash(password), role: 'user', suspended: false, createdAt: new Date().toISOString() }
  store.users.push(user)
  store.sessionUserId = user.id
  persist(store)
  emit()
  return toUser(user)
}

/**
 * 로그인.
 *
 * @example
 * const user = await signIn('test@example.com', 'test1234', captchaToken)
 */
export async function signIn(email: string, password: string, captchaToken: string): Promise<User> {
  await tick()
  checkCaptcha(captchaToken)
  const store = load()
  const user = store.users.find((u) => u.email === email.trim().toLowerCase())
  if (!user || user.passwordHash !== hash(password)) throw new Error('이메일 또는 비밀번호가 맞지 않아요.')
  if (user.suspended) throw new Error('이용이 정지된 계정이에요. 관리자에게 문의해 주세요.')
  store.sessionUserId = user.id
  persist(store)
  emit()
  return toUser(user)
}

/**
 * 로그아웃.
 *
 * @example
 * await signOut(); router.push('/login')
 */
export async function signOut(): Promise<void> {
  const store = load()
  store.sessionUserId = null
  persist(store)
  emit()
}

/**
 * 로그인 상태가 바뀔 때마다 callback(user | null). 다른 탭에서 바뀐 것도 알려준다.
 * 돌려준 함수를 부르면 구독 해제.
 *
 * @example
 * useEffect(() => onAuthChange(setUser), [])
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  listeners.add(callback)
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && callback(mockCurrentUser())
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

// ---- 관리자용 (admin 만) ----

const toRow = (u: StoredUser): AdminUserRow => ({
  id: u.id,
  email: u.email,
  nickname: u.nickname,
  avatarUrl: u.avatarUrl ?? null,
  role: u.role,
  suspended: u.suspended,
  createdAt: u.createdAt,
})

function requireAdmin() {
  const me = mockCurrentUser()
  if (!me) throw new Error('로그인이 필요해요.')
  if (me.role !== 'admin') throw new Error('관리자만 할 수 있어요.')
  return me
}

/** 전체 회원 목록 (가입 최신순) */
export function mockListUsers(): AdminUserRow[] {
  requireAdmin()
  return load()
    .users.map(toRow)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 회원 정보 수정: 닉네임 · 권한 · 정지 */
export function mockUpdateUser(userId: string, patch: Partial<Pick<AdminUserRow, 'nickname' | 'role' | 'suspended'>>): AdminUserRow {
  const me = requireAdmin()
  if (userId === me.id && (patch.role === 'user' || patch.suspended)) throw new Error('내 계정의 관리자 권한이나 상태는 바꿀 수 없어요.')
  const store = load()
  const u = store.users.find((x) => x.id === userId)
  if (!u) throw new Error('회원을 찾을 수 없어요.')
  if (patch.nickname !== undefined) {
    const nick = patch.nickname.trim()
    if (!nick) throw new Error('닉네임을 입력해 주세요.')
    u.nickname = nick.slice(0, 30)
  }
  if (patch.role) u.role = patch.role
  if (patch.suspended !== undefined) u.suspended = patch.suspended
  persist(store)
  emit()
  return toRow(u)
}

/** 회원 삭제 (탈퇴 처리). 지도·모임 정리는 db/mock 의 adminDeleteUser 가 같이 한다. */
export function mockDeleteUser(userId: string) {
  const me = requireAdmin()
  if (userId === me.id) throw new Error('내 계정은 여기서 삭제할 수 없어요.')
  const store = load()
  store.users = store.users.filter((u) => u.id !== userId)
  if (store.sessionUserId === userId) store.sessionUserId = null
  persist(store)
  emit()
}
