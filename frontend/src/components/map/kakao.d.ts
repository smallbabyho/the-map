// 이 프로젝트에서 쓰는 카카오맵 SDK 부분만 최소로 타입 선언. components/map/ 밖에서는 쓰지 않는다.
declare namespace kakao.maps {
  function load(callback: () => void): void

  class LatLng {
    constructor(lat: number, lng: number)
    getLat(): number
    getLng(): number
  }
  class LatLngBounds {
    constructor()
    extend(latlng: LatLng): void
  }
  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level?: number })
    setCenter(latlng: LatLng): void
    panTo(latlng: LatLng): void
    setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void
    setLevel(level: number): void
    getLevel(): number
    relayout(): void
  }
  class CustomOverlay {
    constructor(options: { position: LatLng; content: HTMLElement | string; yAnchor?: number; xAnchor?: number; zIndex?: number; clickable?: boolean })
    setMap(map: Map | null): void
  }
  class Polyline {
    constructor(options: { path: LatLng[]; strokeWeight?: number; strokeColor?: string; strokeOpacity?: number; strokeStyle?: string })
    setMap(map: Map | null): void
  }
}

declare namespace kakao.maps.services {
  enum Status {
    OK = 'OK',
    ZERO_RESULT = 'ZERO_RESULT',
    ERROR = 'ERROR',
  }
  interface PlaceResult {
    id: string
    place_name: string
    x: string // lng
    y: string // lat
    address_name: string
    road_address_name: string
    category_group_name: string
  }
  class Places {
    keywordSearch(keyword: string, callback: (data: PlaceResult[], status: Status) => void, options?: { size?: number }): void
  }
}

interface Window {
  kakao?: typeof kakao
}
