'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { siteOrigin } from '../../lib/site'
import { CloseIcon } from '../icons'
import { downloadExport, toText, type ExportData, type ExportFormat } from './exportMap'

/** '내보내기' 버튼 → 형식 고르기 (엑셀 · 구글 내 지도 · GPS 앱 · 글 복사) */
export function ExportMapButton({ data, className = '' }: { data: ExportData; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={data.pins.length === 0}
        title={data.pins.length === 0 ? '장소를 추가하면 내보낼 수 있어요' : '엑셀 · 구글 지도 · GPS 앱 파일로 내보내기'}
        className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-(--c-border) text-sm font-bold transition hover:bg-black/[0.03] disabled:opacity-40 ${className}`}
      >
        <span aria-hidden>📤</span> 내보내기
      </button>
      {open && <ExportDialog data={data} onClose={() => setOpen(false)} />}
    </>
  )
}

const FILES: { format: ExportFormat; emoji: string; label: string; hint: string }[] = [
  { format: 'csv', emoji: '📊', label: '엑셀 · 구글 시트 (CSV)', hint: '장소 · 메모 · 이동 시간 · 지도 링크를 표로' },
  { format: 'kml', emoji: '🌏', label: '구글 내 지도 · 구글 어스 (KML)', hint: 'Google My Maps → 가져오기 에 올리면 핀과 코스가 그대로' },
  { format: 'gpx', emoji: '🧭', label: 'GPS · 등산 · 자전거 앱 (GPX)', hint: '트랭글 · 램블러 · Strava 같은 앱에서 코스로' },
]

function ExportDialog({ data, onClose }: { data: ExportData; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copyText = async () => {
    const text = toText(data, data.map.isPublic ? `${siteOrigin()}/maps/${data.map.id}` : undefined)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드를 못 쓰면 글 파일로
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'course.txt'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  // 팝업은 항상 맨 위: 지도 같은 요소의 겹침 순서에 갇히지 않게 body 에 바로 그린다
  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal aria-label="지도 내보내기">
      <div className="w-full max-w-sm rounded-3xl bg-(--c-surface) p-5 text-(--c-text) shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📤 지도 내보내기</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-(--c-muted)">장소 {data.pins.length}곳을 다른 앱에서 쓸 수 있게 내보내요.</p>

        <button
          type="button"
          onClick={copyText}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-(--c-accent) px-4 py-3 text-left text-(--c-accent-text) transition hover:brightness-95"
        >
          <span className="text-2xl" aria-hidden>📋</span>
          <span>
            <span className="block text-[0.9375rem] font-bold">{copied ? '복사했어요! 붙여 넣으세요 ✓' : '코스 글로 복사'}</span>
            <span className="block text-xs opacity-80">카톡 · 메모에 붙이면 장소마다 카카오맵 링크가 달려요</span>
          </span>
        </button>

        <ul className="mt-2 grid gap-2">
          {FILES.map((f) => (
            <li key={f.format}>
              <button
                type="button"
                onClick={() => downloadExport(data, f.format)}
                className="flex w-full items-center gap-3 rounded-2xl border border-(--c-border) px-4 py-3 text-left transition hover:bg-black/[0.03]"
              >
                <span className="text-2xl" aria-hidden>{f.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-bold">{f.label}</span>
                  <span className="block text-xs text-(--c-muted)">{f.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
