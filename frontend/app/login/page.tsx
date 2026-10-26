import type { Metadata } from "next";
import { LoginPage } from "@/src/views/LoginPage";

export const metadata: Metadata = { title: "로그인 · 컨셉지도" };

export default function Page() {
  return <LoginPage />;
}
