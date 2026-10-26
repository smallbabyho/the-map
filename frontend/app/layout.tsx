import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EARLY_APPEARANCE_SCRIPT } from "@/src/components/appearanceScript";
import { AppearanceSync } from "@/src/components/AppearanceSync";

export const metadata: Metadata = {
  title: "컨셉지도",
  description: "나만의 테마로 지도를 꾸미고 공유하는 컨셉지도",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      </body>
    </html>
  );
}
