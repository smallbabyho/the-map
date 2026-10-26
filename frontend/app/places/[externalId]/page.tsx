import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceDetailPage } from "@/src/views/PlaceDetailPage";

export const metadata: Metadata = { title: "장소 리뷰 · 컨셉지도" };

// externalId 는 요청 때 정해지므로 Suspense 로 감싼다 (cacheComponents 에서 useParams 가 필요로 함).
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <PlaceDetailPage />
    </Suspense>
  );
}
