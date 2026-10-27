'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { MapThumb } from '../components/MapThumb'
import { useAppearance } from '../components/appearance'
import { useSiteColor } from '../components/siteColor'
import { InstallAppButton } from '../components/pwa'
import { useReveal, useScrollProgress } from '../components/useReveal'
import { getMonthlyRanking } from '../db/api'
import type { MapRankingEntry } from '../types'

// 처음 온 사람에게 '컨셉지도가 뭘 하는 곳인지' 보여주는 소개 페이지 (/about, 로그인 안 했을 때 / 에서도).
// 스크롤하면 오른쪽 그림이 단계별로 바뀐다: 핀 꽂기 → 길 잇기 → 꾸미기 → 공유하기.

const THEMES = ['🥐 빵지순례', '🎬 드라마 촬영지', '☕ 성수 카페 투어', '📚 동네 책방', '🍜 노포 맛집', '🌸 벚꽃 산책', '🎵 앨범 커버 성지', '🏛️ 근대 건축', '🐾 고양이 골목']

const STEPS = [
  { no: '01', title: '핀을 꽂고', en: 'Pin', body: '가고 싶은 곳도, 이미 다녀온 곳도. 검색하거나 지도를 눌러 근처 장소를 골라 핀을 꽂고, 이모지와 색으로 장소마다 표정을 줘요.' },
  { no: '02', title: '길을 잇고', en: 'Route', body: '걷기 · 대중교통 · 자동차 · 자전거. 버스 번호, 환승, KTX역까지 가는 길도 알아서 이어져요.' },
  { no: '03', title: '내 맘대로 꾸미고', en: 'Decorate', body: '테마 색, 마커 모양, 선 스타일, 커버 사진. 다이어리 꾸미듯 나만의 지도를 만들어요.' },
  { no: '04', title: '같이 떠나요', en: 'Together', body: '초대 링크 하나면 친구들이 한 지도에 들어와 핀을 넣고 순서를 바꾸며 코스를 같이 짜요. 완성된 지도는 단톡방에 공유하고 함께 떠나요.' },
]

const FEATURES = [
  { icon: '🚇', title: '진짜 길찾기', body: '버스 · 지하철 · KTX · 고속버스까지. 핀 사이를 실제 길로 이어요.' },
  { icon: '🎨', title: '다이어리 꾸미기', body: '스티커, 속지, 손글씨 글꼴로 프로필을 꾸며요.' },
  { icon: '👥', title: '여럿이 함께 기획', body: '친구를 초대해 한 지도를 같이 고쳐요. 각자 가고 싶은 곳을 넣다 보면 우리만의 코스가 완성돼요.' },
  { icon: '🙌', title: '성지순례 모임', body: '지도 하나로 모임을 열고 댓글로 “출구 앞이에요” 연락해요. 우리끼리만 보는 비공개 모임도 돼요.' },
  { icon: '🗂️', title: '카테고리 둘러보기', body: '맛집 투어, 데이트 코스, 1박 2일 여행… 남의 코스를 골라 그대로 따라가 봐요.' },
  { icon: '📔', title: '사랑했던 곳 기록', body: '다녀온 날짜, 사진, 한 줄 메모를 핀마다 남겨요. 계획이 아니어도 좋아요. 추억을 담은 지도는 이미지 한 장으로 간직해요.' },
]

/** 이달의 컨셉지도 슬라이드: 카드 너비 · 카드 한 칸(카드 + 간격) · 넘기는 간격(ms) */
const CARD_W = 240
const SLIDE_W = CARD_W + 24
const SLIDE_EVERY = 2600

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
  // 이미 로그인했으면 시작 버튼은 로그인 화면(계정 정보) 대신 내 지도로
  const loggedIn = !!useCurrentUser()
  const startHref = loggedIn ? '/' : '/login'
  // 흐르는 카드 줄: 지도가 적어도 화면을 채우도록 최소 6장이 되게 반복한다
  // 이달의 컨셉지도 슬라이드: 한 장씩 가운데로 넘어와 커진 채로 잠깐 머문다.
  // 끝없이 돌도록 같은 줄을 세 번 이어 붙이고 가운데 줄에서 시작한다. 지도가 적어도 한 줄이 최소 6장이 되게 반복.
  const slides = top && top.length ? Array.from({ length: Math.ceil(6 / top.length) }, () => top).flat() : []
  const n = slides.length
  const stripRef = useRef<HTMLDivElement>(null)
  const [stripW, setStripW] = useState(0)
  const [slide, setSlide] = useState(0) // 가운데 줄 기준 몇 번째 카드가 가운데인지 (n 이 되면 0 으로 몰래 되감는다)
  const [animate, setAnimate] = useState(true)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStripW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])
  useEffect(() => {
    // 화면 움직임 줄이기 설정이면 넘기지 않는다
    if (!n || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => {
      if (document.hidden) return // 다른 탭에 있을 땐 넘기지 않는다 (되감기 신호를 놓치지 않게)
      setAnimate(true)
      setSlide((i) => Math.min(i + 1, n))
    }, SLIDE_EVERY)
    return () => window.clearInterval(t)
  }, [n, paused])

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

      {/* ---- 1. 첫 화면: 화면 높이에서 흐르는 띠 높이(46px)를 뺀 만큼 채워서, 띠가 첫 화면 맨 아래에 붙어 보이게 (모바일은 아래 탭 높이도 뺀다) ---- */}
      <section className="mx-auto grid min-h-[calc(100dvh-56px-64px-46px)] max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:min-h-[calc(100dvh-56px-46px)] md:grid-cols-[1.1fr_0.9fr] md:px-10 md:pb-12 md:pt-12">
        <div>
          <p className="tm-label dot tm-intro">my concept map — vol.01</p>
          <h1 className="tm-headline tm-intro mt-5 text-[13vw] md:text-[5.5rem]" style={{ '--delay': '0.08s' } as CSSProperties}>
            <em>지도</em> 위에
            <br />
            펼쳐지는
            <br />
            나만의 <span className="tm-mark">세상</span>
          </h1>
          <p className="tm-intro mt-6 max-w-md text-[1.0625rem] leading-relaxed text-(--c-muted)" style={{ '--delay': '0.16s' } as CSSProperties}>
            가고 싶은 곳은 친구들과 함께 코스로 짜고, 사랑했던 곳은 사진과 메모로 남겨요. 계획도 추억도, 다이어리처럼 꾸민 나만의 지도 한 장에.
          </p>
          <div className="tm-intro mt-8 flex flex-wrap gap-3" style={{ '--delay': '0.24s' } as CSSProperties}>
            <Link href={startHref} className="tm-btn rounded-full bg-(--c-accent) px-6 py-3 text-[0.9375rem] font-bold text-(--c-accent-text)">
              {loggedIn ? '내 지도로 가기 →' : '지금 지도 만들기 →'}
            </Link>
            <Link href="/explore" className="tm-btn rounded-full bg-(--c-surface) px-6 py-3 text-[0.9375rem] font-bold">
              지도 둘러보기
            </Link>
            <InstallAppButton label="📱 앱으로 설치하기" className="tm-btn rounded-full bg-(--c-surface) px-6 py-3 text-[0.9375rem] font-bold" />
          </div>
        </div>
        <div className="tm-intro" style={{ '--delay': '0.2s' } as CSSProperties}>
          <HeroMap />
        </div>
      </section>

      {/* ---- 흐르는 띠: 첫 화면을 보는 동안 창 맨 아래(모바일은 아래 탭 위)에 붙어 있다가, 지나가면 제자리에 ---- */}
      <div className="sticky bottom-16 z-20 border-y border-(--c-border) bg-(--c-strip) py-3 text-(--c-strip-text) md:bottom-0" aria-hidden>
        <div className="tm-marquee gap-10 whitespace-nowrap font-mono text-sm font-medium uppercase tracking-wider">
          {[...THEMES, ...THEMES].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              {t}
              <span className="text-(--c-strip-mark)">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---- 2. 스크롤하면 바뀌는 단계 (모바일은 그림을 줄이고 지금 단계만 보여 한 화면에 들어가게) ---- */}
      <section ref={stepsRef} className="relative" style={{ height: `${STEPS.length * 50 + 100}vh` }}>
        <div className="sticky top-14 mx-auto grid min-h-[calc(100dvh-56px-64px)] max-w-6xl content-center items-center gap-4 px-4 md:h-[calc(100dvh-56px)] md:min-h-0 md:content-normal md:gap-8 md:grid-cols-2 md:px-10">
          <div className="order-2 md:order-1">
            <p className="tm-label dot">how it works</p>
            <ol className="mt-3 space-y-2 md:mt-6">
              {STEPS.map((s, i) => (
                <li
                  key={s.no}
                  onClick={() => goStep(i)}
                  className={`cursor-pointer border-l-2 pl-5 transition-all duration-500 ${i === step ? 'border-(--c-accent) py-2 opacity-100 md:py-3' : 'hidden border-(--c-border) py-1 opacity-35 hover:opacity-70 md:block'}`}
                >
                  <p className="font-mono text-xs text-(--c-muted)">
                    {s.no} / <span className="tm-serif text-base normal-case">{s.en}</span>
                  </p>
                  <h3 className={`tm-headline transition-all duration-500 ${i === step ? 'text-3xl md:text-5xl' : 'text-xl'}`}>{s.title}</h3>
                  <p className={`overflow-hidden text-[0.875rem] leading-relaxed text-(--c-muted) transition-all duration-500 md:text-[0.9375rem] ${i === step ? 'mt-2 max-h-40' : 'max-h-0'}`}>{s.body}</p>
                </li>
              ))}
            </ol>
            {/* 단계 막대: 단계마다 한 칸. 지난 단계는 꽉 차고, 지금 단계 칸만 스크롤에 맞춰 차오른다 */}
            <div className="mt-4 flex items-center gap-3 md:mt-8">
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => {
                  const fill = i < step ? 1 : i > step ? 0 : Math.min(1, Math.max(0.15, progress * STEPS.length - i))
                  return (
                    <button key={s.no} type="button" onClick={() => goStep(i)} className="group py-2" aria-label={`${s.no}단계 ${s.title}`}>
                      <span className="block h-1 w-10 overflow-hidden rounded-full bg-(--c-border) transition group-hover:bg-(--c-ink)/25">
                        <span className="block h-full origin-left rounded-full bg-(--c-accent) transition-transform duration-300 ease-out" style={{ transform: `scaleX(${fill})` }} />
                      </span>
                    </button>
                  )
                })}
              </div>
              <span className="font-mono text-xs text-(--c-muted)">
                {STEPS[step].no} / {String(STEPS.length).padStart(2, '0')}
              </span>
            </div>
          </div>
          <div className="order-1 mx-auto w-full max-w-[min(36dvh,calc(100dvh-390px))] md:order-2 md:max-w-none">
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
        <h2 className="tm-headline tm-reveal mt-4 text-4xl md:text-6xl" style={{ '--delay': '0.1s' } as CSSProperties}>
          어디든 가고 싶어지는 <em>마법</em>
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-border) sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="tm-reveal bg-(--c-surface) p-6" style={{ '--delay': `${0.1 + (i % 3) * 0.1}s` } as CSSProperties}>
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
            <h2 className="tm-headline tm-reveal mt-4 text-4xl md:text-6xl" style={{ '--delay': '0.1s' } as CSSProperties}>
              이달의 <em>컨셉지도</em>
            </h2>
          </div>
          {/* 한 장씩 가운데로 넘어와 커진 채로 머문다. 마우스를 올리거나 카드에 초점이 가면 멈춘다 */}
          <div
            ref={stripRef}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="mt-8 overflow-hidden pb-8 pt-6 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
          >
            <div
              className={`flex w-max ${animate ? 'transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]' : ''}`}
              style={{ transform: `translateX(${stripW / 2 - (n + slide) * SLIDE_W - CARD_W / 2}px)` }}
              onTransitionEnd={(ev) => {
                // 가운데 줄 끝까지 왔으면 애니메이션 없이 처음 위치로 되감는다 (보이는 모습은 똑같다)
                if (ev.target !== ev.currentTarget || slide < n) return
                setAnimate(false)
                setSlide((i) => i - n)
              }}
            >
              {[...slides, ...slides, ...slides].map((e, i) => {
                const copy = i < n || i >= 2 * n
                const center = i === n + slide
                return (
                  <div key={i} className="shrink-0 pr-6" aria-hidden={copy || undefined}>
                    {/* 카드 크기와 딱 맞는 상자를 키워서 제자리에서 커진다 (카드의 .tm-reveal 은 투명도 전환만 가져서 여기서 따로) */}
                    <div className={`w-60 transition-[scale] duration-500 ease-out ${center ? 'scale-[1.08] motion-reduce:scale-100' : ''}`}>
                      <Link
                        href={`/maps/${e.map.id}`}
                        tabIndex={copy ? -1 : undefined}
                        className="tm-reveal block w-60 bg-(--paper-photo) p-2.5 pb-4 text-(--paper-photo-text) shadow-[0_12px_30px_-10px_rgb(0_0_0/0.35)] transition hover:-translate-y-1 hover:rotate-0"
                        style={{ transform: `rotate(${[-2, 1.5, -1, 2][i % 4]}deg)`, '--delay': `${0.1 + (i % n) * 0.08}s` } as CSSProperties}
                      >
                        <MapThumb id={e.map.id} theme={e.map.theme} cover={e.map.coverUrl} dots={e.pinCount} className="h-48" />
                        <p className="mt-3 truncate font-bold">{e.map.title}</p>
                        <p className="mt-0.5 font-mono text-[0.6875rem] uppercase opacity-60">
                          #{e.rank} · {e.owner.nickname} · {e.users} explored
                        </p>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---- 5. 마지막 한마디 ---- */}
      <section className="border-t border-(--c-border) px-4 py-28 text-center md:px-10">
        <p className="tm-label dot tm-reveal">your turn</p>
        {/* 한 줄씩 차례로 떠오른다 */}
        <h2 className="tm-headline mx-auto mt-6 max-w-4xl text-5xl md:text-8xl">
          <span className="tm-reveal block" style={{ '--delay': '0.1s' } as CSSProperties}>
            내가 지나온 <em>추억</em>을
          </span>
          <span className="tm-reveal block" style={{ '--delay': '0.3s' } as CSSProperties}>
            지도에 남겨요
          </span>
        </h2>
        <Link href={startHref} style={{ '--delay': '0.5s' } as CSSProperties} className="tm-btn tm-reveal mt-10 inline-block rounded-full bg-(--c-accent) px-8 py-4 text-base font-bold text-(--c-accent-text)">
          {loggedIn ? '내 지도로 가기 →' : '무료로 시작하기 →'}
        </Link>
        <p className="tm-reveal mt-16 font-mono text-[0.6875rem] uppercase tracking-wider text-(--c-muted)" style={{ '--delay': '0.65s' } as CSSProperties}>© my concept map · made for explorers</p>
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
  // 라이트 · 다크 · 색 테마가 바뀌면 그림을 새로 만든다: 브라우저가 SVG 무늬(pattern)를 캐시해서 예전 색이 남는 경우가 있다
  const { mode } = useAppearance()
  const color = useSiteColor()
  return (
    <svg key={`${mode}-${color}`} viewBox="0 0 400 440" className="block h-auto w-full" role="img" aria-label="My Concept Map 예시 (성수동 코스)">
      <defs>
        <pattern id="tm-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke="currentColor" strokeOpacity="0.05" />
        </pattern>
        <pattern id="tm-wave" width="26" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q 6.5 1, 13 6 T 26 6" fill="none" strokeOpacity="0.7" strokeWidth="1.4" style={{ stroke: 'var(--paper-wave)' }} />
        </pattern>
      </defs>
      <rect width="400" height="440" style={{ fill: 'var(--paper-bg)' }} />
      <rect width="400" height="440" fill={tint} fillOpacity="0.05" style={{ transition: 'fill 0.6s' }} />
      <rect width="400" height="440" fill="url(#tm-grid)" />

      {/* 건물 */}
      {blocks.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="5" strokeWidth="1" style={{ fill: `var(--paper-block-${(i % 3) + 1})`, stroke: 'var(--paper-block-line)' }} />
      ))}

      {/* 서울숲 */}
      <path d="M-10 196 C 30 186, 70 196, 96 214 C 110 250, 96 282, 60 292 C 26 300, -4 290, -10 280 Z" style={{ fill: 'var(--paper-park)' }} />
      <path d="M8 222 C 26 214, 48 220, 58 236 C 62 252, 44 262, 26 258 C 10 254, 2 240, 8 222 Z" fillOpacity="0.8" style={{ fill: 'var(--paper-pond)' }} />
      <text x="20" y="282" fontSize="13">🌳</text>
      <text x="64" y="272" fontSize="15">🌳</text>
      <text x="74" y="230" fontSize="11">🌲</text>
      <text x="40" y="210" fontFamily="var(--font-mono)" fontSize="7.5" letterSpacing="0.06em" style={{ fill: 'var(--paper-park-label)' }} >SEOUL FOREST</text>

      {/* 한강 */}
      <path d="M-10 384 C 70 350, 150 404, 240 372 S 370 330, 410 344 L410 450 L-10 450Z" style={{ fill: 'var(--paper-river)' }} />
      <path d="M-10 384 C 70 350, 150 404, 240 372 S 370 330, 410 344 L410 450 L-10 450Z" fill="url(#tm-wave)" />
      <text x="300" y="408" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="0.2em" style={{ fill: 'var(--paper-river-label)' }} >HAN RIVER</text>

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
            <path d={d as string} strokeWidth={(w as number) + 2} style={{ stroke: 'var(--paper-road-edge)' }} />
            <path d={d as string} strokeWidth={w as number} style={{ stroke: 'var(--paper-road)' }} />
          </g>
        ))}
      </g>
      <g fontFamily="var(--font-mono)" fontSize="7" letterSpacing="0.08em" style={{ fill: 'var(--paper-road-label)' }}>
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
          <path id="tm-hero-route" d={ROUTE} fill="none" strokeWidth="13" strokeLinecap="round" style={{ stroke: 'var(--paper-road)' }} />
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
            <p className="font-mono text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-(--c-muted)">my concept map</p>
            <p className="text-[0.9375rem] font-extrabold tracking-tight">성수 빵지순례 🥐</p>
          </div>
          <span className="flex -space-x-2">
            {['#ff9ec7', '#8fd9ff', '#ffd84a'].map((c, i) => (
              <span key={c} className="grid size-7 place-items-center rounded-full text-[0.6875rem] font-bold ring-2 ring-(--c-surface)" style={{ background: c }}>
                {['민', '지', '+2'][i]}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* 폴라로이드 사진 (장소 추억) */}
      <div className="absolute -bottom-10 -left-14 w-32 -rotate-[9deg] bg-(--paper-photo) p-2 pb-6 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)] animate-[tm-float_6s_ease-in-out_infinite] max-md:-left-3 max-md:w-24">
        <div className="relative grid aspect-square place-items-center overflow-hidden bg-gradient-to-br from-[#ffd9a8] via-[#ffb98a] to-[#f08a6a] text-5xl max-md:text-4xl">
          🥐
          <span className="absolute bottom-1 right-1.5 font-mono text-[0.5rem] font-bold text-white/90">10.30</span>
        </div>
        <p className="mt-1.5 text-center text-[0.6875rem] font-bold text-(--paper-photo-text)" style={{ fontFamily: '"Gaegu", var(--font-sans)' }}>
          소금빵 성공 ✌️
        </p>
        <span className="absolute -top-2.5 left-1/2 h-4 w-12 -translate-x-1/2 rotate-3 bg-(--c-lime)/80" aria-hidden />
      </div>
      <div className="absolute -right-12 top-[46%] w-28 rotate-[7deg] bg-(--paper-photo) p-2 pb-5 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)] animate-[tm-float_7s_1s_ease-in-out_infinite] max-md:-right-3 max-md:w-20">
        <div className="grid aspect-square place-items-center bg-gradient-to-br from-[#c9ecff] via-[#a7d8f5] to-[#7ab8e8] text-4xl max-md:text-3xl">☕</div>
        <span className="absolute -top-2 right-3 h-4 w-10 -rotate-6 bg-(--c-pink)/80" aria-hidden />
      </div>

      {/* 티켓 메모 */}
      <div className="absolute -bottom-6 right-6 flex rotate-[-3deg] overflow-hidden rounded-lg bg-(--c-strip) text-(--c-strip-text) shadow-lg animate-[tm-float_5s_0.5s_ease-in-out_infinite]">
        <div className="px-3 py-2">
          <p className="font-mono text-[0.5rem] uppercase tracking-[0.2em] opacity-60">course · seongsu</p>
          <p className="font-mono text-[0.75rem] font-bold">4 PLACES · 1H 20M</p>
        </div>
        <div className="grid place-items-center border-l border-dashed border-white/30 bg-(--c-lime) px-2.5 font-mono text-[0.625rem] font-bold text-gray-900">GO</div>
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

/** 채팅 말풍선이 차례로 나타나기 (i 번째, 사라질 때는 한꺼번에) */
const chatAppear = (show: boolean, i: number): CSSProperties => {
  const delay = show ? 0.35 + i * 0.45 : 0
  return { opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(10px)', transition: `opacity .4s ${delay}s, transform .4s ${delay}s` }
}

/** 친구 말풍선 (왼쪽: 얼굴 + 이름 + 흰 말풍선) */
function FriendBubble({ style, face, name, text }: { style: CSSProperties; face: string; name: string; text: string }) {
  return (
    <div className="flex items-end gap-1.5" style={style}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-(--chat-bubble) text-sm">{face}</span>
      <div>
        <p className="mb-0.5 text-[0.625rem] text-(--chat-sub)">{name}</p>
        <p className="rounded-xl rounded-tl-sm bg-(--chat-bubble) px-2.5 py-1.5 text-[0.75rem] leading-snug text-(--chat-text)">{text}</p>
      </div>
    </div>
  )
}

/** 4단계 그림: 친구들 단톡방에 내 지도를 공유하고, 친구들이 답하는 모습. 말풍선이 하나씩 올라온다 */
function ShareChat({ show }: { show: boolean }) {
  const appear = (i: number) => chatAppear(show, i)
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden rounded-3xl border-[1.5px] border-(--c-ink) bg-(--chat-bg) shadow-[8px_8px_0_var(--c-ink)] transition-all duration-700"
      style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'scale(0.96)' }}
      aria-hidden
    >
      {/* 방 제목 */}
      <div className="flex items-center gap-2 bg-(--chat-head) px-4 py-2.5 text-(--chat-text)">
        <span className="text-sm">‹</span>
        <span className="text-[0.8125rem] font-bold">주말 빵지순례 🥐</span>
        <span className="text-[0.75rem] text-(--chat-sub)">4</span>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2 px-3 pb-2">
        <FriendBubble style={appear(0)} face="🐰" name="민지" text="이번 주말에 뭐 하지?" />

        {/* 내가 보낸 지도 카드 */}
        <div className="flex justify-end" style={appear(1)}>
          <div className="w-44 overflow-hidden rounded-xl bg-(--chat-bubble) text-(--chat-text) shadow-sm">
            <svg viewBox="0 0 400 440" className="block h-24 w-full" preserveAspectRatio="xMidYMid slice">
              <rect width="400" height="440" style={{ fill: 'var(--chat-card-map)' }} />
              <path d={ROUTE} fill="none" stroke="#ff5a2b" strokeWidth="10" strokeLinecap="round" />
              {PINS.map((p) => (
                <circle key={p.e} cx={p.x} cy={p.y} r="22" fill={p.c} stroke="#fff" strokeWidth="6" />
              ))}
            </svg>
            <div className="px-2.5 py-2">
              <p className="text-[0.75rem] font-bold">성수 빵지순례 🥐</p>
              <p className="text-[0.625rem] text-(--chat-sub)">My Concept Map · 장소 4곳</p>
            </div>
            <p className="border-t border-(--chat-line) py-1.5 text-center text-[0.6875rem] font-semibold">지도 보기</p>
          </div>
        </div>
        <div className="flex justify-end" style={appear(2)}>
          <p className="rounded-xl rounded-tr-sm bg-[#FEE500] px-2.5 py-1.5 text-[0.75rem] text-gray-900">여기 다 같이 가자!</p>
        </div>

        <FriendBubble style={appear(3)} face="🐻" name="준호" text="나 📚 동네 책방도 지도에 넣어놨어! 토요일 콜?" />
      </div>

      {/* 입력창 */}
      <div className="flex items-center gap-2 bg-(--chat-bubble) px-3 py-2">
        <span className="flex-1 text-[0.6875rem] text-(--chat-sub)">메시지 입력</span>
        <span className="rounded-md bg-[#FEE500] px-2 py-0.5 text-[0.625rem] font-bold text-gray-900">전송</span>
      </div>
    </div>
  )
}

function StepMap({ step }: { step: number }) {
  // 3단계(꾸미기)에서 색 동그라미를 누르면 진짜로 지도 색이 바뀐다
  const [pick, setPick] = useState(PICK_COLORS[0])
  const tint = step === 2 ? pick : STEP_TINTS[step]
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* 4단계에서는 지도 대신 채팅방 그림이 그 자리에 뜬다 */}
      <div className="overflow-hidden rounded-3xl border-[1.5px] border-(--c-ink) shadow-[8px_8px_0_var(--c-ink)] transition-all duration-700" style={{ opacity: step === 3 ? 0 : 1, transform: step === 3 ? 'scale(0.94)' : 'none' }}>
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
                <rect x={(x as number) - 34} y={(y as number) - 13} width="68" height="26" rx="13" stroke="currentColor" strokeOpacity="0.15" style={{ fill: 'var(--chat-bubble)' }} />
                <text x={x as number} y={(y as number) + 5} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--chat-text)' }} >
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
      {/* 4단계: 단톡방에 지도를 공유한 그림 */}
      <ShareChat show={step === 3} />
      {/* 3단계: 꾸미기 도구 */}
      <div
        className={`absolute bottom-3 left-1/2 flex items-center gap-2 md:-bottom-6 rounded-full bg-(--c-surface) p-2 pl-3.5 shadow-lg ring-1 ring-(--c-border) transition-all duration-500 ${step === 2 ? '' : 'pointer-events-none'}`}
        style={{ opacity: step === 2 ? 1 : 0, transform: `translateX(-50%) translateY(${step === 2 ? 0 : 16}px)` }}
        role="radiogroup"
        aria-label="지도 색 골라 보기"
      >
        <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-(--c-muted)">tap!</span>
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
