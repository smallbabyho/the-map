import { Suspense } from "react";
import { MeetupDetailPage, MeetupLoading } from "@/src/views/MeetupDetailPage";

// meetupId 는 요청 때 정해지므로 Suspense 로 감싼다.
export default function Page() {
  return (
    <Suspense fallback={<MeetupLoading />}>
      <MeetupDetailPage />
    </Suspense>
  );
}
