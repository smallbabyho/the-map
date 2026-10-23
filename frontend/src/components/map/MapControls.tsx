'use client'

import { FitIcon, MinusIcon, PlusIcon } from '../icons'
import type { MapInsets } from './types'

interface Props {
  insets: MapInsets
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFit?: () => void
}

/** 지도 오른쪽 아래에 떠 있는 확대/축소/전체보기 버튼 */
export function MapControls({ insets, onZoomIn, onZoomOut, onFit }: Props) {
  const btn =
    'grid size-10 place-items-center text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40'
  return (
    <div
      className="absolute right-3 z-10 flex flex-col gap-2 transition-[bottom] duration-200"
      style={{ bottom: insets.bottom + 16 }}
    >
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
