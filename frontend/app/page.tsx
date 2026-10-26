import { MyMapsPage } from "@/src/views/MyMapsPage";

// 라우트 파일은 얇게 두고, 실제 화면은 src/views 에 둔다.
// (약속한 이름은 src/pages 였지만 Next 가 Pages Router 로 인식해 빌드가 막혀서 views 로 바꿈)
export default function Page() {
  return <MyMapsPage />;
}
