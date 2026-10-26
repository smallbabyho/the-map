import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfilePage } from "@/src/views/ProfilePage";

export const metadata: Metadata = { title: "프로필" };

// userId 는 요청 때 정해지므로 Suspense 로 감싼다 (cacheComponents 에서 useParams 가 필요로 함).
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ProfilePage />
    </Suspense>
  );
}
