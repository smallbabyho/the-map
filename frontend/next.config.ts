import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // 관리자 화면은 /customers 로 옮겼다. 예전 주소로 들어와도 넘겨준다.
  async redirects() {
    return [{ source: "/admin", destination: "/customers", permanent: true }];
  },
};

export default nextConfig;
