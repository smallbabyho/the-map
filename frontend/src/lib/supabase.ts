import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 (브라우저). 키는 frontend/.env.local 의 NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY.
// anon(publishable) 키는 공개용이라 브라우저에 있어도 된다. 실제로 막는 건 DB 의 RLS 다 (backend/supabase/migrations).

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

/** .env 에 Supabase 주소 · 키가 있는지 (없으면 화면은 가짜 데이터(mock)로 동작) */
export const hasSupabase = URL.length > 0 && KEY.length > 0

export const supabase = createClient(URL || 'http://localhost', KEY || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
