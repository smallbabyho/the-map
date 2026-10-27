import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { EARLY_APPEARANCE_SCRIPT } from "@/src/components/appearanceScript";
import { AppearanceSync } from "@/src/components/AppearanceSync";
import { Messenger } from "@/src/components/messenger/Messenger";
import { PwaSetup } from "@/src/components/pwa";

export const metadata: Metadata = {
  // 각 페이지는 '성지순례' 처럼 앞부분만 정하면 뒤에 사이트 이름이 붙는다
  title: { default: "My Concept Map", template: "%s · My Concept Map" },
  description: "지도 위에 펼쳐지는 나만의 세상, My Concept Map",
  // 홈 화면 앱(PWA): 아이폰에서 전체 화면으로 열리게. 앱 정보는 app/manifest.ts
  appleWebApp: { capable: true, title: "Concept Map", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // 폰 상단 상태바 · 앱 전환 화면 색 (배경색과 같게)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2eee4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-mode(라이트/다크)는 아래 스크립트가 그리기 전에 정한다 → 서버 HTML 과 달라서 경고 끔
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        {/* 밤에 흰 화면이 번쩍이지 않게 첫 그리기 전에 라이트/다크 결정 */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_APPEARANCE_SCRIPT }} />
        {/* 영문 포인트 제목(기울인 세리프) · 모노 라벨 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- 루트 레이아웃이라 모든 화면에 적용됨 (pages/_document 규칙 오탐) */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,900;1,900&display=swap" />
        {/* 한글 폰트: Pretendard (필요한 글자만 내려받는 dynamic subset) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        {children}
        <AppearanceSync />
        <PwaSetup />
        {/* 💬 떠 있는 버튼: 주소(usePathname)를 읽어서 Suspense 안에 둔다 (Cache Components 에서 페이지를 막지 않게) */}
        <Suspense fallback={null}>
          <Messenger />
        </Suspense>
      </body>
    </html>
  );
}
