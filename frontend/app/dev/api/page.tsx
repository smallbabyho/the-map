import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiTestPage } from "@/src/views/ApiTestPage";

export const metadata: Metadata = { title: "API 테스트" };

export default function Page() {
  return (
    <Suspense>
      <ApiTestPage />
    </Suspense>
  );
}
