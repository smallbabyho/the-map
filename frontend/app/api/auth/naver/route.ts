import { NextResponse, type NextRequest } from "next/server";
import { NAVER_STATE_COOKIE, naverConfig, naverRedirectUri, safeNext } from "@/src/lib/server/naver";

// 네이버로 시작하기 ①: 네이버 로그인 화면으로 보낸다. Supabase 에 네이버가 없어서 우리 서버가 대신 처리한다.
// 키는 frontend/.env.local 의 NAVER_CLIENT_ID · NAVER_CLIENT_SECRET (네이버 개발자 센터 → 애플리케이션 등록)
//
// GET /api/auth/naver?next=/경로  →  nid.naver.com 로그인  →  /api/auth/naver/callback

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const config = naverConfig();
  if (!config) {
    return NextResponse.redirect(new URL(`/auth/callback?error=naver_not_configured&next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  }

  // state: 다른 사이트가 콜백을 꾸며 보내지 못하게 쿠키와 맞춰 본다 (next 도 같이 담아 둔다)
  const state = crypto.randomUUID();
  const q = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: naverRedirectUri(req), state });
  const res = NextResponse.redirect(`https://nid.naver.com/oauth2.0/authorize?${q}`);
  res.cookies.set(NAVER_STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/naver",
    maxAge: 600,
  });
  return res;
}
