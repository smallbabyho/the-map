// 네이버 로그인 서버 라우트(app/api/auth/naver)에서만 쓰는 것들. 브라우저 코드에서 import 하지 않는다.
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const NAVER_STATE_COOKIE = "naver_oauth";

export function naverConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.NAVER_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.NAVER_CLIENT_SECRET ?? "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** 관리자 권한 Supabase (RLS 무시). 사용자 만들기 · 로그인 링크 만들기에만 쓴다 */
export function supabaseAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** 사이트 대표 주소 (src/lib/site.ts 와 같은 규칙: NEXT_PUBLIC_SITE_URL, 없으면 지금 열린 주소) */
export function siteOriginOf(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "") || req.nextUrl.origin;
}

/** 네이버 개발자 센터의 Callback URL 에 이 주소를 그대로 등록해야 한다 */
export function naverRedirectUri(req: NextRequest): string {
  return `${siteOriginOf(req)}/api/auth/naver/callback`;
}

/** 외부 주소로 튀지 않게 내부 경로만 허용 */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
