import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      // 관리자 화면은 /customers 로 옮겼다. 예전 주소로 들어와도 넘겨준다.
      { source: "/admin", destination: "/customers", permanent: true },
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
