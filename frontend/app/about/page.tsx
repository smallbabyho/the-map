import type { Metadata } from "next";
import { LandingPage } from "@/src/views/LandingPage";

export const metadata: Metadata = { title: { absolute: "My Concept Map · 지도 위에 펼쳐지는 나만의 세상" } };

export default function Page() {
  return <LandingPage />;
}
