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
3. **JavaScript SDK 도메인**(예전 화면: 플랫폼 → Web → 사이트 도메인)에 `http://localhost:3000` 과 `https://myconceptmap.vercel.app` 등록
4. 지도가 안 뜨면 **카카오맵 사용 설정**이 켜져 있는지 확인 (새 앱은 따로 켜야 함)

### 사이트 주소 (도메인)

대표 주소는 **`https://myconceptmap.vercel.app`** 하나입니다. 외부 서비스에는 이 주소와 `localhost:3000` 만 등록합니다.
배포할 때마다 바뀌는 `the-xxxx-smallbabyho.vercel.app` 주소는 등록할 수 없어서, 거기서는 지도 · 공유 · 캡차가 안 될 수 있어요. 확인은 대표 주소에서 하세요.
(`the-map-smallbabyho.vercel.app` 로 들어오면 대표 주소로 자동 이동합니다 → `next.config.ts`)

| 어디 | 무엇 | 넣을 주소 |
|---|---|---|
| 카카오 개발자 콘솔 | JavaScript SDK 도메인 (지도 · 카카오톡 공유) | `https://myconceptmap.vercel.app`, `http://localhost:3000` |
| Cloudflare Turnstile | 위젯 Hostname (캡차) | `myconceptmap.vercel.app`, `localhost` |
| Supabase | Authentication → URL Configuration | Site URL `https://myconceptmap.vercel.app` · Redirect URLs `https://myconceptmap.vercel.app/**`, `http://localhost:3000/**` |
| ODsay | Web 플랫폼 URL (대중교통) | `https://myconceptmap.vercel.app`, `http://localhost:3000` |
| Vercel (Production) | 환경변수 `NEXT_PUBLIC_SITE_URL` | `https://myconceptmap.vercel.app` (공유 · 초대 링크, 인증 메일이 이 주소로 만들어짐) |

### 자주 막히는 것

- **화면이 이상하게 옛날 상태로 보일 때**: 개발 서버를 끄고 `rm -rf .next` 후 다시 `npm run dev`.
- **내 위치 버튼이 안 될 때**: 브라우저 주소창 왼쪽 아이콘에서 위치 권한을 허용하세요. (`localhost` 또는 `https` 에서만 동작)
- **데이터 초기화**: 지금은 브라우저 localStorage 에 저장됩니다. `/dev/api` 의 **데이터 초기화** 버튼을 누르세요.

### 체험 계정 (백엔드 연결 전 mock)

로그인 화면의 **체험 계정으로 채우기** 버튼을 눌러도 됩니다. 캡차는 Turnstile 키가 없으면 "로봇이 아닙니다" 체크박스로 대신해요.

| 이메일 | 비밀번호 | 역할 |
|---|---|---|
| `test@example.com` | `test1234` | 일반 회원 (테스터) |
| `bread@example.com` · `drama@example.com` · `cafe@example.com` | `test1234` | 샘플 지도·모임 주인 (다른 사람 역할 테스트용) |
| `admin@example.com` | `test1234` | 관리자 → `/admin` |

### 화면

| 주소 | 화면 |
|---|---|
| `/` | 내 지도 목록 |
| `/maps/:id` | 지도 편집 (내 지도) / 읽기 전용 (남의 공개 지도: 가져오기·성지순례 모집) |
| `/meetups` · `/meetups/:id` · `/meetups/new` | 성지순례 목록 · 상세 · 만들기 |
| `/ranking` | 월간 지도 순위 (다른 사람이 가져가거나 성지순례에 참여한 사람 수) |
| `/login` | 로그인 · 회원가입 · 내 계정 |
| `/admin` | 관리자: 현황 · 회원 관리 (admin 만) |
| `/dev/api` | **API 테스트 콘솔**: 데이터·로그인 함수를 골라 직접 실행하고 결과(JSON)를 확인, mock 데이터 초기화 |

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
  auth/                    로그인 (index.ts 로만 import, 지금은 mock.ts)
  lib/supabase.ts          (백엔드 연결 시)
```

- **`src/pages` 가 아니라 `src/views` 인 이유**: Next 는 `src/pages` 를 Pages Router 로 인식해 `app/` 과 같이 있으면 빌드가 실패합니다.
- **백엔드 연결**: `src/db/index.ts`(Supabase 버전)가 준비되면 `src/db/api.ts` 의 `'./mock'` 한 줄만 `'./index'` 로 바꾸면 됩니다.
- **지도 교체 (예: Mapbox)**: `src/components/map/` 안만 바꾸면 됩니다. 다른 곳은 `MapView`, `searchPlaces` 만 씁니다.
- **라이트/다크 · 색 테마**: 배경 라이트/다크는 보는 사람 설정(`src/components/appearance.ts`, 기본은 서울 기준 일출·일몰 자동, 색은 `app/globals.css` 의 `:root[data-mode="dark"]`). 지도에 저장되는 건 색 테마만(`themes.ts`: 프리셋 또는 직접 고른 `#rrggbb`). 새 화면은 `bg-white`·`text-gray-*` 대신 `bg-(--c-surface)`·`text-(--c-text)` 같은 변수를 쓰면 다크에서도 맞습니다.
- **길찾기 (핀 사이 경로)**: `src/components/map/routing.ts`. 도보·자전거·자동차는 OpenStreetMap 공개 길찾기 서버(키 없음, 개발용), 대중교통은 ODsay(`transit.ts`, `.env.local` 의 `NEXT_PUBLIC_ODSAY_KEY`)로 버스 번호·지하철 노선·환승·요금까지 보여주고, 키가 없으면 직선거리 예상치입니다. 도로 길찾기를 카카오모빌리티 등으로 바꿀 땐 `fetchRoad()` 만 고치면 됩니다.
