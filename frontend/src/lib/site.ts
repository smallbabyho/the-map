// 사이트 대표 주소. 공유 링크 · 초대 링크 · 인증 메일은 어느 주소로 들어왔든 이 주소로 만든다.
// Vercel Production 에 NEXT_PUBLIC_SITE_URL=https://myconceptmap.vercel.app 이 있고,
// 로컬(.env.local)에서는 비워둬서 지금 열어둔 주소(localhost:3000)를 쓴다.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '')

/** 링크에 쓸 사이트 주소 (끝에 / 없음). 브라우저에서만 부른다. */
export function siteOrigin(): string {
  return SITE_URL || window.location.origin
}
