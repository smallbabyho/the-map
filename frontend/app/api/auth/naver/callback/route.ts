import { NextResponse, type NextRequest } from "next/server";
import { NAVER_STATE_COOKIE, naverConfig, safeNext, siteOriginOf, supabaseAdmin } from "@/src/lib/server/naver";

// 네이버로 시작하기 ②: 네이버에서 돌아오면
//   1. code 로 네이버 토큰 → 프로필(이메일 · 별명 · 사진)을 받는다
//   2. 그 이메일로 Supabase 사용자를 만든다 (이미 있으면 그 계정 그대로 = 이메일 가입자와 같은 계정)
//   3. 일회용 로그인 링크(token_hash)를 만들어 /auth/callback 으로 넘긴다 → 브라우저가 그걸로 로그인
// 관리자 키 SUPABASE_SERVICE_ROLE_KEY 는 서버 전용 (NEXT_PUBLIC_ 아님). 브라우저로 나가지 않는다.

interface NaverToken {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface NaverMe {
  resultcode: string;
  response?: { id: string; email?: string; nickname?: string; name?: string; profile_image?: string };
}

export async function GET(req: NextRequest) {
  const origin = siteOriginOf(req);
  const saved = parseState(req.cookies.get(NAVER_STATE_COOKIE)?.value);
  const next = safeNext(saved?.next ?? null);
  const fail = (error: string) => {
    const res = NextResponse.redirect(`${origin}/auth/callback?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`);
    res.cookies.delete({ name: NAVER_STATE_COOKIE, path: "/api/auth/naver" });
    return res;
  };

  const p = req.nextUrl.searchParams;
  if (p.get("error")) return fail(p.get("error") === "access_denied" ? "access_denied" : p.get("error_description") ?? "naver_error");
  const code = p.get("code");
  if (!code || !saved || saved.state !== p.get("state")) return fail("로그인 요청이 만료됐어요. 다시 시도해 주세요.");

  const config = naverConfig();
  const admin = supabaseAdmin();
  if (!config || !admin) return fail("naver_not_configured");

  // 1. 토큰 → 프로필
  const tq = new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, client_secret: config.clientSecret, code, state: saved.state });
  const token = (await fetch(`https://nid.naver.com/oauth2.0/token?${tq}`, { cache: "no-store" }).then((r) => r.json())) as NaverToken;
  if (!token.access_token) return fail(token.error_description ?? "네이버 로그인에 실패했어요.");
  const me = (await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }).then((r) => r.json())) as NaverMe;
  const profile = me.response;
  if (me.resultcode !== "00" || !profile) return fail("네이버 프로필을 불러오지 못했어요.");
  const email = profile.email?.trim().toLowerCase();
  if (!email) return fail("email_required");

  // 2. 사용자 만들기 (이미 있으면 넘어간다)
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nickname: profile.nickname || profile.name, avatar_url: profile.profile_image, provider: "naver", naver_id: profile.id },
    app_metadata: { provider: "naver", providers: ["naver"] },
  });
  if (createError && createError.code !== "email_exists" && !/already/i.test(createError.message)) return fail(createError.message);

  // 3. 일회용 로그인 링크
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return fail(error?.message ?? "로그인 링크를 만들지 못했어요.");

  const res = NextResponse.redirect(`${origin}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&next=${encodeURIComponent(next)}`);
  res.cookies.delete({ name: NAVER_STATE_COOKIE, path: "/api/auth/naver" });
  return res;
}

function parseState(raw: string | undefined): { state: string; next: string } | null {
  try {
    const v = JSON.parse(raw ?? "");
    return typeof v?.state === "string" && typeof v?.next === "string" ? v : null;
  } catch {
    return null;
  }
}
