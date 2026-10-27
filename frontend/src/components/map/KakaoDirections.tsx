import type { Place, TravelMode } from '../../types'

// 카카오맵 길찾기 링크 (https://apis.map.kakao.com/web/guide/#routeurl). 키 없이 쓰는 공개 링크라
// 휴대폰에서는 카카오맵 앱이 있으면 앱으로, 없으면 모바일 웹으로 열린다.

/** 링크 안에서 쉼표·슬래시는 구분자라 이름에서 뺀다 */
const part = (p: Pick<Place, 'name' | 'lat' | 'lng'>) => `${encodeURIComponent(p.name.replace(/[,/]/g, ' ').trim() || '장소')},${p.lat},${p.lng}`

/**
 * 카카오맵 길찾기 주소. from 이 없으면 카카오맵이 현재 위치에서 출발한다.
 *
 * @example
 * kakaoDirectionsUrl({ name: '성수역', lat: 37.5446, lng: 127.0559 })
 * // 'https://map.kakao.com/link/to/%EC%84%B1%EC%88%98%EC%97%AD,37.5446,127.0559'
 */
export function kakaoDirectionsUrl(to: Pick<Place, 'name' | 'lat' | 'lng'>, from?: Pick<Place, 'name' | 'lat' | 'lng'>) {
  return from ? `https://map.kakao.com/link/from/${part(from)}/to/${part(to)}` : `https://map.kakao.com/link/to/${part(to)}`
}

/** 카카오맵 이동수단 이름 */
const KAKAO_MODE: Record<TravelMode, string> = { transit: 'traffic', car: 'car', walk: 'walk', bike: 'bicycle' }

/**
 * 구간 길찾기 결과를 이동수단까지 맞춰서 여는 주소.
 *
 * @example
 * kakaoRouteUrl(성수역, 뚝섬역, 'transit')
 * // 'https://map.kakao.com/link/by/traffic/%EC%84%B1…,37.5446,127.0559/%EB%9A%9D…,37.5472,127.0473'
 */
export function kakaoRouteUrl(from: Pick<Place, 'name' | 'lat' | 'lng'>, to: Pick<Place, 'name' | 'lat' | 'lng'>, mode: TravelMode) {
  return `https://map.kakao.com/link/by/${KAKAO_MODE[mode]}/${part(from)}/${part(to)}`
}

/** 구간(이전 장소 → 이 장소)을 카카오맵에서 보는 작은 글자 링크 */
export function KakaoRouteLink({ from, to, mode, className = '' }: { from: Place; to: Place; mode: TravelMode; className?: string }) {
  return (
    <a
      href={kakaoRouteUrl(from, to, mode)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-0.5 font-semibold text-(--c-muted) hover:text-(--c-text) hover:underline ${className}`}
    >
      카카오맵에서 보기 ↗
    </a>
  )
}

/** 코스 장소 옆 '길찾기' 버튼. 이전 장소가 있으면 거기서 출발 (mode 를 주면 그 이동수단으로 결과까지) */
export function KakaoDirectionsLink({ to, from, mode }: { to: Place; from?: Place; mode?: TravelMode }) {
  return (
    <a
      href={from && mode ? kakaoRouteUrl(from, to, mode) : kakaoDirectionsUrl(to, from)}
      target="_blank"
      rel="noopener noreferrer"
      title={from ? `${from.name}에서 ${to.name}까지 카카오맵 길찾기` : `${to.name}까지 카카오맵 길찾기`}
      className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[0.6875rem] font-semibold text-(--c-muted) transition hover:bg-[#FEE500]/40 hover:text-(--c-text)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2 3 21l9-4 9 4z" />
      </svg>
      길찾기
    </a>
  )
}
