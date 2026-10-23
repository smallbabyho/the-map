'use client'

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

/** 지도 오른쪽 아래에 떠 있는 확대/축소/전체보기 버튼 */
export function MapControls({ insets, onZoomIn, onZoomOut, onFit, onLocate, locating, located }: Props) {
  const btn =
    'grid size-10 place-items-center text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40'
  return (
    // 모바일: 상단 버튼 바로 아래 (하단 시트와 안 겹치게) / 데스크톱: 오른쪽 아래
    <div
      className="absolute right-3 top-[68px] z-10 flex flex-col gap-2 md:top-auto md:bottom-(--ctl-bottom)"
      style={{ ['--ctl-bottom' as string]: `${insets.bottom + 16}px` }}
    >
      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className={`tm-float rounded-xl bg-white ${btn} ${located ? 'text-blue-600' : ''}`}
          aria-label="내 위치"
          title="내 위치"
        >
          <LocateIcon size={18} className={locating ? 'animate-pulse' : ''} />
        </button>
      )}
      {onFit && (
        <button type="button" onClick={onFit} className={`tm-float rounded-xl bg-white ${btn}`} aria-label="핀 전체 보기" title="핀 전체 보기">
          <FitIcon size={18} />
        </button>
      )}
      {(onZoomIn || onZoomOut) && (
        <div className="tm-float flex flex-col overflow-hidden rounded-xl bg-white">
          <button type="button" onClick={onZoomIn} className={btn} aria-label="확대">
            <PlusIcon size={18} />
          </button>
          <div className="mx-2 h-px bg-gray-200" />
          <button type="button" onClick={onZoomOut} className={btn} aria-label="축소">
            <MinusIcon size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
