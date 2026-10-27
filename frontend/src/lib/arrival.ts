// 성지순례 도착 인증: 지금 위치(GPS) · 사진 촬영 정보(EXIF)를 읽는다. 거리 판정은 서버(checkin_meetup_pin)가 다시 한다.
// ⚠️ ARRIVAL_RADIUS_M 은 DB 함수 public.checkin_meetup_pin (20261027000300_checkin_verify.sql) 의 300 과 맞춘다.

export const ARRIVAL_RADIUS_M = 300

/** 두 좌표 사이 거리(m), 가까운 거리용 근사 (DB 함수와 같은 식) */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 111320
  const dx = (a.lng - b.lng) * 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

/** 지금 위치. 권한 거부 · 시간 초과면 한국어 에러 */
export function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('이 브라우저는 위치를 확인할 수 없어요. 사진으로 인증해 주세요.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 위치를 허용하거나 사진으로 인증해 주세요.'
              : '위치를 확인하지 못했어요. 밖으로 나가서 다시 시도하거나 사진으로 인증해 주세요.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  })
}

export interface PhotoInfo {
  lat: number | null
  lng: number | null
  /** 촬영 시각 (사진에 적힌 현지 시각) */
  takenAt: Date | null
}

/**
 * JPEG 사진의 EXIF 에서 촬영 위치 · 시각 읽기. 정보가 없으면 null 값.
 * 휴대폰 카메라의 '위치 태그'가 켜져 있어야 위치가 들어간다.
 */
export async function readPhotoInfo(file: File): Promise<PhotoInfo> {
  const none: PhotoInfo = { lat: null, lng: null, takenAt: null }
  const buf = await file.slice(0, 256 * 1024).arrayBuffer()
  const v = new DataView(buf)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return none // JPEG 아님 (HEIC 등)
  let off = 2
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off)
    const size = v.getUint16(off + 2)
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10) ?? none // 'Exif'
    if ((marker & 0xff00) !== 0xff00) break
    off += 2 + size
  }
  return none
}

function parseTiff(v: DataView, start: number): PhotoInfo | null {
  if (start + 8 > v.byteLength) return null
  const le = v.getUint16(start) === 0x4949
  const u16 = (o: number) => v.getUint16(start + o, le)
  const u32 = (o: number) => v.getUint32(start + o, le)
  const ok = (o: number, n: number) => start + o + n <= v.byteLength

  /** IFD 를 읽어 tag → (type, count, 값 위치) */
  const readIfd = (o: number) => {
    const tags = new Map<number, { type: number; count: number; at: number }>()
    if (!ok(o, 2)) return tags
    const n = u16(o)
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12
      if (!ok(e, 12)) break
      const type = u16(e + 2)
      const count = u32(e + 4)
      const bytes = count * ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] ?? 1)
      tags.set(u16(e), { type, count, at: bytes > 4 ? u32(e + 8) : e + 8 })
    }
    return tags
  }
  const ascii = (t?: { count: number; at: number }) => {
    if (!t || !ok(t.at, t.count)) return ''
    let s = ''
    for (let i = 0; i < t.count; i++) {
      const c = v.getUint8(start + t.at + i)
      if (!c) break
      s += String.fromCharCode(c)
    }
    return s
  }
  const rationals = (t?: { count: number; at: number }) => {
    if (!t || !ok(t.at, t.count * 8)) return null
    return Array.from({ length: t.count }, (_, i) => {
      const d = u32(t.at + i * 8 + 4)
      return d ? u32(t.at + i * 8) / d : 0
    })
  }

  const ifd0 = readIfd(u32(4))
  const info: PhotoInfo = { lat: null, lng: null, takenAt: null }

  const exifPtr = ifd0.get(0x8769)
  if (exifPtr) {
    const exif = readIfd(u32(exifPtr.at))
    // 'YYYY:MM:DD HH:MM:SS' (현지 시각)
    const m = ascii(exif.get(0x9003) ?? exif.get(0x9004)).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (m) info.takenAt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  }
  const gpsPtr = ifd0.get(0x8825)
  if (gpsPtr) {
    const gps = readIfd(u32(gpsPtr.at))
    const lat = rationals(gps.get(2))
    const lng = rationals(gps.get(4))
    const latRef = gps.get(1)
    const lngRef = gps.get(3)
    if (lat?.length === 3 && lng?.length === 3) {
      const deg = ([d, mi, s]: number[]) => d + mi / 60 + s / 3600
      const sign = (t: { at: number } | undefined, neg: string) => (t && ok(t.at, 1) && String.fromCharCode(v.getUint8(start + t.at)) === neg ? -1 : 1)
      info.lat = sign(latRef, 'S') * deg(lat)
      info.lng = sign(lngRef, 'W') * deg(lng)
      if (!info.lat && !info.lng) info.lat = info.lng = null
    }
  }
  return info
}
