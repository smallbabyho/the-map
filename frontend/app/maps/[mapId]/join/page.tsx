import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinMapPage } from "@/src/views/JoinMapPage";

export const metadata: Metadata = { title: "함께 꾸미기 초대 · 컨셉지도" };

// mapId · code 는 요청 때 정해지므로 Suspense 로 감싼다 (cacheComponents 에서 useParams · useSearchParams 가 필요로 함).
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <JoinMapPage />
    </Suspense>
  );
}
