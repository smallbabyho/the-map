import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetupRoomPage } from "@/src/views/MeetupRoomPage";

export const metadata: Metadata = { title: "순례방" };

// meetupId 는 요청 때 정해지므로 Suspense 로 감싼다 (cacheComponents 에서 useParams 가 필요로 함).
export default function Page() {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-black/[0.03]" />}>
      <MeetupRoomPage />
    </Suspense>
  );
}
