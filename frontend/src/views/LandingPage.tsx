'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { MapThumb } from '../components/MapThumb'
import { useReveal, useScrollProgress } from '../components/useReveal'
import { getMonthlyRanking } from '../db/api'
import type { MapRankingEntry } from '../types'

// 처음 온 사람에게 '컨셉지도가 뭘 하는 곳인지' 보여주는 소개 페이지 (/about, 로그인 안 했을 때 / 에서도).
// 스크롤하면 오른쪽 그림이 단계별로 바뀐다: 핀 꽂기 → 길 잇기 → 꾸미기 → 공유하기.

const THEMES = ['🥐 빵지순례', '🎬 드라마 촬영지', '☕ 성수 카페 투어', '📚 동네 책방', '🍜 노포 맛집', '🌸 벚꽃 산책', '🎵 앨범 커버 성지', '🏛️ 근대 건축', '🐾 고양이 골목']

const STEPS = [
  { no: '01', title: '핀을 꽂고', en: 'Pin', body: '가고 싶은 곳을 검색하거나 지도를 길게 눌러 핀을 꽂아요. 이모지와 색으로 장소마다 표정을 줘요.' },
  { no: '02', title: '길을 잇고', en: 'Route', body: '걷기 · 대중교통 · 자동차 · 자전거. 버스 번호, 환승, KTX역까지 가는 길도 알아서 이어져요.' },
  { no: '03', title: '내 맘대로 꾸미고', en: 'Decorate', body: '테마 색, 마커 모양, 선 스타일, 커버 사진. 다이어리 꾸미듯 나만의 지도를 만들어요.' },
  { no: '04', title: '같이 걸어요', en: 'Share', body: '친구들과의 여정을 공유해요. 우리끼리만 보는 비공개 모임으로 경로를 같이 보고, 카톡으로 초대해요.' },
]

const FEATURES = [
  { icon: '🚇', title: '진짜 길찾기', body: '버스 · 지하철 · KTX · 고속버스까지. 핀 사이를 실제 길로 이어요.' },
  { icon: '🎨', title: '다이어리 꾸미기', body: '스티커, 속지, 손글씨 글꼴로 프로필을 꾸며요.' },
  { icon: '🔒', title: '친구들과의 여정', body: '우리끼리만 보는 비공개 모임으로 여행 경로를 공유하고 추억을 남겨요.' },
  { icon: '🚶', title: '성지순례 모임', body: '지도 하나로 모임을 열고 댓글로 “출구 앞이에요” 연락해요.' },
  { icon: '🗂️', title: '카테고리 둘러보기', body: '맛집 투어, 데이트 코스, 1박 2일 여행… 남의 코스를 골라 따라 걸어요.' },
  { icon: '📸', title: '이미지로 저장', body: '코스 전체를 담은 지도 이미지 한 장으로 자랑해요.' },
]

export function LandingPage({ embedded = false }: { embedded?: boolean }) {
  const reveal = useReveal<HTMLDivElement>()
  const [stepsRef, progress] = useScrollProgress<HTMLElement>()
  const step = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length * 0.999))
  // 단계 제목을 누르면 그 단계가 보이는 위치로 스크롤
  const goStep = (i: number) => {
    const el = stepsRef.current
    if (!el) return
    const total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: el.offsetTop + (total * (i + 0.5)) / STEPS.length, behavior: 'smooth' })
  }
  const [top, setTop] = useState<MapRankingEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getMonthlyRanking(undefined, 8)
      .then((l) => !cancelled && setTop(l))
      .catch(() => !cancelled && setTop([]))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div ref={reveal} className={`relative overflow-x-clip ${embedded ? '' : 'min-h-dvh pb-16 pt-14 md:pb-0'}`}>
      {!embedded && (
        <>
          <AppRail active="about" />
          <MobileTabBar active="about" />
        </>
      )}

      {/* ---- 1. 첫 화면 ---- */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-10 md:grid-cols-[1.1fr_0.9fr] md:px-10 md:pt-20">
        <div>
          <p className="tm-label dot tm-intro">concept map — vol.01</p>
          <h1 className="tm-headline tm-intro mt-5 text-[13vw] md:text-[88px]" style={{ '--delay': '0.08s' } as CSSProperties}>
            나만의 테마로
            <br />
            <em>지도</em>를 <span className="tm-mark">꾸미다</span>
          </h1>
          <p className="tm-intro mt-6 max-w-md text-[17px] leading-relaxed text-(--c-muted)" style={{ '--delay': '0.16s' } as CSSProperties}>
            빵지순례, 데이트 코스, 1박 2일 여행. 좋아하는 것들로 코스를 만들고, 다이어리처럼 꾸미고, 친구들과의 여정을 공유해요.
          </p>
          <div className="tm-intro mt-8 flex flex-wrap gap-3" style={{ '--delay': '0.24s' } as CSSProperties}>
            <Link href="/login" className="tm-btn rounded-full bg-(--c-accent) px-6 py-3 text-[15px] font-bold text-(--c-accent-text)">
              지금 지도 만들기 →
            </Link>
            <Link href="/explore" className="tm-btn rounded-full bg-(--c-surface) px-6 py-3 text-[15px] font-bold">
              지도 둘러보기
            </Link>
          </div>
        </div>
        <div className="tm-intro" style={{ '--delay': '0.2s' } as CSSProperties}>
          <HeroMap />
        </div>
      </section>

      {/* ---- 흐르는 띠 ---- */}
      <div className="border-y border-(--c-ink) bg-(--c-ink) py-3 text-(--c-bg)" aria-hidden>
        <div className="tm-marquee gap-10 whitespace-nowrap font-mono text-sm font-medium uppercase tracking-wider">
          {[...THEMES, ...THEMES].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              {t}
              <span className="text-(--c-lime)">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---- 2. 스크롤하면 바뀌는 단계 ---- */}
      <section ref={stepsRef} className="relative" style={{ height: `${STEPS.length * 50 + 100}vh` }}>
        <div className="sticky top-14 mx-auto grid h-[calc(100dvh-56px)] max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:px-10">
          <div className="order-2 md:order-1">
            <p className="tm-label dot">how it works</p>
            <ol className="mt-6 space-y-2">
              {STEPS.map((s, i) => (
                <li
                  key={s.no}
                  onClick={() => goStep(i)}
                  className={`cursor-pointer border-l-2 pl-5 transition-all duration-500 ${i === step ? 'border-(--c-accent) py-3 opacity-100' : 'border-(--c-border) py-1 opacity-35 hover:opacity-70'}`}
                >
                  <p className="font-mono text-xs text-(--c-muted)">
                    {s.no} / <span className="tm-serif text-base normal-case">{s.en}</span>
                  </p>
                  <h3 className={`tm-headline transition-all duration-500 ${i === step ? 'text-4xl md:text-5xl' : 'text-xl'}`}>{s.title}</h3>
                  <p className={`overflow-hidden text-[15px] leading-relaxed text-(--c-muted) transition-all duration-500 ${i === step ? 'mt-2 max-h-40' : 'max-h-0'}`}>{s.body}</p>
                </li>
              ))}
            </ol>
            {/* 진행 막대 */}
            <div className="mt-8 h-1 w-full max-w-xs overflow-hidden rounded-full bg-(--c-border)">
              <div className="h-full bg-(--c-accent) transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative">
              {/* 단계가 바뀌면 그림이 톡 튀고 STEP 표시가 뜬다 (key 가 바뀌면 애니메이션이 다시 돈다) */}
              <span key={`label-${step}`} className="tm-intro absolute -top-4 right-2 z-20 rounded-full bg-(--c-ink) px-3 py-1 font-mono text-xs font-bold text-(--c-bg) md:-right-4">
                STEP {STEPS[step].no}
              </span>
              <div key={`map-${step}`} className="animate-[tm-step_0.45s_cubic-bezier(.34,1.56,.64,1)]">
                <StepMap step={step} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 3. 기능 ---- */}
      <section className="mx-auto max-w-6xl px-4 py-24 md:px-10">
        <p className="tm-label dot tm-reveal">features</p>
        <h2 className="tm-headline tm-reveal mt-4 text-4xl md:text-6xl">
          걷고 싶어지는 <em>모든 것</em>
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-border) sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="tm-reveal bg-(--c-surface) p-6" style={{ '--delay': `${(i % 3) * 0.08}s` } as CSSProperties}>
              <div className="flex items-start justify-between">
                <span className="text-3xl" aria-hidden>{f.icon}</span>
                <span className="font-mono text-xs text-(--c-muted)">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-(--c-muted)">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- 4. 지금 인기 있는 지도 (실제 데이터) ---- */}
      {top && top.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-10">
            <p className="tm-label dot tm-reveal">this month</p>
            <h2 className="tm-headline tm-reveal mt-4 text-4xl md:text-6xl">
              이달에 많이 <em>걸은</em> 지도
            </h2>
          </div>
          <div className="tm-scroll mt-10 flex snap-x gap-6 overflow-x-auto px-4 pb-8 md:px-[max(40px,calc((100vw-1152px)/2+40px))]">
            {top.map((e, i) => (
              <Link
                key={e.map.id}
                href={`/maps/${e.map.id}`}
                className="tm-reveal w-60 shrink-0 snap-start bg-white p-2.5 pb-4 text-gray-900 shadow-[0_12px_30px_-10px_rgb(0_0_0/0.35)] transition hover:-translate-y-1 hover:rotate-0"
                style={{ transform: `rotate(${[-2, 1.5, -1, 2][i % 4]}deg)`, '--delay': `${i * 0.06}s` } as CSSProperties}
              >
                <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className="h-48" />
                <p className="mt-3 truncate font-bold">{e.map.title}</p>
                <p className="mt-0.5 font-mono text-[11px] uppercase text-gray-500">
                  #{e.rank} · {e.owner.nickname} · {e.users} walked
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- 5. 마지막 한마디 ---- */}
      <section className="border-t border-(--c-border) px-4 py-28 text-center md:px-10">
        <p className="tm-label dot tm-reveal">your turn</p>
        <h2 className="tm-headline tm-reveal mx-auto mt-6 max-w-4xl text-5xl md:text-8xl">
          내가 지나온 <em>추억</em>을
          <br />
          지도에 남겨요
        </h2>
        <Link href="/login" className="tm-btn tm-reveal mt-10 inline-block rounded-full bg-(--c-accent) px-8 py-4 text-base font-bold text-(--c-accent-text)">
          무료로 시작하기 →
        </Link>
        <p className="mt-16 font-mono text-[11px] uppercase tracking-wider text-(--c-muted)">© concept map · made for walkers</p>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 그림
// ---------------------------------------------------------------------------

const PINS = [
  { x: 70, y: 330, e: '☕', c: '#ff5a2b' },
  { x: 150, y: 190, e: '🥐', c: '#ffd84a' },
  { x: 255, y: 250, e: '📚', c: '#8fd9ff' },
  { x: 320, y: 110, e: '🌸', c: '#ff9ec7' },
]
const ROUTE = 'M70 330 C 90 260, 120 220, 150 190 S 230 270, 255 250 S 300 140, 320 110'

/** 지도 바탕: 건물 블록 · 공원 · 한강 · 도로 · 2호선 (그림만, 성수동 느낌) */
function MapPaper({ children, tint = '#ff5a2b' }: { children?: React.ReactNode; tint?: string }) {
  // 건물 블록: 도로 사이 칸마다 크기가 조금씩 다른 네모
  const blocks: [number, number, number, number][] = [
    [8, 8, 70, 42], [92, 6, 60, 48], [166, 10, 84, 38], [262, 4, 56, 50], [330, 12, 64, 40],
    [10, 168, 58, 34], [196, 160, 70, 46], [276, 170, 50, 30], [338, 162, 56, 44],
    [168, 300, 62, 40], [244, 296, 74, 36], [332, 290, 60, 44], [96, 304, 50, 30],
  ]
  return (
    <svg viewBox="0 0 400 440" className="block h-auto w-full" role="img" aria-label="컨셉지도 예시 (성수동 코스)">
      <defs>
        <pattern id="tm-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke="currentColor" strokeOpacity="0.05" />
        </pattern>
        <pattern id="tm-wave" width="26" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q 6.5 1, 13 6 T 26 6" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" />
        </pattern>
      </defs>
      <rect width="400" height="440" fill="#f6f1e6" />
      <rect width="400" height="440" fill={tint} fillOpacity="0.05" style={{ transition: 'fill 0.6s' }} />
      <rect width="400" height="440" fill="url(#tm-grid)" />

      {/* 건물 */}
      {blocks.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="5" fill={i % 3 === 0 ? '#ebe2cf' : i % 3 === 1 ? '#e6ddca' : '#efe7d6'} stroke="#d9cfba" strokeWidth="1" />
      ))}

      {/* 서울숲 */}
      <path d="M-10 196 C 30 186, 70 196, 96 214 C 110 250, 96 282, 60 292 C 26 300, -4 290, -10 280 Z" fill="#cfe6b0" />
      <path d="M8 222 C 26 214, 48 220, 58 236 C 62 252, 44 262, 26 258 C 10 254, 2 240, 8 222 Z" fill="#9ed2e6" fillOpacity="0.8" />
      <text x="20" y="282" fontSize="13">🌳</text>
      <text x="64" y="272" fontSize="15">🌳</text>
      <text x="74" y="230" fontSize="11">🌲</text>
      <text x="40" y="210" fontFamily="var(--font-mono)" fontSize="7.5" fill="#5f7f3c" letterSpacing="0.06em">SEOUL FOREST</text>

      {/* 한강 */}
      <path d="M-10 384 C 70 350, 150 404, 240 372 S 370 330, 410 344 L410 450 L-10 450Z" fill="#a9daf0" />
      <path d="M-10 384 C 70 350, 150 404, 240 372 S 370 330, 410 344 L410 450 L-10 450Z" fill="url(#tm-wave)" />
      <text x="300" y="408" fontFamily="var(--font-mono)" fontSize="8" fill="#4a86a3" letterSpacing="0.2em">HAN RIVER</text>

      {/* 도로: 흰 길 + 옅은 테두리 */}
      <g fill="none" strokeLinecap="round">
        {[
          ['M-10 148 L410 124', 16],
          ['M128 -10 L224 450', 14],
          ['M-10 288 C 120 270, 260 300, 410 256', 12],
          ['M312 -10 L292 360', 9],
          ['M-10 64 L410 82', 8],
        ].map(([d, w]) => (
          <g key={d as string}>
            <path d={d as string} stroke="#d6ccb6" strokeWidth={(w as number) + 2} />
            <path d={d as string} stroke="#fffdf8" strokeWidth={w as number} />
          </g>
        ))}
      </g>
      <g fontFamily="var(--font-mono)" fontSize="7" fill="#8a8170" letterSpacing="0.08em">
        <text x="250" y="122" transform="rotate(-3.5 250 122)">TTUKSEOM-RO</text>
        <text x="150" y="40" transform="rotate(77 150 40)">SEONGSU-IRO</text>
        <text x="330" y="252" transform="rotate(-9 330 252)">YEONMUJANG-GIL</text>
      </g>

      {/* 2호선 (지상 구간) + 역 */}
      <path d="M-10 108 L410 92" stroke="#00a84d" strokeWidth="5" strokeLinecap="round" />
      <path d="M-10 108 L410 92" stroke="#fff" strokeWidth="1.2" strokeDasharray="6 6" />
      {[
        [170, 101.5, '뚝섬'],
        [300, 96.5, '성수'],
      ].map(([x, y, n]) => (
        <g key={n as string}>
          <circle cx={x as number} cy={y as number} r="6.5" fill="#fff" stroke="#00a84d" strokeWidth="3" />
          <rect x={(x as number) - 16} y={(y as number) - 24} width="32" height="14" rx="7" fill="#00a84d" />
          <text x={x as number} y={(y as number) - 14} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">
            {n}
          </text>
        </g>
      ))}

      {children}
    </svg>
  )
}

/** 첫 화면 그림: 성수동 지도 위로 길이 그려지고, 핀이 톡톡 떨어지고, 사람이 코스를 걷는다. 주변에 다이어리처럼 사진 · 티켓 · 스티커 */
function HeroMap() {
  return (
    <div className="relative mx-auto max-w-md">
      <div className="relative rotate-[1.5deg] overflow-hidden rounded-3xl border-[1.5px] border-(--c-ink) bg-(--c-surface) shadow-[8px_8px_0_var(--c-ink)]">
        <MapPaper>
          <path id="tm-hero-route" d={ROUTE} fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
          <path d={ROUTE} fill="none" stroke="#ff5a2b" strokeWidth="6" strokeLinecap="round" strokeDasharray="600" strokeDashoffset="600" className="animate-[tm-draw_2.4s_0.4s_cubic-bezier(.6,0,.2,1)_forwards]" />
          {/* 코스를 따라 걷는 사람 */}
          <g className="opacity-0 animate-[tm-fade-in_0.4s_2.8s_forwards]">
            <circle r="13" fill="#171614" />
            <text y="5" textAnchor="middle" fontSize="13">
              🚶
            </text>
            <animateMotion dur="7s" begin="2.8s" repeatCount="indefinite" rotate="0" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#tm-hero-route" />
            </animateMotion>
          </g>
          {PINS.map((p, i) => (
            <g key={i} className="origin-bottom opacity-0" style={{ animation: `tm-pop 0.5s ${0.5 + i * 0.45}s cubic-bezier(.34,1.56,.64,1) forwards`, transformBox: 'fill-box' }}>
              <path d={`M${p.x} ${p.y + 30} l-7 -12 h14 z`} fill={p.c} />
              <circle cx={p.x} cy={p.y} r="21" fill={p.c} stroke="#fff" strokeWidth="4" />
              <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="18">
                {p.e}
              </text>
              <circle cx={p.x + 17} cy={p.y - 17} r="9" fill="#171614" />
              <text x={p.x + 17} y={p.y - 13.5} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
                {i + 1}
              </text>
            </g>
          ))}
        </MapPaper>
        {/* 지도 위 제목 띠 */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-2xl bg-(--c-surface)/95 px-3.5 py-2.5 shadow-sm ring-1 ring-(--c-border) backdrop-blur">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-(--c-muted)">my concept map</p>
            <p className="text-[15px] font-extrabold tracking-tight">성수 빵지순례 🥐</p>
          </div>
          <span className="flex -space-x-2">
            {['#ff9ec7', '#8fd9ff', '#ffd84a'].map((c, i) => (
              <span key={c} className="grid size-7 place-items-center rounded-full text-[11px] font-bold ring-2 ring-(--c-surface)" style={{ background: c }}>
                {['민', '지', '+2'][i]}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* 폴라로이드 사진 (장소 추억) */}
      <div className="absolute -bottom-10 -left-14 w-32 -rotate-[9deg] bg-white p-2 pb-6 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)] animate-[tm-float_6s_ease-in-out_infinite] max-md:-left-3 max-md:w-24">
        <div className="relative grid aspect-square place-items-center overflow-hidden bg-gradient-to-br from-[#ffd9a8] via-[#ffb98a] to-[#f08a6a] text-5xl max-md:text-4xl">
          🥐
          <span className="absolute bottom-1 right-1.5 font-mono text-[8px] font-bold text-white/90">10.30</span>
        </div>
        <p className="mt-1.5 text-center text-[11px] font-bold text-gray-800" style={{ fontFamily: '"Gaegu", var(--font-sans)' }}>
          소금빵 성공 ✌️
        </p>
        <span className="absolute -top-2.5 left-1/2 h-4 w-12 -translate-x-1/2 rotate-3 bg-(--c-lime)/80" aria-hidden />
      </div>
      <div className="absolute -right-12 top-[46%] w-28 rotate-[7deg] bg-white p-2 pb-5 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)] animate-[tm-float_7s_1s_ease-in-out_infinite] max-md:-right-3 max-md:w-20">
        <div className="grid aspect-square place-items-center bg-gradient-to-br from-[#c9ecff] via-[#a7d8f5] to-[#7ab8e8] text-4xl max-md:text-3xl">☕</div>
        <span className="absolute -top-2 right-3 h-4 w-10 -rotate-6 bg-(--c-pink)/80" aria-hidden />
      </div>

      {/* 티켓 메모 */}
      <div className="absolute -bottom-6 right-6 flex rotate-[-3deg] overflow-hidden rounded-lg bg-(--c-ink) text-(--c-bg) shadow-lg animate-[tm-float_5s_0.5s_ease-in-out_infinite]">
        <div className="px-3 py-2">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-60">course · seongsu</p>
          <p className="font-mono text-[12px] font-bold">4 PLACES · 1H 20M</p>
        </div>
        <div className="grid place-items-center border-l border-dashed border-white/30 bg-(--c-lime) px-2.5 font-mono text-[10px] font-bold text-gray-900">GO</div>
      </div>

      {/* 스티커 */}
      <span className="absolute -left-8 top-[40%] rotate-[-10deg] rounded-full bg-(--c-lime) px-3 py-1.5 font-mono text-xs font-bold text-gray-900 shadow-md animate-[tm-float_4s_ease-in-out_infinite] max-md:-left-2">
        🚇 2호선 · 12분
      </span>
      <span className="absolute -right-4 top-[30%] text-4xl drop-shadow-md animate-[tm-float_4.5s_0.3s_ease-in-out_infinite]" aria-hidden>
        ✨
      </span>
    </div>
  )
}

const STEP_TINTS = ['#ff5a2b', '#ff5a2b', '#7c5cff', '#ff5a2b']

/** 단계별 그림: 0 핀 · 1 길 + 대중교통 · 2 꾸미기(색 · 스티커) · 3 공유(카드 · 카톡) */
const PICK_COLORS = ['#7c5cff', '#ff5a2b', '#22c55e', '#ff4fa3', '#0ea5e9', '#171614']

function StepMap({ step }: { step: number }) {
  // 3단계(꾸미기)에서 색 동그라미를 누르면 진짜로 지도 색이 바뀐다
  const [pick, setPick] = useState(PICK_COLORS[0])
  const tint = step === 2 ? pick : STEP_TINTS[step]
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-3xl border-[1.5px] border-(--c-ink) shadow-[8px_8px_0_var(--c-ink)] transition-transform duration-700" style={{ transform: step === 3 ? 'rotate(-4deg) scale(0.92)' : 'none' }}>
        <MapPaper tint={tint}>
          <path d={ROUTE} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity={step >= 1 ? 1 : 0} style={{ transition: 'opacity .5s' }} />
          <path
            d={ROUTE}
            fill="none"
            stroke={tint}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={step === 2 ? '2 14' : '600'}
            strokeDashoffset={step >= 1 ? 0 : 600}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.6,0,.2,1), stroke .6s' }}
          />
          {PINS.map((p, i) => (
            <g key={i} style={{ transition: `transform .5s ${i * 0.08}s cubic-bezier(.34,1.56,.64,1), opacity .3s`, transformBox: 'fill-box', transformOrigin: 'bottom', transform: step >= 0 ? 'scale(1)' : 'scale(0)' }}>
              {step === 2 ? (
                <rect x={p.x - 20} y={p.y - 20} width="40" height="40" rx="10" fill={tint} stroke="#fff" strokeWidth="4" style={{ transition: 'fill .6s' }} />
              ) : (
                <circle cx={p.x} cy={p.y} r="20" fill={p.c} stroke="#fff" strokeWidth="4" />
              )}
              <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="18">
                {p.e}
              </text>
            </g>
          ))}
          {/* 2단계: 구간 시간 라벨 */}
          <g opacity={step === 1 ? 1 : 0} style={{ transition: 'opacity .5s .4s' }}>
            {[
              [100, 255, '🚶 6분'],
              [205, 225, '🚇 12분'],
              [290, 185, '🚌 9분'],
            ].map(([x, y, t]) => (
              <g key={t as string}>
                <rect x={(x as number) - 34} y={(y as number) - 13} width="68" height="26" rx="13" fill="#fff" stroke="currentColor" strokeOpacity="0.15" />
                <text x={x as number} y={(y as number) + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#171614">
                  {t}
                </text>
              </g>
            ))}
          </g>
          {/* 3단계: 스티커 */}
          <g opacity={step === 2 ? 1 : 0} style={{ transition: 'opacity .5s .3s' }} fontSize="34">
            <text x="40" y="80" transform="rotate(-14 40 80)">✨</text>
            <text x="330" y="380" transform="rotate(12 330 380)">🌈</text>
            <text x="200" y="60">⭐</text>
          </g>
        </MapPaper>
      </div>
      {/* 4단계: 공유 카드들 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-4 top-6 w-40 rotate-[8deg] rounded-xl bg-[#FEE500] p-3 text-gray-900 shadow-xl transition-all duration-700" style={{ opacity: step === 3 ? 1 : 0, transform: step === 3 ? 'rotate(8deg) translateY(0)' : 'rotate(8deg) translateY(30px)' }}>
          <p className="text-xs font-bold">💬 카카오톡</p>
          <p className="mt-1 text-sm font-bold">성수 빵지순례</p>
          <p className="text-[11px]">10월 30일 · 성수역 · 3/6명</p>
        </div>
      </div>
      {/* 3단계: 꾸미기 도구 */}
      <div
        className={`absolute -bottom-6 left-1/2 flex items-center gap-2 rounded-full bg-(--c-surface) p-2 pl-3.5 shadow-lg ring-1 ring-(--c-border) transition-all duration-500 ${step === 2 ? '' : 'pointer-events-none'}`}
        style={{ opacity: step === 2 ? 1 : 0, transform: `translateX(-50%) translateY(${step === 2 ? 0 : 16}px)` }}
        role="radiogroup"
        aria-label="지도 색 골라 보기"
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-(--c-muted)">tap!</span>
        {PICK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === pick}
            aria-label={`지도 색 ${c}`}
            onClick={() => setPick(c)}
            className={`size-7 rounded-full transition hover:scale-110 ${c === pick ? 'scale-110 ring-2 ring-(--c-ink) ring-offset-2 ring-offset-(--c-surface)' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}
