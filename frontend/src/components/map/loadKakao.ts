// Next 는 빌드 때 process.env.NEXT_PUBLIC_* 를 실제 값으로 바꿔 넣는다 (frontend/.env.local).
const KEY = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? '').trim()

/** .env 에 카카오맵 키가 있는지 */
export const hasKakaoKey = KEY.length > 0

let promise: Promise<typeof kakao> | null = null

/** 카카오맵 SDK(+ services 라이브러리)를 한 번만 불러온다. 실패하면 다음 호출 때 다시 시도한다. */
export function loadKakao(): Promise<typeof kakao> {
  if (!hasKakaoKey) return Promise.reject(new Error('카카오맵 키가 없어요.'))
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao)
  if (promise) return promise

  promise = new Promise<typeof kakao>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&libraries=services&autoload=false`
    script.async = true
    const timer = window.setTimeout(() => fail('카카오맵 응답이 없어요.'), 10000)
    const fail = (msg: string) => {
      window.clearTimeout(timer)
      script.remove()
      promise = null
      reject(new Error(msg))
    }
    script.onerror = () => fail('카카오맵을 불러오지 못했어요. 키와 등록한 도메인을 확인해 주세요.')
    script.onload = () => {
      if (!window.kakao?.maps) return fail('카카오맵을 불러오지 못했어요. 키와 등록한 도메인을 확인해 주세요.')
      window.kakao.maps.load(() => {
        window.clearTimeout(timer)
        resolve(window.kakao!)
      })
    }
    document.head.appendChild(script)
  })
  return promise
}
