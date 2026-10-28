// 진짜 회원 기능 (Supabase Auth). 함수 이름 · 입력 · 반환 · 에러 메시지 형태는 mock.ts 와 같다.
// 화면은 src/auth/index.ts 로만 import 한다 (.env 에 Supabase 키가 있으면 이 파일, 없으면 mock).
//
// 캡차: Supabase 대시보드 → Authentication → Attack Protection → Captcha(Turnstile) 를 켜면
// signUp · signIn 에 넘긴 captchaToken 을 Supabase 가 Cloudflare 에 확인한다. 꺼져 있으면 토큰은 무시된다.

import { siteOrigin } from '../lib/site'
import { supabase } from '../lib/supabase'
import type { User, UserRole } from '../types'

/** 진짜 서비스에는 체험 계정이 없다 (mock 에만) */
export const DEMO_ACCOUNT: { email: string; password: string } | null = null

const PROFILE_COLS = 'id, nickname, role, avatar_url, suspended'
interface ProfileRow {
  id: string
  nickname: string
  role: UserRole
  avatar_url: string | null
  suspended: boolean
}
const toUser = (p: ProfileRow): User => ({ id: p.id, nickname: p.nickname, role: p.role, avatarUrl: p.avatar_url })

/** Supabase 영어 에러 → 화면용 한국어 */
function authError(message: string): Error {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return new Error('이메일 또는 비밀번호가 맞지 않아요.')
  if (m.includes('already registered') || m.includes('already been registered')) return new Error('이미 가입된 이메일이에요.')
  if (m.includes('email not confirmed')) return new Error('메일 인증을 먼저 해 주세요. 가입할 때 받은 메일의 링크를 눌러 주세요.')
  if (m.includes('banned')) return new Error('이용이 정지된 계정이에요. 문의가 필요하면 관리자에게 연락해 주세요.')
  if (m.includes('captcha')) return new Error('캡차 인증에 실패했어요. 다시 시도해 주세요.')
  if (m.includes('password') && m.includes('6')) return new Error('비밀번호는 6자 이상이어야 해요.')
  if (m.includes('invalid') && m.includes('email')) return new Error('이메일 형식이 올바르지 않아요.')
  if (m.includes('rate limit') || m.includes('too many')) return new Error('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.')
  return new Error(message)
}

/** 지금 로그인한 사람 (프로필 포함). 정지된 계정이면 로그아웃시키고 null */
export async function fetchMe(): Promise<User | null> {
  const { data, error } = await supabase.auth.getSession()
  // 저장된 로그인이 서버에서 이미 끝났으면(Refresh Token Not Found 등) 이 브라우저의 로그인 기록만 지우고 로그아웃 상태로
  if (error) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    return null
  }
  const uid = data.session?.user.id
  if (!uid) return null
  const { data: p } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', uid).maybeSingle<ProfileRow>()
  if (!p) return null
  if (p.suspended) {
    await supabase.auth.signOut()
    return null
  }
  return toUser(p)
}

// ---- 로그인 상태 · 프로필 변경 알림 ----
type Listener = (user: User | null) => void
const listeners = new Set<Listener>()

/** 프로필(닉네임 · 사진)을 바꾼 뒤 화면에 알린다 (db/supabase.ts 의 updateMyProfile 이 부른다) */
export async function notifyProfileChanged() {
  const me = await fetchMe()
  listeners.forEach((l) => l(me))
}

/**
 * 회원가입. 메일 인증이 꺼져 있으면 바로 로그인된다.
 * 메일 인증이 켜져 있으면 '메일을 확인해 달라'는 에러를 던진다 (화면은 그 문구를 그대로 보여준다).
 */
export async function signUp(email: string, password: string, nickname: string, captchaToken: string): Promise<User> {
  const nick = nickname.trim()
  if (!nick) throw new Error('닉네임을 입력해 주세요.')
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 해요.')
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { nickname: nick.slice(0, 30) }, captchaToken: captchaToken || undefined, emailRedirectTo: `${siteOrigin()}/` },
  })
  if (error) throw authError(error.message)
  // 이미 가입된 이메일이면 Supabase 는 에러 없이 identities 가 빈 사용자를 준다
  if (data.user && data.user.identities?.length === 0) throw new Error('이미 가입된 이메일이에요.')
  if (!data.session) throw new Error('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요. ✉️')
  const me = await fetchMe()
  if (!me) throw new Error('가입은 됐는데 프로필을 불러오지 못했어요. 다시 로그인해 주세요.')
  return me
}

export async function signIn(email: string, password: string, captchaToken: string): Promise<User> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captchaToken || undefined } })
  if (error) throw authError(error.message)
  const me = await fetchMe()
  if (!me) throw new Error('이용이 정지된 계정이에요. 문의가 필요하면 관리자에게 연락해 주세요.')
  return me
}

/** 카카오 · 네이버 · 구글로 시작하기. 처음이면 가입, 이미 있으면 로그인 (같은 이메일 계정에 자동으로 이어진다) */
export type SocialProvider = 'kakao' | 'naver' | 'google'

/**
 * 소셜 로그인 화면으로 보낸다 (이 함수는 돌아오지 않고 페이지가 넘어간다).
 * 끝나면 /auth/callback?next=… 로 돌아와 completeSocialSignIn 이 마무리한다.
 * 카카오 · 구글은 Supabase 가 직접 처리하고, 네이버는 Supabase 에 없어서 우리 서버(/api/auth/naver)가 대신한다.
 */
export async function signInWithProvider(provider: SocialProvider, next: string): Promise<void> {
  const back = `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`
  if (provider === 'naver') {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 페이지가 아니라 서버 라우트(네이버로 넘기는 곳)라 주소 이동이 맞다
    window.location.assign(`${siteOrigin()}/api/auth/naver?next=${encodeURIComponent(next)}`)
    return
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: back } })
  if (error) throw authError(error.message)
}

/**
 * 소셜 로그인에서 돌아온 뒤 세션을 마무리한다 (/auth/callback 화면이 부른다).
 * - 카카오 · 구글: 주소에 붙어 온 토큰은 Supabase 클라이언트가 알아서 읽는다
 * - 네이버: 우리 서버가 만든 일회용 token_hash 로 로그인
 * - 취소하거나 실패하면 주소에 error 가 붙어 온다
 */
export async function completeSocialSignIn(url: URL): Promise<User> {
  const hash = new URLSearchParams(url.hash.slice(1))
  const failed = url.searchParams.get('error_description') ?? hash.get('error_description') ?? url.searchParams.get('error') ?? hash.get('error')
  if (failed) throw socialError(failed)
  const tokenHash = url.searchParams.get('token_hash')
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (error) throw authError(error.message)
  }
  const me = await fetchMe()
  if (!me) throw new Error('로그인하지 못했어요. 다시 시도해 주세요.')
  return me
}

function socialError(message: string): Error {
  const m = message.toLowerCase()
  if (m.includes('access_denied') || m.includes('cancel')) return new Error('로그인을 취소했어요.')
  if (m.includes('email')) return new Error('이메일 제공에 동의해야 가입할 수 있어요. 다시 시도하면서 이메일 항목에 동의해 주세요.')
  if (m.includes('naver_not_configured')) return new Error('네이버 로그인은 아직 준비 중이에요.')
  return authError(message)
}

/** 이 계정이 이미 본 기능 안내(Tour) 이름들. 계정에 저장해서 브라우저 · 기기가 바뀌어도 다시 뜨지 않는다. 로그인 안 했으면 null */
export async function getSeenTours(): Promise<string[] | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null
  const tours = user.user_metadata?.tours_seen
  return Array.isArray(tours) ? tours.filter((t): t is string => typeof t === 'string') : []
}

export async function rememberTourSeen(id: string): Promise<void> {
  const seen = await getSeenTours()
  if (!seen || seen.includes(id)) return
  await supabase.auth.updateUser({ data: { tours_seen: [...seen, id] } })
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * 로그인 상태가 바뀔 때마다 callback(user | null). 다른 탭에서 바뀐 것 · 토큰 갱신 · 프로필 변경도 알려준다.
 * 돌려준 함수를 부르면 구독 해제.
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  listeners.add(callback)
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') return callback(null)
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      // 콜백 안에서 바로 supabase 를 부르면 막힐 수 있어서 한 박자 뒤에 (Supabase 권장)
      setTimeout(() => fetchMe().then(callback), 0)
    }
  })
  return () => {
    listeners.delete(callback)
    data.subscription.unsubscribe()
  }
}
