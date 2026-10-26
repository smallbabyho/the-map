import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/src/views/LoginPage";

export const metadata: Metadata = { title: "로그인" };

// ?next= 를 읽으므로 Suspense 로 감싼다 (cacheComponents 에서 useSearchParams 가 필요로 함).
export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
