import { formatMinutes, modeMeta } from '../legModes'
import { cachedRoute } from '../map'
import type { Theme } from '../themes'
import type { ConceptMap, Leg, Pin } from '../../types'
import { BASEMAP_CREDIT, drawBasemap, fitViewport } from './basemap'
import type { LatLng } from './course'

// 인스타 스토리 크기(1080×1920) 이미지 카드: 제목 + 코스 전체가 꽉 차게 그린 지도 + 코스 목록.
// 배경 지도는 CARTO 타일(basemap.ts). 못 받으면 테마 색 모눈으로 대신한다.
// 이미 받아 둔 실제 길(cachedRoute)이 있으면 그 모양으로, 없으면 핀끼리 직선. 새로 길찾기를 부르지 않는다.

export const STORY_W = 1080
export const STORY_H = 1920

const MAP = { x: 60, y: 470, w: 960, h: 900, r: 44 }
const LIST_Y = 1420
const LIST_ROWS = 6
const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif'

export interface StoryCardData {
  map: ConceptMap
  pins: Pin[]
  legs: Pick<Leg, 'fromPinId' | 'toPinId' | 'mode' | 'durationMin'>[]
  theme: Theme
  ownerName?: string
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 그림 비율을 지키며 상자를 꽉 채우기 (넘치는 부분은 잘림) */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** 한글은 띄어쓰기 없이도 줄바꿈되게 글자 단위로 자른다. maxLines 를 넘으면 … */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      lines.push(line)
      line = ch.trimStart()
      if (lines.length === maxLines) break
    } else line += ch
  }
  if (lines.length < maxLines && line) lines.push(line)
  const used = lines.join('').length
  if (used < [...text].length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  return wrap(ctx, text, maxW, 1)[0] ?? ''
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/**
 * 캔버스에 스토리 카드를 그린다 (1080×1920).
 *
 * @example
 * const canvas = document.createElement('canvas')
 * await drawStoryCard(canvas, { map, pins, legs, theme, ownerName: '빵순이' })
 * canvas.toBlob((b) => …, 'image/png')
 */
export async function drawStoryCard(canvas: HTMLCanvasElement, { map, pins, legs, theme, ownerName }: StoryCardData): Promise<void> {
  canvas.width = STORY_W
  canvas.height = STORY_H
  const ctx = canvas.getContext('2d')!
  // 글꼴이 늦게 오면 기본 글꼴로 그려지니 먼저 기다린다
  await Promise.all([document.fonts.load(`800 80px ${FONT}`), document.fonts.load(`600 36px ${FONT}`)]).catch(() => {})
  const cover = map.coverUrl ? await loadImage(map.coverUrl) : null

  // 배경: 테마색을 아주 살짝 섞은 종이색
  ctx.fillStyle = '#f7f5f1'
  ctx.fillRect(0, 0, STORY_W, STORY_H)
  ctx.fillStyle = `${theme.accent}14`
  ctx.fillRect(0, 0, STORY_W, STORY_H)

  // ---- 머리: 커버 이미지가 있으면 그 위에 흰 글자 ----
  const headH = 430
  if (cover) {
    drawCover(ctx, cover, 0, 0, STORY_W, headH + 120)
    const g = ctx.createLinearGradient(0, 0, 0, headH + 120)
    g.addColorStop(0, 'rgba(0,0,0,0.15)')
    g.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, STORY_W, headH + 120)
  }
  const ink = cover ? '#ffffff' : '#111827'
  const sub = cover ? 'rgba(255,255,255,0.8)' : '#6b7280'

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.accent
  roundRect(ctx, 60, 110, 30, 30, 15)
  ctx.fill()
  ctx.fillStyle = sub
  ctx.font = `700 30px ${FONT}`
  ctx.fillText('CONCEPT MAP · 컨셉지도', 106, 136)

  ctx.fillStyle = ink
  ctx.font = `800 84px ${FONT}`
  const titleLines = wrap(ctx, map.title || '제목 없는 지도', STORY_W - 120, 2)
  titleLines.forEach((l, i) => ctx.fillText(l, 60, 250 + i * 100))

  const totalMin = legs.reduce((s, l) => s + (l.durationMin ?? 0), 0)
  ctx.fillStyle = sub
  ctx.font = `600 34px ${FONT}`
  const meta = [ownerName && `by ${ownerName}`, `장소 ${pins.length}곳`, totalMin > 0 && `이동 약 ${formatMinutes(totalMin)}`].filter(Boolean).join('  ·  ')
  ctx.fillText(meta, 60, 250 + titleLines.length * 100 + 6)

  // ---- 지도: 코스 전체가 상자에 꽉 차게 ----
  ctx.save()
  roundRect(ctx, MAP.x, MAP.y, MAP.w, MAP.h, MAP.r)
  ctx.shadowColor = 'rgba(15,23,42,0.18)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 16
  ctx.fillStyle = '#eef1f5'
  ctx.fill()
  ctx.restore()

  // 구간마다 실제 길(받아 둔 것만) 또는 직선
  const at = (p: Pin): LatLng => ({ lat: p.place.lat, lng: p.place.lng })
  const segs = pins.slice(1).map((to, i) => {
    const from = pins[i]
    const leg = legs.find((l) => l.fromPinId === from.id && l.toPinId === to.id)
    const mode = leg?.mode ?? 'walk'
    const route = cachedRoute(at(from), at(to), mode)
    return { mode, path: route && route.path.length >= 2 ? route.path : [at(from), at(to)] }
  })
  // 핀 + 길의 모든 점을 함께 맞춰 넣어야 길이 상자 밖으로 안 나간다
  const all = [...pins.map(at), ...segs.flatMap((s) => s.path)]
  const vp = fitViewport(all, MAP, 110)
  const xy = all.map(vp.project)

  ctx.save()
  roundRect(ctx, MAP.x, MAP.y, MAP.w, MAP.h, MAP.r)
  ctx.clip()
  const hasMap = await drawBasemap(ctx, vp)
  if (hasMap) {
    // 지도 위에 테마색을 아주 살짝 덮어 카드 색과 어울리게
    ctx.fillStyle = `${theme.accent}12`
    ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h)
  } else {
    ctx.fillStyle = `${theme.accent}10`
    ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h)
    ctx.strokeStyle = `${theme.accent}26`
    ctx.lineWidth = 2
    for (let x = MAP.x; x < MAP.x + MAP.w; x += 60) {
      ctx.beginPath()
      ctx.moveTo(x, MAP.y)
      ctx.lineTo(x, MAP.y + MAP.h)
      ctx.stroke()
    }
    for (let y = MAP.y; y < MAP.y + MAP.h; y += 60) {
      ctx.beginPath()
      ctx.moveTo(MAP.x, y)
      ctx.lineTo(MAP.x + MAP.w, y)
      ctx.stroke()
    }
  }
  const pinXY = xy.slice(0, pins.length)
  let k = pins.length
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const s of segs) {
    const pts = xy.slice(k, k + s.path.length)
    k += s.path.length
    const trace = () => {
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    }
    ctx.setLineDash([])
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 22
    trace()
    ctx.stroke()
    const dash = modeMeta(s.mode).line.svg
    ctx.setLineDash(dash === '0.1 9' ? [0.1, 22] : dash ? [28, 16] : [])
    ctx.strokeStyle = theme.route
    ctx.lineWidth = 12
    trace()
    ctx.stroke()
  }
  ctx.setLineDash([])

  // 핀: 색 동그라미 + 이모지 + 순번
  pins.forEach((p, i) => {
    const { x, y } = pinXY[i]
    ctx.save()
    ctx.shadowColor = 'rgba(15,23,42,0.3)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 6
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, 42, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(x, y, 35, 0, Math.PI * 2)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `38px ${FONT}`
    ctx.fillText(p.icon, x, y + 2)
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.arc(x + 32, y - 32, 19, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 22px ${FONT}`
    ctx.fillText(String(i + 1), x + 32, y - 31)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  })
  if (hasMap) {
    // 지도 출처 (CARTO · OpenStreetMap 사용 조건)
    ctx.font = `500 18px ${FONT}`
    const w = ctx.measureText(BASEMAP_CREDIT).width + 20
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    roundRect(ctx, MAP.x + MAP.w - w - 24, MAP.y + MAP.h - 50, w, 30, 8)
    ctx.fill()
    ctx.fillStyle = '#4b5563'
    ctx.fillText(BASEMAP_CREDIT, MAP.x + MAP.w - w - 14, MAP.y + MAP.h - 29)
  }
  ctx.restore()

  // ---- 코스 목록 ----
  const rows = pins.slice(0, LIST_ROWS)
  const rowH = pins.length > LIST_ROWS ? 64 : 70
  rows.forEach((p, i) => {
    const y = LIST_Y + i * rowH
    ctx.fillStyle = theme.accent
    ctx.beginPath()
    ctx.arc(84, y + 22, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = theme.accentText
    ctx.textAlign = 'center'
    ctx.font = `800 24px ${FONT}`
    ctx.fillText(String(i + 1), 84, y + 31)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#111827'
    ctx.font = `700 36px ${FONT}`
    ctx.fillText(ellipsis(ctx, `${p.icon} ${p.place.name}`, 640), 128, y + 35)
    const leg = legs.find((l) => l.fromPinId === p.id && l.toPinId === pins[i + 1]?.id)
    if (leg?.durationMin) {
      ctx.fillStyle = '#6b7280'
      ctx.font = `600 30px ${FONT}`
      ctx.textAlign = 'right'
      ctx.fillText(`↓ ${modeMeta(leg.mode).icon} ${formatMinutes(leg.durationMin)}`, STORY_W - 60, y + 34)
      ctx.textAlign = 'left'
    }
  })
  if (pins.length > LIST_ROWS) {
    ctx.fillStyle = '#6b7280'
    ctx.font = `600 30px ${FONT}`
    ctx.fillText(`외 ${pins.length - LIST_ROWS}곳 더`, 128, LIST_Y + LIST_ROWS * rowH + 28)
  }

  // ---- 바닥 ----
  ctx.fillStyle = '#9ca3af'
  ctx.font = `600 28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(`📍 컨셉지도 · ${window.location.host}`, STORY_W / 2, STORY_H - 60)
  ctx.textAlign = 'left'
}
