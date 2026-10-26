'use client'

import { AppearanceButton } from '../AppearanceButton'
import { FitIcon, LocateIcon, MinusIcon, PlusIcon } from '../icons'
import type { MapInsets } from './types'

interface Props {
  insets: MapInsets
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFit?: () => void
  onLocate?: () => void
  locating?: boolean
  located?: boolean
}

/** 지도 오른쪽 아래에 떠 있는 라이트·다크 / 내 위치 / 전체보기 / 확대·축소 버튼 */
export function MapControls({ insets, onZoomIn, onZoomOut, onFit, onLocate, locating, located }: Props) {
  const btn =
    'grid size-10 place-items-center text-(--c-text) transition hover:bg-black/[0.04] active:bg-black/[0.08] disabled:opacity-40'
  return (
    // 모바일: 상단 버튼 바로 아래 (하단 시트와 안 겹치게) / 데스크톱: 오른쪽 아래
    <div
      className="absolute right-3 top-[68px] z-10 flex flex-col gap-2 md:top-auto md:bottom-(--ctl-bottom)"
      style={{ ['--ctl-bottom' as string]: `${insets.bottom + 16}px` }}
    >
      <AppearanceButton variant="map" />
      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className={`tm-float rounded-xl bg-(--c-surface) ${btn} ${located ? 'text-blue-500' : ''}`}
          aria-label="내 위치"
          title="내 위치"
        >
          <LocateIcon size={18} className={locating ? 'animate-pulse' : ''} />
        </button>
      )}
      {onFit && (
        <button type="button" onClick={onFit} className={`tm-float rounded-xl bg-(--c-surface) ${btn}`} aria-label="핀 전체 보기" title="핀 전체 보기">
          <FitIcon size={18} />
        </button>
      )}
      {/* 확대·축소: 모바일은 두 손가락으로 하니 데스크톱에서만 (모바일 지도 높이에 다 안 들어감) */}
      {(onZoomIn || onZoomOut) && (
        <div className="tm-float hidden flex-col overflow-hidden rounded-xl bg-(--c-surface) md:flex">
          <button type="button" onClick={onZoomIn} className={btn} aria-label="확대">
            <PlusIcon size={18} />
          </button>
          <div className="mx-2 h-px bg-(--c-border)" />
          <button type="button" onClick={onZoomOut} className={btn} aria-label="축소">
            <MinusIcon size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
