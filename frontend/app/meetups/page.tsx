import type { Metadata } from "next";
import { MeetupsPage } from "@/src/views/MeetupsPage";

export const metadata: Metadata = { title: "성지순례" };

export default function Page() {
  return <MeetupsPage />;
}
