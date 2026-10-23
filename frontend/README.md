# 컨셉지도 프론트엔드

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + 카카오맵.

## 개발 환경 실행

**준비물**: Node.js 20.9 이상

```bash
cd frontend
npm install                 # 1. 패키지 설치 (처음 한 번, package.json 이 바뀌면 다시)
cp .env.example .env.local  # 2. 환경변수 파일 만들기 → 아래 표를 보고 값 채우기
npm run dev                 # 3. 개발 서버 실행 → http://localhost:3000
```

### `.env.local` 항목

| 이름 | 설명 | 없으면 |
|---|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 **JavaScript 키** | 미리보기 지도 + 샘플 장소 검색으로 동작 (화면 확인은 가능) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 지금은 안 씀 (mock 데이터 사용 중) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | 〃 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile Site Key | 〃 |

- `.env.local` 은 커밋되지 않습니다. 키는 팀원끼리 따로 전달하세요.
- 값을 바꾸면 `npm run dev` 를 껐다 켜야 반영됩니다.
- Supabase · 캡차 설정은 [`backend/README.md`](../backend/README.md) 참고.

### 카카오맵 키 발급

1. <https://developers.kakao.com> → 내 애플리케이션 → 애플리케이션 추가
2. **앱 키 → JavaScript 키** 를 `NEXT_PUBLIC_KAKAO_MAP_KEY` 에 넣기
3. **플랫폼 → Web → 사이트 도메인** 에 `http://localhost:3000` (와 배포 주소) 등록
4. 지도가 안 뜨면 **카카오맵 사용 설정**이 켜져 있는지 확인 (새 앱은 따로 켜야 함)

### 자주 막히는 것

- **화면이 바뀐 코드를 반영하지 않을 때** (특히 `app/globals.css`): 개발 서버를 끄고 `rm -rf .next` 후 다시 `npm run dev`.
- **데이터 초기화**: 지금은 브라우저 localStorage 에 저장됩니다. 개발자도구 → Application → Local Storage → `the-map:mock-db:v1` 삭제.

### 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run build` | 배포용 빌드 (타입 검사 포함) |
| `npm run lint` | ESLint |

---

## 폴더 구조

```
app/                       라우트 (얇게: src/views 의 화면을 불러오기만 함)
  page.tsx                 /              내 지도 목록
  maps/[mapId]/page.tsx    /maps/:id      지도 편집
  login/page.tsx           /login         로그인 · 회원가입
  globals.css              공통 스타일 · 지도 마커 모양
src/
  types.ts                 공용 타입 (Map, Place, Pin, Leg …)
  views/                   화면 (MyMapsPage, MapEditorPage, LoginPage)
  components/
    map/                   지도 모듈 — 카카오 SDK 는 이 폴더 안에서만 사용 (index.ts 가 공개 API)
    editor/                편집 화면 부품 (검색, 핀 목록, 구간, 핀 꾸미기, 테마, 편집 상태 훅)
    themes.ts              테마 4종 (핀 색 · UI 색 · 지도 톤)
  db/
    api.ts                 ← 화면은 데이터 함수를 반드시 여기서 import
    mock.ts                localStorage 가짜 데이터 (백엔드 연결 전)
  auth/  lib/supabase.ts   (백엔드 담당)
```

- **`src/pages` 가 아니라 `src/views` 인 이유**: Next 는 `src/pages` 를 Pages Router 로 인식해 `app/` 과 같이 있으면 빌드가 실패합니다.
- **백엔드 연결**: `src/db/index.ts`(Supabase 버전)가 준비되면 `src/db/api.ts` 의 `'./mock'` 한 줄만 `'./index'` 로 바꾸면 됩니다.
- **지도 교체 (예: Mapbox)**: `src/components/map/` 안만 바꾸면 됩니다. 다른 곳은 `MapView`, `searchPlaces` 만 씁니다.
