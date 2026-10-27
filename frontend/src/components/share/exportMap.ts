import type { ConceptMap, Leg, Pin } from '../../types'
import { formatMinutes, modeMeta } from '../legModes'

// 📤 지도 내보내기: 핀 목록을 다른 앱에서 쓰는 파일 · 글로 바꾼다 (전부 브라우저 안에서 만든다).
//   CSV  → 엑셀 · 구글 시트
//   KML  → 구글 내 지도(My Maps) · 구글 어스 가져오기
//   GPX  → 등산 · 자전거 · 내비 앱 (램블러, 트랭글, Strava 등)
//   텍스트 → 카톡 · 메모에 붙여 넣기 (장소마다 카카오맵 링크)

/** 구간은 이동수단 · 시간만 쓴다 (편집 중인 아직 저장 안 된 구간도 받게) */
type ExportLeg = Pick<Leg, 'fromPinId' | 'toPinId' | 'mode' | 'durationMin'>

export interface ExportData {
  map: ConceptMap
  pins: Pin[]
  legs: ExportLeg[]
}

export type ExportFormat = 'csv' | 'kml' | 'gpx'

const titleOf = (map: ConceptMap) => map.title || '제목 없는 지도'

/** 파일 이름에 못 쓰는 글자 빼기 */
export const fileBase = (map: ConceptMap) => titleOf(map).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 40) || 'My Concept Map'

/** 카카오 장소 id 면 장소 페이지, 아니면(직접 찍은 곳 · 샘플) 좌표로 */
export function kakaoLink(pin: Pin): string {
  const { externalId, name, lat, lng } = pin.place
  return /^\d+$/.test(externalId) ? `https://place.map.kakao.com/${externalId}` : `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
}

export const naverLink = (pin: Pin) => `https://map.naver.com/p/search/${encodeURIComponent(pin.place.name)}`

/** 핀 → 다음 핀으로 가는 구간 */
function legAfter(pins: Pin[], legs: ExportLeg[], i: number): ExportLeg | undefined {
  const next = pins[i + 1]
  return next && legs.find((l) => l.fromPinId === pins[i].id && l.toPinId === next.id)
}

const legText = (leg: ExportLeg | undefined) => (leg ? `${modeMeta(leg.mode).label}${leg.durationMin != null ? ` ${formatMinutes(leg.durationMin)}` : ''}` : '')

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv({ pins, legs }: ExportData): string {
  const head = ['순서', '이름', '아이콘', '메모', '다녀온 날', '다음 장소까지', '위도', '경도', '카카오맵', '네이버지도']
  const rows = pins.map((p, i) => [i + 1, p.place.name, p.icon, p.memo, p.visitedAt ?? '', legText(legAfter(pins, legs, i)), p.place.lat, p.place.lng, kakaoLink(p), naverLink(p)])
  // 앞의 BOM(﻿): 엑셀이 한글을 깨뜨리지 않게
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function toKml({ map, pins }: ExportData): string {
  const marks = pins
    .map(
      (p, i) => `    <Placemark>
      <name>${xml(`${i + 1}. ${p.icon} ${p.place.name}`)}</name>
      <description>${xml([p.memo, p.visitedAt && `다녀온 날 ${p.visitedAt}`, kakaoLink(p)].filter(Boolean).join('\n'))}</description>
      <Point><coordinates>${p.place.lng},${p.place.lat},0</coordinates></Point>
    </Placemark>`,
    )
    .join('\n')
  const line =
    pins.length > 1
      ? `
    <Placemark>
      <name>코스</name>
      <LineString><tessellate>1</tessellate><coordinates>${pins.map((p) => `${p.place.lng},${p.place.lat},0`).join(' ')}</coordinates></LineString>
    </Placemark>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(titleOf(map))}</name>
    <description>My Concept Map 에서 내보낸 지도</description>
${marks}${line}
  </Document>
</kml>
`
}

export function toGpx({ map, pins }: ExportData): string {
  const wpts = pins
    .map((p, i) => `  <wpt lat="${p.place.lat}" lon="${p.place.lng}"><name>${xml(`${i + 1}. ${p.place.name}`)}</name>${p.memo ? `<desc>${xml(p.memo)}</desc>` : ''}</wpt>`)
    .join('\n')
  const rte = pins.map((p) => `    <rtept lat="${p.place.lat}" lon="${p.place.lng}"><name>${xml(p.place.name)}</name></rtept>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="My Concept Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(titleOf(map))}</name></metadata>
${wpts}
  <rte>
    <name>${xml(titleOf(map))}</name>
${rte}
  </rte>
</gpx>
`
}

/** 카톡 · 메모용 글: 순서 · 이름 · 메모 · 다음 구간 · 카카오맵 링크 */
export function toText({ map, pins, legs }: ExportData, url?: string): string {
  const lines = pins.map((p, i) => {
    const leg = legText(legAfter(pins, legs, i))
    return [`${i + 1}. ${p.icon} ${p.place.name}`, p.memo && `   ${p.memo}`, `   ${kakaoLink(p)}`, leg && `   ↓ ${leg}`].filter(Boolean).join('\n')
  })
  return [`🗺️ ${titleOf(map)} (${pins.length}곳)`, '', ...lines, ...(url ? ['', `지도 보기: ${url}`] : [])].join('\n')
}

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  kml: 'application/vnd.google-earth.kml+xml',
  gpx: 'application/gpx+xml',
}

/** 파일로 내려받기 */
export function downloadExport(data: ExportData, format: ExportFormat) {
  const body = format === 'csv' ? toCsv(data) : format === 'kml' ? toKml(data) : toGpx(data)
  const url = URL.createObjectURL(new Blob([body], { type: MIME[format] }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBase(data.map)}.${format}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
