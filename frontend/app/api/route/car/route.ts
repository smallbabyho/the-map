import type { NextRequest } from "next/server";

// 자동차 길찾기 (카카오모빌리티 Directions). REST 키는 비밀이라 서버에서만 쓴다 → frontend/.env.local 의 KAKAO_REST_KEY
// (NEXT_PUBLIC_ 아님). 카카오 개발자 콘솔 → 내 애플리케이션 → 앱 키 → REST API 키.
// https://developers.kakaomobility.com/docs/navi-api/directions/
//
// GET /api/route/car?from=lng,lat&to=lng,lat
//   → { distanceM, durationMin, path: [[lng, lat], …] }   키가 없으면 501, 길이 없으면 404 (화면은 OSRM 으로 대신)

const KEY = (process.env.KAKAO_REST_KEY ?? "").trim();

interface KakaoDirections {
  routes?: {
    result_code: number;
    result_msg: string;
    summary?: { distance: number; duration: number };
    sections?: { roads: { vertexes: number[] }[] }[];
  }[];
}

const isCoord = (s: string | null) => !!s && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(s);

export async function GET(req: NextRequest) {
  if (!KEY) return Response.json({ error: "KAKAO_REST_KEY 가 없어요" }, { status: 501 });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isCoord(from) || !isCoord(to)) return Response.json({ error: "from · to 는 'lng,lat'" }, { status: 400 });

  const q = new URLSearchParams({ origin: from!, destination: to!, priority: "RECOMMEND" });
  const res = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${q}`, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!res.ok) return Response.json({ error: `카카오 길찾기 실패 (${res.status})` }, { status: 502 });
  const route = ((await res.json()) as KakaoDirections).routes?.[0];
  if (!route || route.result_code !== 0 || !route.summary) return Response.json({ error: route?.result_msg ?? "길이 없어요" }, { status: 404 });

  // vertexes 는 [x, y, x, y, …] (경도, 위도 순)
  const path: [number, number][] = [];
  for (const s of route.sections ?? []) for (const r of s.roads) for (let i = 0; i + 1 < r.vertexes.length; i += 2) path.push([r.vertexes[i], r.vertexes[i + 1]]);

  return Response.json(
    { distanceM: route.summary.distance, durationMin: Math.max(1, Math.round(route.summary.duration / 60)), path },
    // 같은 구간은 하루 동안 다시 묻지 않는다 (교통 상황 반영 시간이라 너무 오래 두지는 않음)
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
