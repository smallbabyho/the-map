import type { MetadataRoute } from "next";

// 폰 홈 화면에 앱처럼 설치될 때의 이름 · 아이콘 · 색 (PWA). 아이콘은 public/icons, 아이폰 아이콘은 app/apple-icon.png
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Concept Map · 세상을 누빈다",
    short_name: "Concept Map",
    description: "지도 위에 펼쳐지는 나만의 세상. 가고 싶은 곳은 계획하고, 다녀온 곳은 기록해요.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    background_color: "#f2eee4",
    theme_color: "#f2eee4",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
