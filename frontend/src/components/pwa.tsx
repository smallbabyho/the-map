'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
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
  return guide ? (
    <InstallGuide
      onClose={() => {
        guideOpen = false
        emit()
      }}
    />
  ) : null
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
