'use client'

import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

// 홈 화면 앱(PWA): 서비스 워커 등록 + '앱으로 설치' 버튼.
// 안드로이드 · 크롬은 브라우저의 설치 창(beforeinstallprompt)을 띄우고, 아이폰 사파리는 설치 방법을 안내한다 (사파리는 설치 창이 없다).

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
/** 설치 방법 안내 창 (메뉴가 닫혀도 남아 있게 PwaSetup 이 그린다) */
let guideOpen = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** 이미 앱으로 열려 있는지 (홈 화면에서 실행) */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** 루트 레이아웃에 한 번: 서비스 워커 등록 (배포 환경만, 개발 중엔 캐시가 헷갈리게 해서 끈다) + 설치 창 붙잡기 */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    }
    const onPrompt = (e: Event) => {
      e.preventDefault() // 브라우저가 바로 띄우지 않게 붙잡아 두고, 메뉴의 '앱으로 설치' 에서 띄운다
      deferred = e as InstallPromptEvent
      emit()
    }
    const onInstalled = () => {
      deferred = null
      emit()
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  const guide = useSyncExternalStore(subscribe, () => guideOpen, () => false)
  return (
    <>
      {/* 주소(usePathname)를 읽어서 Suspense 안에 (밖이면 화면을 미리 그려 둘 수 없다) */}
      <Suspense fallback={null}>
        <IosInstallBanner />
      </Suspense>
      {guide && (
        <InstallGuide
          onClose={() => {
            guideOpen = false
            emit()
          }}
        />
      )}
    </>
  )
}

const BANNER_KEY = 'the-map:ios-install-banner'
const BANNER_SNOOZE = 14 * 864e5 // '다음에' 를 누르면 2주 동안 안 띄운다

/** 아이폰 사파리 (홈 화면 추가는 사파리에서만, 아이패드는 공유 버튼이 위에 있어서 뺀다) */
function isIphoneSafari() {
  const ua = navigator.userAgent
  return /iphone|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|kakaotalk|naver|instagram|fban|fbav|line\//i.test(ua)
}

/** 사파리 공유 버튼 모양 (네모 + 위 화살표) */
function ShareGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16" />
      <path d="M12 14V3M8.5 6.5 12 3l3.5 3.5" />
    </svg>
  )
}

/**
 * 아이폰 사파리 하단 안내 띠: 사파리는 사이트가 '홈 화면에 추가' 를 대신 해 줄 수 없어서,
 * 아래쪽 공유 버튼을 가리키며 방법을 알려 준다. 화면을 꽉 쓰는 지도 편집 · 순례방에서는 띄우지 않는다.
 */
function IosInstallBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const fullScreen = /^\/maps\/[^/]+$/.test(pathname) || /^\/meetups\/[^/]+\/room/.test(pathname)

  useEffect(() => {
    if (!isIphoneSafari() || isStandalone()) return
    try {
      const at = Number(localStorage.getItem(BANNER_KEY) ?? 0)
      if (Date.now() - at < BANNER_SNOOZE) return
    } catch {
      return // 저장소를 못 쓰면 닫아도 매번 뜨니까 아예 안 띄운다
    }
    const t = window.setTimeout(() => setShow(true), 3000)
    return () => window.clearTimeout(t)
  }, [])

  if (!show || fullScreen) return null
  const close = () => {
    setShow(false)
    try {
      localStorage.setItem(BANNER_KEY, String(Date.now()))
    } catch {
      // 이번에만 닫힌다
    }
  }

  return (
    // 아래 탭 바(64px) 위에 띄운다
    <div className="tm-intro fixed inset-x-3 z-[60] md:hidden" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }} role="dialog" aria-label="홈 화면에 앱으로 추가하기">
      <div className="relative rounded-2xl bg-(--c-ink) p-3.5 pr-10 text-(--c-bg) shadow-2xl">
        <button type="button" onClick={close} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full opacity-70 hover:opacity-100" aria-label="닫기">
          <CloseIcon size={16} />
        </button>
        <p className="flex items-center gap-1.5 text-sm font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 앱 아이콘 하나라 최적화가 필요 없다 */}
          <img src="/icons/icon-192.png" alt="" width={22} height={22} className="rounded-md" /> 홈 화면에 앱으로 두세요
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.8125rem] opacity-85">
          아래 <span className="inline-flex items-center gap-0.5 rounded-md bg-white/15 px-1.5 py-0.5 font-semibold"><ShareGlyph size={15} /> 공유</span>
          → <b>홈 화면에 추가</b> 를 누르면 앱처럼 열려요.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              guideOpen = true
              emit()
            }}
            className="rounded-full bg-(--c-accent) px-3 py-1.5 text-xs font-bold text-(--c-accent-text)"
          >
            자세히 보기
          </button>
          <button type="button" onClick={close} className="rounded-full px-3 py-1.5 text-xs font-semibold opacity-75">
            다음에
          </button>
        </div>
        {/* 사파리 아래쪽 공유 버튼을 가리키는 꼬리 */}
        <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-(--c-ink)" aria-hidden />
      </div>
    </div>
  )
}

/** 이미 홈 화면 앱으로 열었는지 (서버에서 그릴 땐 true: 설치 안내를 먼저 그렸다 지우지 않게) */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribe, isStandalone, () => true)
}

/** ☰ 메뉴 · 첫 안내의 '📱 앱으로 설치'. 이미 앱으로 열었으면 안 보인다 */
export function InstallAppButton({ className = '', onDone, label }: { className?: string; onDone?: () => void; label?: string }) {
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => true)
  if (standalone) return null

  // 항상 설명 창부터 (바로 설치가 되는 브라우저면 그 창 맨 위에 '지금 바로 설치')
  const open = () => {
    guideOpen = true
    emit()
    onDone?.()
  }

  return (
    <button type="button" onClick={open} className={className}>
      {label ?? '📱 앱으로 설치'}
    </button>
  )
}

type Browser = 'chrome' | 'safari'

/** 브라우저 · 기기별 설치 순서 */
function installSteps(browser: Browser, mobile: boolean, ios: boolean): string[] {
  if (browser === 'safari') {
    return mobile
      ? ['아래쪽(아이패드는 위쪽) 공유 버튼(⬆️ 네모에서 화살표)을 눌러요', "목록을 내려 '홈 화면에 추가' 를 눌러요", "오른쪽 위 '추가' 를 누르면 홈 화면에 아이콘이 생겨요"]
      : ["맥 사파리 위쪽 메뉴에서 '파일' 을 눌러요", "'Dock에 추가…' 를 눌러요", "'추가' 를 누르면 Dock 에 앱 아이콘이 생겨요 (사파리 17 이상)"]
  }
  if (ios) {
    return ['크롬 주소창 오른쪽 공유 버튼(⬆️)을 눌러요', "'홈 화면에 추가' 를 눌러요", "'추가' 를 누르면 홈 화면에 아이콘이 생겨요 (iOS 16.4 이상)"]
  }
  return mobile
    ? ['크롬 오른쪽 위 메뉴(⋮)를 눌러요', "'앱 설치' 또는 '홈 화면에 추가' 를 눌러요", "'설치' 를 누르면 홈 화면에 아이콘이 생겨요"]
    : ['크롬 주소창 오른쪽 끝의 설치 아이콘(🖥️⬇)을 눌러요', "아이콘이 없으면 오른쪽 위 메뉴(⋮) → '전송, 저장, 공유' → '페이지를 앱으로 설치'", "'설치' 를 누르면 바탕화면 · 독에서 앱처럼 열려요"]
}

function InstallGuide({ onClose }: { onClose: () => void }) {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const mobile = ios || /android|mobile/i.test(ua)
  // 아이폰의 크롬은 CriOS, 맥 · 아이폰 사파리는 Safari 만 있고 Chrome 이 없다
  const safari = /safari/i.test(ua) && !/chrome|crios|chromium|edg|android/i.test(ua)
  const [browser, setBrowser] = useState<Browser>(safari ? 'safari' : 'chrome')
  const steps = installSteps(browser, mobile, ios)
  const canPrompt = useSyncExternalStore(subscribe, () => deferred != null, () => false)
  /** 브라우저의 설치 창 띄우기 (크롬 · 엣지 · 삼성 인터넷) */
  const installNow = async () => {
    const e = deferred
    if (!e) return
    deferred = null
    emit()
    await e.prompt().catch(() => {})
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal aria-label="앱으로 설치하는 방법">
      <div className="w-full max-w-sm rounded-3xl bg-(--c-surface) p-5 text-(--c-text) shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📱 앱으로 설치하기</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-(--c-muted)">홈 화면에 아이콘을 두면 주소창 없이 앱처럼 바로 열려요.</p>

        {canPrompt && (
          <>
            <button type="button" onClick={installNow} className="tm-btn mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-(--c-accent) text-[0.9375rem] font-bold text-(--c-accent-text)">
              📲 지금 바로 설치
            </button>
            <p className="mt-2 text-center text-xs text-(--c-muted)">누르면 브라우저의 설치 창이 떠요. 안 뜨면 아래 방법대로 해 주세요.</p>
          </>
        )}

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-black/[0.05] p-1 text-sm font-semibold" role="tablist" aria-label="브라우저">
          {(
            [
              ['chrome', '크롬'],
              ['safari', '사파리'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={browser === id}
              onClick={() => setBrowser(id)}
              className={`h-9 rounded-lg transition ${browser === id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}
            >
              {label}
              {(id === 'safari') === safari && <span className="ml-1 text-[0.6875rem] font-medium text-(--c-accent)">· 지금</span>}
            </button>
          ))}
        </div>

        <ol className="mt-4 space-y-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--c-accent) text-xs font-bold text-(--c-accent-text)">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        {browser === 'safari' && !ios && !/macintosh/i.test(ua) && <p className="mt-3 text-xs text-(--c-muted)">사파리는 아이폰 · 아이패드 · 맥에서만 있어요.</p>}

        <button
          type="button"
          onClick={onClose}
          className={`mt-5 h-11 w-full rounded-xl text-sm font-bold ${canPrompt ? 'border border-(--c-border)' : 'tm-btn bg-(--c-accent) text-(--c-accent-text)'}`}
        >
          {canPrompt ? '닫기' : '알겠어요'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
