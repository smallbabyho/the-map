// 이 프로젝트에서 쓰는 카카오맵 SDK 부분만 최소로 타입 선언. components/map/ 밖에서는 쓰지 않는다.
declare namespace kakao.maps {
  function load(callback: () => void): void

  class LatLng {
    constructor(lat: number, lng: number)
    getLat(): number
    getLng(): number
  }
  class Point {
    constructor(x: number, y: number)
    x: number
    y: number
  }
  interface MapProjection {
    coordsFromContainerPoint(point: Point): LatLng
    containerPointFromCoords(latlng: LatLng): Point
  }
  class LatLngBounds {
    constructor()
    extend(latlng: LatLng): void
  }
  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level?: number })
    setCenter(latlng: LatLng): void
    getCenter(): LatLng
    panTo(latlng: LatLng): void
    panBy(dx: number, dy: number): void
    setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void
    setLevel(level: number): void
    getLevel(): number
    relayout(): void
    getProjection(): MapProjection
  }
  class CustomOverlay {
    constructor(options: { position: LatLng; content: HTMLElement | string; yAnchor?: number; xAnchor?: number; zIndex?: number; clickable?: boolean })
    setMap(map: Map | null): void
  }
  class Circle {
    constructor(options: { center: LatLng; radius: number; strokeWeight?: number; strokeColor?: string; strokeOpacity?: number; fillColor?: string; fillOpacity?: number })
    setMap(map: Map | null): void
  }
  class Polyline {
    constructor(options: { path: LatLng[]; strokeWeight?: number; strokeColor?: string; strokeOpacity?: number; strokeStyle?: string })
    setMap(map: Map | null): void
  }
}

declare namespace kakao.maps.event {
  interface MouseEvent {
    latLng: LatLng
  }
  function addListener(target: Map, type: 'rightclick' | 'click' | 'dragstart' | 'zoom_start' | 'zoom_changed', handler: (e: MouseEvent) => void): void
  function removeListener(target: Map, type: 'rightclick' | 'click' | 'dragstart' | 'zoom_start' | 'zoom_changed', handler: (e: MouseEvent) => void): void
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
    /** location 을 주고 검색했을 때만: 그 지점에서 떨어진 거리(m) */
    distance?: string
  }
  interface PlacesSearchOptions {
    size?: number
    location?: kakao.maps.LatLng
    radius?: number
    sort?: 'accuracy' | 'distance'
  }
  interface Coord2AddressResult {
    address: { address_name: string } | null
    road_address: { address_name: string; building_name: string } | null
  }
  class Geocoder {
    coord2Address(lng: number, lat: number, callback: (result: Coord2AddressResult[], status: Status) => void): void
  }
  class Places {
    keywordSearch(keyword: string, callback: (data: PlaceResult[], status: Status) => void, options?: PlacesSearchOptions): void
    categorySearch(code: string, callback: (data: PlaceResult[], status: Status) => void, options?: PlacesSearchOptions): void
  }
}

interface Window {
  kakao?: typeof kakao
}
