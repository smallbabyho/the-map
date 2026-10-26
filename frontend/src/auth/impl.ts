// 회원 기능 구현 고르기: .env 에 Supabase 키가 있으면 진짜(supabase.ts), 없으면 가짜(mock.ts).
// 아래 타입 표시 덕분에 두 파일의 함수 이름 · 모양이 다르면 빌드가 실패한다.

import { hasSupabase } from '../lib/supabase'
import * as mock from './mock'
import * as real from './supabase'

type AuthApi = Pick<typeof mock, 'signUp' | 'signIn' | 'signOut' | 'onAuthChange' | 'DEMO_ACCOUNT'>
const impl: AuthApi = hasSupabase ? real : mock

export const signUp = impl.signUp
export const signIn = impl.signIn
export const signOut = impl.signOut
export const onAuthChange = impl.onAuthChange
export const DEMO_ACCOUNT = impl.DEMO_ACCOUNT
