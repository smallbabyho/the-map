# 백엔드 (Supabase)

컨셉지도의 DB, 인증, 사진 저장소는 모두 Supabase를 씁니다. 따로 띄우는 서버는 없고,
이 폴더에는 **Supabase 설정과 DB 마이그레이션(SQL)** 만 있습니다.

```
backend/
  supabase/
    config.toml          로컬 Supabase(supabase start) 설정
    migrations/          테이블·권한·스토리지 SQL (파일 이름 순서대로 적용)
    .env.example         로컬 캡차 테스트용 비밀 키 자리 (선택)
```

프론트에서 쓰는 Supabase 클라이언트, 인증 함수, 데이터 함수(`src/lib/supabase.ts`, `src/auth/`, `src/db/index.ts`)는
`frontend/` (Next.js) 안에 들어 있습니다.

---

## 백엔드 설정

### 1. Supabase 프로젝트 만들기

1. <https://supabase.com/dashboard>에서 **New project**를 누릅니다. 리전은 `Northeast Asia (Seoul)`을 권장합니다.
2. DB 비밀번호는 팀 비밀번호 관리 도구에 저장합니다. 채팅이나 깃에는 올리지 마세요.
3. **Project Settings → API**에서 아래 두 값을 복사합니다.
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ `service_role` 키는 RLS를 무시하는 관리자 키입니다. **프론트 코드나 .env, 깃 어디에도 넣지 마세요.**

> 팀원끼리 같은 Supabase 프로젝트를 쓰면 1번은 한 사람만 하면 됩니다. 나머지 사람은 URL과 anon 키만 받아서 3번(.env)으로 넘어가세요.

### 2. SQL 적용 (테이블, 권한, 스토리지)

`backend/supabase/migrations/`의 SQL을 **파일 이름 순서대로** 적용합니다.
모든 파일은 여러 번 실행해도 에러가 나지 않게 작성했습니다.

**방법 A: 대시보드 SQL Editor (설치할 것 없음, 처음엔 이쪽 추천)**

1. 대시보드 → **SQL Editor** → **New query**
2. 아래 순서대로 파일 내용을 붙여넣고 **Run** 합니다.
   1. `20261023000100_tables.sql`
   2. `20261023000200_rls.sql`
   3. `20261023000300_place_upsert.sql`
   4. `20261023000400_profile_trigger.sql`
   5. `20261023000500_storage.sql`
3. **Table Editor**에 `profiles, maps, places, pins, legs`가 보이고, **Storage**에 `pin-photos` 버킷이 보이면 성공입니다.

**방법 B: Supabase CLI**

```bash
cd backend
npx supabase login
npx supabase link --project-ref <프로젝트 ref>   # 대시보드 URL의 /project/<여기> 부분
npx supabase db push                             # 아직 적용 안 된 마이그레이션만 적용
```

> 방법 A로 이미 적용한 프로젝트에서 나중에 B로 바꾸면, CLI가 "이미 적용됨" 기록을 몰라서 다시 실행하려고 합니다.
> SQL이 여러 번 실행해도 안전하게 짜여 있어서 그대로 `db push` 해도 됩니다.

**로컬 Supabase (선택, Docker 필요)**: `cd backend && npx supabase start`를 실행하면 마이그레이션이 자동 적용된 로컬 DB가 뜹니다.
출력되는 `API URL`과 `anon key`를 `frontend/.env.local`에 넣으면 됩니다. 로컬에서는 캡차가 꺼져 있습니다.

### 3. 캡차 설정 (Cloudflare Turnstile)

캡차 검증은 Supabase Auth 서버가 직접 하므로 **비밀 키는 Supabase 대시보드에만** 넣습니다.

1. **Turnstile 위젯 만들기**: <https://dash.cloudflare.com> → **Turnstile** → **Add widget**
   - Hostname: `the-map-bice.vercel.app` + `localhost`
   - Widget mode: `Managed`
   - 발급된 **Site Key**(공개용) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - 발급된 **Secret Key**(비밀) → 다음 단계에서 Supabase에 넣습니다. **깃이나 .env에 넣지 마세요.**
2. **Supabase에 연결**: 대시보드 → **Authentication → Attack Protection** → **Enable Captcha protection** 켜기
   - Provider: `Turnstile by Cloudflare`
   - Secret: 위의 Secret Key → **Save**
3. 이제 캡차 토큰이 없는 가입·로그인 요청은 Supabase가 거절합니다.
   프론트는 `<CaptchaWidget onVerify={...} />`에서 받은 토큰을 `signUp`/`signIn`에 넘기면 됩니다.

**개발용 테스트 키**: Cloudflare가 제공하는, 항상 통과하는 키 쌍입니다. 개발용 Supabase 프로젝트에서만 쓰세요.

| | 값 |
|---|---|
| Site Key (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) | `1x00000000000000000000AA` |
| Secret Key (Supabase 대시보드) | `1x0000000000000000000000000000000AA` |

> 두 키는 반드시 짝이 맞아야 합니다. 실제 Site Key에 테스트 Secret을 쓰거나 그 반대로 쓰면 로그인할 때마다 "캡차 실패"가 납니다.

### 4. 이메일 인증 / 리다이렉트 URL

- 대시보드 → **Authentication → URL Configuration**
  - Site URL: `https://the-map-bice.vercel.app`
  - Redirect URLs: `https://the-map-bice.vercel.app/**`, `http://localhost:3000/**`
- **Authentication → Sign In / Providers → Email**의 `Confirm email`이 켜져 있으면 가입 후 메일 인증을 해야 로그인됩니다.
  개발 중에 번거로우면 개발용 프로젝트에서만 끄세요.
- Supabase 기본 메일 발송은 시간당 몇 통으로 제한됩니다. 테스트 가입이 막히면 잠시 기다리거나 위 설정을 끄세요.

### 5. `.env.local` 항목 (`frontend/` 폴더)

`frontend/.env.example`을 복사해서 `frontend/.env.local`을 만들고 값을 채웁니다. `.env.local`은 커밋되지 않습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...        # anon public 키 (service_role 아님!)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA...       # Turnstile Site Key (Secret Key 아님!)
```

`NEXT_PUBLIC_`로 시작하는 값은 빌드 결과물에 그대로 들어가서 **누구나 볼 수 있습니다.**
그래서 공개해도 되는 값(anon 키, Site Key)만 넣고, 비밀 키는 절대 넣지 않습니다.
데이터 보호는 RLS가 담당합니다.

---

## DB 구조 요약

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `profiles` | `id`(= auth.users.id), `nickname` | 가입하면 트리거가 자동 생성 |
| `maps` | `id, owner_id, title, theme, is_public, created_at, updated_at` | `owner_id` 기본값은 로그인 사용자 |
| `places` | `id, external_id`(카카오 장소 ID, unique), `name, lat, lng` | 모든 지도가 공유 |
| `pins` | `id, map_id, place_id, sort_order, icon, color, memo, photo_url, visited_at` | 타입의 `order`는 DB에서 **`sort_order`** |
| `legs` | `id, map_id, from_pin_id, to_pin_id, mode, duration_min, is_manual` | `mode`: walk/bus/subway/car, (지도, 출발, 도착) unique |

**권한(RLS)**
- `maps`, `pins`, `legs`: `is_public = true`면 비로그인 사용자도 읽기 가능하고, 아니면 주인만 읽습니다. 생성, 수정, 삭제는 항상 주인만 할 수 있습니다.
- `places`: 누구나 읽고, 로그인한 사용자만 추가합니다. 추가할 때는 `get_or_create_place()` RPC를 쓰면 같은 `external_id`를 재사용합니다.
- `profiles`: 닉네임은 누구나 읽고, 수정은 본인만 합니다.
- Storage `pin-photos`: public 버킷이고, `{내 user id}/파일명` 경로에만 업로드할 수 있습니다. 용량은 5MB, 이미지만 허용합니다.
  - 비공개 지도의 사진도 URL을 알면 열립니다. 파일명은 추측할 수 없는 uuid로 만듭니다.

**지울 때 같이 지워지는 것**: 지도를 지우면 핀과 이동구간이 지워지고, 핀을 지우면 그 핀에 연결된 이동구간이 지워집니다. 탈퇴하면 프로필과 지도 전체가 지워집니다.

## 스키마를 바꿀 때

이미 적용한 마이그레이션 파일은 **수정하지 말고** 새 파일을 추가하세요.
다른 팀원 DB에는 옛 버전이 이미 적용돼 있어서, 파일을 고쳐도 반영되지 않습니다.

```bash
cd backend
npx supabase migration new add_something   # migrations/<타임스탬프>_add_something.sql 생성
```
