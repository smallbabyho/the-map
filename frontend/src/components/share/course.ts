// 코스(핀 좌표)를 그림 상자 안에 맞춰 넣기. 공유 썸네일(/api/og/map)과 이미지 카드가 같이 쓴다.

export interface LatLng {
  lat: number
  lng: number
}
export interface XY {
  x: number
  y: number
}

/**
 * 위경도 → 상자(w × h) 안의 좌표. 가로세로 비율을 지키고 가운데 맞춤, 가장자리는 pad 만큼 비운다.
 * 위도에 따라 경도 1도의 실제 길이가 짧아지는 것(cos)을 반영해서 코스 모양이 찌그러지지 않는다.
 *
 * @example
 * fitCourse([{ lat: 37.54, lng: 127.05 }, { lat: 37.55, lng: 127.04 }], 800, 400, 60)
 * // [{ x: 460, y: 340 }, { x: 340, y: 60 }]
 */
export function fitCourse(points: LatLng[], w: number, h: number, pad: number): XY[] {
  if (points.length === 0) return []
  const k = Math.cos((points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180))
  const raw = points.map((p) => ({ x: p.lng * k, y: -p.lat }))
  const xs = raw.map((p) => p.x)
  const ys = raw.map((p) => p.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const spanX = maxX - minX
  const spanY = maxY - minY
  // 핀이 하나뿐이거나 한 점에 몰려 있으면 가운데
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min((w - pad * 2) / (spanX || Infinity), (h - pad * 2) / (spanY || Infinity))
  const offX = (w - spanX * scale) / 2
  const offY = (h - spanY * scale) / 2
  return raw.map((p) => ({ x: Math.round(offX + (p.x - minX) * scale), y: Math.round(offY + (p.y - minY) * scale) }))
}

/** 썸네일 주소에 넣을 코스 문자열: 0~1000 정수 "x,y;x,y" (2:1 상자 기준, 최대 12개) */
export function encodeCourse(points: LatLng[]): string {
  return fitCourse(points.slice(0, 12), 1000, 500, 70)
    .map((p) => `${p.x},${p.y}`)
    .join(';')
}

export function decodeCourse(s: string | null): XY[] {
  if (!s) return []
  return s
    .split(';')
    .slice(0, 12)
    .map((pair) => pair.split(',').map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y]) => ({ x: Math.min(1000, Math.max(0, x)), y: Math.min(500, Math.max(0, y)) }))
}
