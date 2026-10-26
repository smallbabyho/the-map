import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallbackPage } from "@/src/views/AuthCallbackPage";

export const metadata: Metadata = { title: "로그인 중" };

// 카카오 · 네이버 · 구글 로그인에서 돌아오는 곳. ?next= 를 읽으므로 Suspense 로 감싼다.
export default function Page() {
  return (
    <Suspense>
      <AuthCallbackPage />
    </Suspense>
  );
}
