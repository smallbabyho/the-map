import type { Metadata } from "next";
import { ExplorePage } from "@/src/views/ExplorePage";

export const metadata: Metadata = { title: "둘러보기" };

export default function Page() {
  return <ExplorePage />;
}
