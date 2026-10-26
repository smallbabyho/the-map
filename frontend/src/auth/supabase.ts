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
  const { data } = await supabase.auth.getSession()
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
