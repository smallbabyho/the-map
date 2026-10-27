import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // 개발 서버 화면 구석의 Next.js 아이콘 끄기 (컴파일 · 실행 오류 창은 그대로 뜬다)
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // 서비스 워커(public/sw.js)는 항상 새로 받게 (예전 것이 남아 앱이 안 바뀌는 일이 없게)
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // 관리자 화면은 /customers 로 옮겼다. 예전 주소로 들어와도 넘겨준다.
      { source: "/admin", destination: "/customers", permanent: true },
      // 검색 · 이달의 순위는 둘러보기 한 화면으로 합쳤다 (?q= 는 그대로 넘어간다)
      { source: "/search", destination: "/explore", permanent: false },
      { source: "/ranking", destination: "/explore", permanent: false },
      // 대표 주소는 myconceptmap.vercel.app 하나. Vercel 이 붙여주는 다른 고정 주소로 들어오면 넘겨준다.
      {
        source: "/:path*",
        has: [{ type: "host", value: "the-map-smallbabyho.vercel.app" }],
        destination: "https://myconceptmap.vercel.app/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
