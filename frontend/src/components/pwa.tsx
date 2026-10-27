'use client'

import { useEffect, useSyncExternalStore } from 'react'
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
export function InstallAppButton({ className = '', onDone }: { className?: string; onDone?: () => void }) {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred != null, () => false)
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => true)
  if (standalone) return null

  const install = async () => {
    if (deferred) {
      const e = deferred
      deferred = null
      emit()
      await e.prompt().catch(() => {})
      onDone?.()
      return
    }
    guideOpen = true
    emit()
    onDone?.()
  }

  return (
    <button type="button" onClick={install} className={className}>
      📱 앱으로 설치{canPrompt ? '' : ' 방법'}
    </button>
  )
}

function InstallGuide({ onClose }: { onClose: () => void }) {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const steps = ios
    ? ['사파리 아래쪽 가운데 공유 버튼(⬆️ 네모에서 화살표)을 눌러요', "목록을 내려 '홈 화면에 추가' 를 눌러요", "오른쪽 위 '추가' 를 누르면 홈 화면에 아이콘이 생겨요"]
    : ['브라우저 오른쪽 위 메뉴(⋮)를 눌러요', "'앱 설치' 또는 '홈 화면에 추가' 를 눌러요", '홈 화면에 생긴 아이콘으로 열면 앱처럼 전체 화면으로 열려요']
  return createPortal(
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal aria-label="앱으로 설치하는 방법">
      <div className="w-full max-w-sm rounded-3xl bg-(--c-surface) p-5 text-(--c-text) shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📱 앱으로 설치하기</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-(--c-muted)">홈 화면에 아이콘을 두고 앱처럼 열 수 있어요.{ios && ' (사파리에서만 돼요)'}</p>
        <ol className="mt-4 space-y-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--c-accent) text-xs font-bold text-(--c-accent-text)">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="tm-btn mt-5 h-11 w-full rounded-xl bg-(--c-accent) text-sm font-bold text-(--c-accent-text)">
          알겠어요
        </button>
      </div>
    </div>,
    document.body,
  )
}
