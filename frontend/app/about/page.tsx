import type { Metadata } from "next";
import { LandingPage } from "@/src/views/LandingPage";

export const metadata: Metadata = { title: "컨셉지도 · 나만의 테마로 지도를 꾸미다" };

export default function Page() {
  return <LandingPage />;
}
