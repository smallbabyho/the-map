import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorePage } from "@/src/views/ExplorePage";

export const metadata: Metadata = { title: "둘러보기" };

// 검색어(?q=)를 읽어서 Suspense 안에 둔다 (Cache Components 에서 페이지를 막지 않게)
export default function Page() {
  return (
    <Suspense>
      <ExplorePage />
    </Suspense>
  );
}
