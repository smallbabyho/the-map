import type { LatLng, XY } from './course'

// 이미지 카드 배경 지도. 카카오 지도 그림은 다른 사이트에서 캔버스로 가져갈 수 없어서(CORS 허용 안 함)
// 허용해 주는 OpenStreetMap 기본 타일을 쓴다. 출처 표시가 조건이다. (CARTO 는 이제 키 없이 요청하면 'API KEY REQUIRED' 그림을 준다)
// ⚠️ tile.openstreetmap.org 는 많이 쓰면 안 되는 공용 서버 (https://operations.osmfoundation.org/policies/tiles/).
//    서비스 오픈 전에 MapTiler · Stadia 같은 키 있는 타일로 tileUrl 만 바꾼다.

const TILE = 256
const tileUrl = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
export const BASEMAP_CREDIT = '© OpenStreetMap contributors'

/** 위경도 → 웹 메르카토르 세계 좌표 (줌 z, 타일 256px 기준) */
function world(p: LatLng, z: number): XY {
  const n = TILE * 2 ** z
  const s = Math.sin((Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180)
  return { x: ((p.lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }
}

export interface Viewport {
  z: number
  /** 세계 좌표 1px → 캔버스 몇 px (1~2: 타일을 2배 넘게 늘리면 흐려진다) */
  scale: number
  cx: number
  cy: number
  box: { x: number; y: number; w: number; h: number }
  project: (p: LatLng) => XY
}

/**
 * 점들이 상자(가장자리 pad 만큼 비움)에 꽉 차는 줌과 중심. 점이 하나뿐이면 골목이 보이는 정도(줌 17).
 *
 * @example
 * const vp = fitViewport(points, { x: 60, y: 470, w: 960, h: 900 }, 110)
 * vp.project({ lat: 37.54, lng: 127.05 }) // 캔버스 좌표
 */
export function fitViewport(points: LatLng[], box: Viewport['box'], pad: number): Viewport {
  const availW = box.w - pad * 2
  const availH = box.h - pad * 2
  let z = 17
  let scale = 1.5
  const spanAt = (zz: number) => {
    const w = points.map((p) => world(p, zz))
    const xs = w.map((p) => p.x)
    const ys = w.map((p) => p.y)
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  const s0 = spanAt(0)
  if (points.length > 1 && (s0.w > 0 || s0.h > 0)) {
    // 줌 0 에서의 크기로 꽉 차는 배율을 구하고, 그 배율이 1~2 가 되는 정수 줌을 고른다
    const fit = Math.min(s0.w ? availW / s0.w : Infinity, s0.h ? availH / s0.h : Infinity)
    z = Math.max(3, Math.min(19, Math.floor(Math.log2(fit))))
    scale = Math.min(2, fit / 2 ** z) // 줌 19 에서도 남으면 너무 키우지 않는다
  }
  const w = points.map((p) => world(p, z))
  const xs = w.map((p) => p.x)
  const ys = w.map((p) => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const project = (p: LatLng) => {
    const q = world(p, z)
    return { x: box.x + box.w / 2 + (q.x - cx) * scale, y: box.y + box.h / 2 + (q.y - cy) * scale }
  }
  return { z, scale, cx, cy, box, project }
}

function loadTile(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 8000)
    img.onload = () => (clearTimeout(timer), resolve(img))
    img.onerror = () => (clearTimeout(timer), resolve(null))
    img.src = src
  })
}

/**
 * 상자 안에 지도 타일을 깐다. 절반 넘게 못 받으면 false (부른 쪽이 모눈 배경으로 대신).
 * 상자 밖으로 나가는 부분은 부른 쪽에서 clip 해 둔다.
 */
export async function drawBasemap(ctx: CanvasRenderingContext2D, vp: Viewport): Promise<boolean> {
  const { box, scale, cx, cy, z } = vp
  const n = 2 ** z
  const left = cx - box.w / 2 / scale
  const top = cy - box.h / 2 / scale
  const tiles: { x: number; y: number }[] = []
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + box.h / scale) / TILE); ty++) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + box.w / scale) / TILE); tx++) {
      if (ty >= 0 && ty < n) tiles.push({ x: tx, y: ty })
    }
  }
  const imgs = await Promise.all(tiles.map((t) => loadTile(tileUrl(z, ((t.x % n) + n) % n, t.y))))
  const ok = imgs.filter(Boolean).length
  if (ok < tiles.length / 2) return false
  const size = TILE * scale
  tiles.forEach((t, i) => {
    const img = imgs[i]
    if (!img) return
    // 이웃 타일 사이에 실선이 비치지 않게 0.5px 겹친다
    ctx.drawImage(img, box.x + (t.x * TILE - left) * scale - 0.5, box.y + (t.y * TILE - top) * scale - 0.5, size + 1, size + 1)
  })
  return true
}
