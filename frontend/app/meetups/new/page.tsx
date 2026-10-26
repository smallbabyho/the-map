import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetupNewPage } from "@/src/views/MeetupNewPage";

export const metadata: Metadata = { title: "모임 만들기" };

// ?mapId= 를 읽으므로 Suspense 로 감싼다.
export default function Page() {
  return (
    <Suspense>
      <MeetupNewPage />
    </Suspense>
  );
}
