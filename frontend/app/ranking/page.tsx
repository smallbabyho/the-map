import type { Metadata } from "next";
import { Suspense } from "react";
import { RankingPage } from "@/src/views/RankingPage";

export const metadata: Metadata = { title: "월간 지도 순위 · 컨셉지도" };

// '이번 달'을 접속 시점에 계산하므로 Suspense 로 감싼다 (cacheComponents: 렌더 중 new Date()).
export default function Page() {
  return (
    <Suspense>
      <RankingPage />
    </Suspense>
  );
}
