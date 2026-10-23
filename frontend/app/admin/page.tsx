import type { Metadata } from "next";
import { AdminPage } from "@/src/views/AdminPage";

export const metadata: Metadata = { title: "관리자 · 컨셉지도" };

export default function Page() {
  return <AdminPage />;
}
