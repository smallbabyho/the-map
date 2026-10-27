import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 🔗 링크로 한 번에 채우기: 글에 나온 장소를 뽑는다.
//   1) 네이버 블로그의 '장소 첨부'(지도 카드): 상호 · 주소 · 좌표가 그대로 들어 있어서 AI 없이 정확하게 읽는다
//   2) 카드가 없으면 AI(Gemini)가 본문에서 뽑는다. 키(GEMINI_API_KEY, 서버 전용)가 없으면 이 단계는 건너뛴다
// 위치 맞추기(카카오 장소 검색)는 화면에서 한다 (편집 화면의 장소 검색과 같은 방식이라 샘플 모드에서도 동작).
//
// GET  /api/places/from-link → { ai: boolean }  (AI 를 쓸 수 있는지. 없으면 화면이 '글 붙여 넣기' 를 숨긴다)
// POST /api/places/from-link  { url?: string, text?: string }  (Authorization: Bearer <Supabase access token>)
//   → { title, places: [{ name, area, memo, address?, lat?, lng? }] }   오류면 { error } (한국어)

const KEY = (process.env.GEMINI_API_KEY ?? "").trim();
const MODEL = (process.env.GEMINI_MODEL ?? "gemini-2.5-flash").trim();
const MAX_TEXT = 12_000; // AI 에 보내는 글자 수 (비용 · 속도)
const DAILY_LIMIT = 20; // 한 사람이 하루에 쓸 수 있는 횟수 (서버 한 대 기준, 남용 막기용)

/** 로그인이 필요한 서비스면 Supabase 토큰을 확인한다. Supabase 가 없으면(샘플 모드) 'demo' */
async function whoIs(req: NextRequest): Promise<string | null> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !anon) return "demo";
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  return data.user?.id ?? null;
}

const uses = new Map<string, { day: string; n: number }>();
function overLimit(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = uses.get(userId);
  const n = u?.day === day ? u.n + 1 : 1;
  uses.set(userId, { day, n });
  return n > DAILY_LIMIT;
}

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** 로그인이 필요해 서버가 못 읽는 곳 */
const LOGIN_WALLED = /(^|\.)(instagram\.com|threads\.net|threads\.com|facebook\.com|fb\.com|x\.com|twitter\.com)$/i;

/** 내부망 · 이 서버 자신으로 가는 주소는 막는다 */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^\[?(::1|fc|fd|fe80)/.test(h)) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** 네이버 블로그는 본문이 iframe 안에 있어서 모바일 주소로 바꿔 읽는다 */
function readableUrl(u: URL): URL {
  if (/^(m\.)?blog\.naver\.com$/i.test(u.hostname)) {
    const blogId = u.searchParams.get("blogId");
    const logNo = u.searchParams.get("logNo");
    if (blogId && logNo) return new URL(`https://m.blog.naver.com/${blogId}/${logNo}`);
    const [id, no] = u.pathname.split("/").filter(Boolean);
    if (id && no) return new URL(`https://m.blog.naver.com/${id}/${no}`);
  }
  return u;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

interface Extracted {
  name: string;
  area: string;
  memo: string;
  /** 장소 카드에서 읽었으면 주소 · 좌표도 */
  address?: string;
  lat?: number;
  lng?: number;
}

/** 네이버 블로그 '장소 첨부' 카드: <script class="__se_module_data" data-module='{"type":"v2_map", … "places":[…]}'> */
function mapCards(html: string): Extracted[] {
  const out: Extracted[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/data-module='(\{"type":\s*"v2_map"[^']*)'/g)) {
    try {
      const mod = JSON.parse(decodeEntities(m[1])) as { data?: { places?: { placeId?: string; name?: string; address?: string; latlng?: { latitude?: number; longitude?: number } }[] } };
      for (const p of mod.data?.places ?? []) {
        const name = p.name?.trim();
        const key = p.placeId || `${name}|${p.address}`;
        if (!name || seen.has(key)) continue;
        seen.add(key);
        const address = p.address?.trim() ?? "";
        out.push({ name: name.slice(0, 60), area: address.split(" ").slice(0, 3).join(" "), memo: "", address, lat: p.latlng?.latitude, lng: p.latlng?.longitude });
      }
    } catch {
      // 카드 하나가 깨져도 나머지는 읽는다
    }
  }
  return out.slice(0, 30);
}

/** HTML → 읽을 글 (제목 + 설명 + 본문) */
function htmlToText(html: string): { title: string; text: string } {
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? "";
  const title = decodeEntities(meta("og:title") || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim();
  // 유튜브: 영상 설명란
  const yt = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  const body = html
    .replace(/<(script|style|noscript|svg|iframe|header|footer|nav)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = [title, decodeEntities(meta("og:description")), yt ? JSON.parse(`"${yt}"`) : "", decodeEntities(body)]
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text };
}

async function readPage(raw: string): Promise<{ title: string; text: string; cards: Extracted[] } | string> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "링크 주소가 올바르지 않아요.";
  }
  if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return "읽을 수 없는 주소예요.";
  if (LOGIN_WALLED.test(u.hostname)) return "인스타그램 · 스레드 · 페이스북 · X 는 로그인이 필요해서 링크로 읽을 수 없어요. 글 내용을 복사해서 '글 붙여 넣기' 에 넣어 주세요.";
  const target = readableUrl(u);
  let res: Response;
  try {
    res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MyConceptMapBot/1.0)", "Accept-Language": "ko,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return "그 페이지를 불러오지 못했어요. 주소를 확인하거나 글 내용을 붙여 넣어 주세요.";
  }
  if (!res.ok) return `그 페이지를 열 수 없어요 (${res.status}). 글 내용을 붙여 넣어 주세요.`;
  if (!/text\/html|text\/plain/i.test(res.headers.get("content-type") ?? "")) return "글이 있는 페이지가 아니에요.";
  const html = (await res.text()).slice(0, 3_000_000);
  return { ...htmlToText(html), cards: mapCards(html) };
}

async function extractPlaces(title: string, text: string): Promise<Extracted[] | string> {
  const prompt = `아래 글에서 '실제로 찾아갈 수 있는 장소'(가게 · 카페 · 식당 · 관광지 · 공원 · 전시장 · 숙소 등)를 글에 나온 순서대로 뽑아 주세요.
- name: 지도에서 검색할 정확한 상호 · 장소 이름 (지점명이 있으면 포함, 예: "블루보틀 성수"). 지역 이름만(예: "성수동")이나 지하철역 · 일반 명사는 빼요.
- area: 그 장소를 찾는 데 도움 되는 지역 힌트 (예: "서울 성동구 성수동"). 모르면 글 전체의 지역.
- memo: 글에서 그 장소에 대해 한 말을 30자 안으로 (추천 메뉴 · 특징). 없으면 빈 문자열.
- 같은 장소는 한 번만. 최대 20곳.

글 제목: ${title}
글:
${text.slice(0, MAX_TEXT)}`;

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { name: { type: "STRING" }, area: { type: "STRING" }, memo: { type: "STRING" } },
              required: ["name", "area", "memo"],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return "AI 가 응답하지 않아요. 잠시 후 다시 시도해 주세요.";
  }
  if (res.status === 429) return "AI 사용량이 많아요. 잠시 후 다시 시도해 주세요.";
  if (!res.ok) return "AI 가 글을 읽지 못했어요. 잠시 후 다시 시도해 주세요.";
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    const list = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]") as Extracted[];
    const seen = new Set<string>();
    return list
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .map((p) => ({ name: p.name.trim().slice(0, 60), area: String(p.area ?? "").trim().slice(0, 60), memo: String(p.memo ?? "").trim().slice(0, 60) }))
      .filter((p) => !seen.has(p.name) && seen.add(p.name))
      .slice(0, 20);
  } catch {
    return "AI 답을 읽지 못했어요. 다시 시도해 주세요.";
  }
}

export function GET() {
  return Response.json({ ai: !!KEY });
}

export async function POST(req: NextRequest) {
  const userId = await whoIs(req);
  if (!userId) return fail("로그인이 필요해요.", 401);
  if (overLimit(userId)) return fail(`링크로 채우기는 하루 ${DAILY_LIMIT}번까지 쓸 수 있어요.`, 429);

  const body = (await req.json().catch(() => ({}))) as { url?: string; text?: string };
  let title = "";
  let text = (body.text ?? "").trim();
  if (!text) {
    if (!body.url?.trim()) return fail("링크를 넣어 주세요.");
    const page = await readPage(body.url.trim());
    if (typeof page === "string") return fail(page);
    // 장소 카드가 있으면 AI 없이 그대로
    if (page.cards.length) return Response.json({ title: page.title, places: page.cards });
    ({ title, text } = page);
  }
  if (!KEY) {
    return fail(
      body.text
        ? "글에서 장소를 찾는 기능(AI)은 아직 준비 중이에요."
        : "이 글에는 지도에 첨부된 장소가 없어요. 지금은 네이버 블로그에서 '장소' 를 첨부한 글만 읽을 수 있어요.",
      422,
    );
  }
  if (text.length < 20) return fail("읽을 글이 너무 짧아요. 장소가 나온 글을 넣어 주세요.");

  const places = await extractPlaces(title, text);
  if (typeof places === "string") return fail(places, 502);
  return Response.json({ title, places });
}
