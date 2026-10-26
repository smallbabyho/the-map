// 카카오톡 공유 (Kakao JS SDK 의 Share). 지도 SDK 와 같은 JavaScript 키를 쓴다 (NEXT_PUBLIC_KAKAO_MAP_KEY).
// 카카오 개발자 콘솔 → 앱 → 플랫폼 → Web 에 사이트 도메인이 등록돼 있어야 공유 창이 뜬다.

const KEY = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? '').trim()
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

export const hasKakaoShare = KEY.length > 0

interface KakaoSdk {
  init: (key: string) => void
  isInitialized: () => boolean
  Share: { sendDefault: (settings: Record<string, unknown>) => void }
}
declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}

let promise: Promise<KakaoSdk> | null = null

function loadSdk(): Promise<KakaoSdk> {
  if (window.Kakao?.Share) return Promise.resolve(window.Kakao)
  if (promise) return promise
  promise = new Promise<KakaoSdk>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => (window.Kakao ? resolve(window.Kakao) : reject(new Error('카카오톡 공유를 불러오지 못했어요.')))
    script.onerror = () => {
      promise = null
      script.remove()
      reject(new Error('카카오톡 공유를 불러오지 못했어요.'))
    }
    document.head.appendChild(script)
  })
  return promise
}

export interface KakaoShareInput {
  title: string
  description: string
  /** 절대 주소. 카카오 서버가 가져갈 수 있어야 해서 localhost 에서는 그림이 빠진다 */
  imageUrl: string
  /** 눌렀을 때 열 주소 (절대 주소) */
  url: string
  buttonTitle: string
}

/**
 * 카카오톡 공유 창 열기 (피드 카드: 그림 + 제목 + 설명 + 버튼).
 *
 * @example
 * await shareToKakao({ title: '성수 빵지순례', description: '10월 30일 · 성수역', imageUrl, url: location.href, buttonTitle: '모임 보기' })
 */
export async function shareToKakao(input: KakaoShareInput): Promise<void> {
  if (!hasKakaoShare) throw new Error('카카오 키가 없어요.')
  const Kakao = await loadSdk()
  if (!Kakao.isInitialized()) Kakao.init(KEY)
  const link = { mobileWebUrl: input.url, webUrl: input.url }
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: { title: input.title, description: input.description, imageUrl: input.imageUrl, imageWidth: 800, imageHeight: 400, link },
    buttons: [{ title: input.buttonTitle, link }],
  })
}
