import { Suspense } from "react";
import { EditorLoading, MapEditorPage } from "@/src/views/MapEditorPage";

// mapId 는 요청 때 정해지므로 Suspense 로 감싼다 (cacheComponents 에서 useParams 가 필요로 함).
export default function Page() {
  return (
    <Suspense fallback={<EditorLoading />}>
      <MapEditorPage />
    </Suspense>
  );
}
