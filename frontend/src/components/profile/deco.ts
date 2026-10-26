import type { CSSProperties } from 'react'
import type { PaperId, ProfileFont } from '../../types'

// 프로필 꾸미기 재료: 속지 · 글꼴 · 스티커 · 색.

/** 손글씨 글꼴 (Google Fonts). 프로필 화면에서만 불러온다 */
export const PROFILE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Jua&family=Nanum+Myeongjo:wght@400;700&family=Nanum+Pen+Script&display=swap'

export const FONTS: { id: ProfileFont; name: string; family: string }[] = [
  { id: 'basic', name: '기본', family: 'var(--font-sans)' },
  { id: 'hand', name: '손글씨', family: '"Gaegu", var(--font-sans)' },
  { id: 'round', name: '동글동글', family: '"Jua", var(--font-sans)' },
  { id: 'serif', name: '명조', family: '"Nanum Myeongjo", serif' },
  { id: 'pen', name: '펜글씨', family: '"Nanum Pen Script", var(--font-sans)' },
]

export const fontFamily = (id: ProfileFont) => (FONTS.find((f) => f.id === id) ?? FONTS[0]).family
/** 펜글씨는 글자가 작아 보여서 키운다 */
export const fontScale = (id: ProfileFont) => (id === 'pen' ? 1.35 : id === 'hand' ? 1.15 : 1)

export const PAPERS: { id: PaperId; name: string }[] = [
  { id: 'plain', name: '무지' },
  { id: 'lined', name: '줄노트' },
  { id: 'grid', name: '모눈' },
  { id: 'dot', name: '도트' },
  { id: 'kraft', name: '크라프트' },
  { id: 'cream', name: '미색' },
]

/** 속지 색. 크라프트·미색은 고르면 이 색으로 바뀐다 */
export const PAPER_COLORS = ['#ffffff', '#fdf6e3', '#fde2e4', '#e2ece9', '#dbeafe', '#ede9fe', '#fef3c7', '#d6c4a8', '#1f2937']
const PAPER_DEFAULT_COLOR: Partial<Record<PaperId, string>> = { kraft: '#d6c4a8', cream: '#fdf6e3' }
export const paperDefaultColor = (id: PaperId) => PAPER_DEFAULT_COLOR[id]

/** 어두운 속지면 글자를 밝게 */
export function isDarkPaper(color: string) {
  const n = parseInt(color.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

/** 속지 무늬 (CSS 배경). 선 색은 속지 밝기에 맞춘다 */
export function paperStyle(paper: PaperId, color: string): CSSProperties {
  // 밝은 종이는 다크 화면에서 어둡게 눌러 준다 (app/globals.css 의 --paper-keep · --paper-ink · --paper-rule)
  const dark = isDarkPaper(color)
  const line = dark ? 'rgb(255 255 255 / 0.12)' : 'var(--paper-rule)'
  const base: CSSProperties = dark
    ? { backgroundColor: color, color: '#f3f4f6' }
    : { backgroundColor: `color-mix(in srgb, ${color} var(--paper-keep), #161615)`, color: 'var(--paper-ink)' }
  switch (paper) {
    case 'lined':
      return { ...base, backgroundImage: `linear-gradient(transparent 31px, ${line} 32px)`, backgroundSize: '100% 32px' }
    case 'grid':
      return { ...base, backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, backgroundSize: '22px 22px' }
    case 'dot':
      return { ...base, backgroundImage: `radial-gradient(${line} 1.5px, transparent 1.6px)`, backgroundSize: '20px 20px' }
    case 'kraft':
      // 종이 섬유 느낌: 아주 옅은 사선 두 겹
      return {
        ...base,
        backgroundImage:
          'repeating-linear-gradient(35deg, rgb(0 0 0 / 0.025) 0 2px, transparent 2px 7px), repeating-linear-gradient(-55deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 9px)',
      }
    default:
      return base
  }
}

/** 마스킹테이프 색 (대표 지도 카드) */
export const TAPE_COLORS = ['#fca5a5', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4']

/** id 로 항상 같은 값 (카드 기울기·테이프 색) */
export function seeded(id: string, n: number) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % n
}

export const BIO_MAX = 150
export const MOOD_MAX = 40
export const STICKER_MAX = 30
export const PINNED_MAX = 6
