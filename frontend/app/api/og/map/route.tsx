import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { decodeCourse } from "@/src/components/share/course";
import { getTheme } from "@/src/components/themes";

// 공유 썸네일 (카카오톡 · 링크 미리보기): 테마 색 모눈 위에 실제 코스 모양 + 제목.
// 지도 데이터는 아직 브라우저(mock)에 있어서, 화면이 코스를 주소에 담아 보낸다.
//
// GET /api/og/map?t=제목&s=부제&th=테마&p=x,y;x,y  (p 는 0~1000 × 0~500, share/course.ts 의 encodeCourse)

const W = 800;
const H = 400;

/** 한글 글꼴: 필요한 글자만 Google Fonts 에서 받아온다 (user-agent 없이 요청하면 ttf 를 준다) */
async function koreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const title = (q.get("t") ?? "").slice(0, 40) || "컨셉지도";
  const sub = (q.get("s") ?? "").slice(0, 60);
  const theme = getTheme(q.get("th") ?? undefined);
  // 코스는 아래 제목 띠(약 110px)를 피해 위쪽에, 비율을 지켜 가운데로
  const area = H - 110;
  const k = Math.min(W / 1000, area / 500);
  const pts = decodeCourse(q.get("p")).map((p) => ({ x: (W - 1000 * k) / 2 + p.x * k, y: 8 + p.y * k }));
  const font = await koreanFont(`${title}${sub}컨셉지도0123456789`);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          position: "relative",
          backgroundColor: "#eef1f5",
          backgroundImage: `linear-gradient(${theme.accent}22 1px, transparent 1px), linear-gradient(90deg, ${theme.accent}22 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          fontFamily: font ? "Noto Sans KR" : undefined,
        }}
      >
        {pts.length > 1 && (
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={theme.route}
              strokeWidth={7}
              strokeOpacity={0.85}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="14 10"
            />
          </svg>
        )}
        {pts.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x - 18,
              top: p.y - 18,
              width: 36,
              height: 36,
              borderRadius: 18,
              background: theme.accent,
              color: theme.accentText,
              border: "4px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            {i + 1}
          </div>
        ))}
        {/* 제목 띠 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            padding: "22px 32px",
            background: "linear-gradient(transparent, rgba(17,24,39,0.82))",
            color: "white",
          }}
        >
          <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1 }}>{title}</div>
          {sub && <div style={{ fontSize: 22, opacity: 0.85, marginTop: 4 }}>{sub}</div>}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    },
  );
}
