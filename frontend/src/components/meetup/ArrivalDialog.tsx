'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ARRIVAL_RADIUS_M, currentPosition, distanceMeters, readPhotoInfo } from '../../lib/arrival'
import type { ArrivalProof, Pin } from '../../types'
import { CloseIcon } from '../icons'

const HOUR = 3600_000

interface Props {
  pin: Pin
  /** 모임 시각 (사진 촬영 시각이 이 날 근처인지 본다) */
  meetAt: string
  onArrive: (proof: ArrivalProof) => Promise<void>
  onClose: () => void
}

/**
 * 성지순례 도착 인증: 📍 지금 위치(GPS) 또는 📷 그 자리에서 찍은 사진의 촬영 위치 · 시각.
 * 장소 300m 안이어야 한다 (서버가 다시 잰다). 위치는 저장하지 않고 거리만 남는다.
 */
export function ArrivalDialog({ pin, meetAt, onArrive, onClose }: Props) {
  const [busy, setBusy] = useState<'gps' | 'photo' | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const send = async (proof: ArrivalProof) => {
    const d = Math.round(distanceMeters(proof, pin.place))
    if (d > ARRIVAL_RADIUS_M) throw new Error(`장소에서 ${d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${d}m`} 떨어져 있어요. ${ARRIVAL_RADIUS_M}m 안에서 인증해 주세요.`)
    await onArrive(proof)
    onClose()
  }

  const byGps = async () => {
    setBusy('gps')
    setError('')
    try {
      const p = await currentPosition()
      await send({ lat: p.lat, lng: p.lng, method: 'gps' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증하지 못했어요.')
    } finally {
      setBusy(null)
    }
  }

  const byPhoto = async (file: File | undefined) => {
    if (!file) return
    setBusy('photo')
    setError('')
    try {
      const info = await readPhotoInfo(file)
      if (info.lat == null || info.lng == null) throw new Error('사진에 촬영 위치가 없어요. 카메라 설정에서 위치 태그를 켜고 찍은 원본 사진을 골라 주세요.')
      if (!info.takenAt) throw new Error('사진에 촬영 시각이 없어요. 그 자리에서 찍은 원본 사진을 골라 주세요.')
      const t = info.takenAt.getTime()
      const meet = new Date(meetAt).getTime()
      if (t < meet - 12 * HOUR || t > meet + 48 * HOUR || t > Date.now() + 10 * 60_000) throw new Error('모임 날에 찍은 사진이 아니에요. 오늘 그 자리에서 찍은 사진으로 인증해 주세요.')
      await send({ lat: info.lat, lng: info.lng, method: 'photo' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증하지 못했어요.')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()} role="dialog" aria-modal aria-label="도착 인증">
      <div className="w-full max-w-sm rounded-3xl bg-(--c-surface) p-5 text-(--c-text) shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-(--c-muted)">도착 인증</p>
            <h2 className="mt-0.5 truncate text-lg font-bold">
              {pin.icon} {pin.place.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-(--c-muted)">장소 {ARRIVAL_RADIUS_M}m 안에 있어야 도착으로 체크돼요.</p>

        <button
          type="button"
          onClick={byGps}
          disabled={!!busy}
          className="tm-btn mt-4 flex w-full items-center gap-3 rounded-2xl bg-(--c-accent) px-4 py-3 text-left text-(--c-accent-text) disabled:opacity-60"
        >
          <span className="text-2xl" aria-hidden>📍</span>
          <span>
            <span className="block text-[0.9375rem] font-bold">{busy === 'gps' ? '위치 확인하는 중…' : '지금 위치로 인증'}</span>
            <span className="block text-xs opacity-80">휴대폰 GPS로 바로 확인해요</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-(--c-border) px-4 py-3 text-left transition hover:bg-black/[0.03] disabled:opacity-60"
        >
          <span className="text-2xl" aria-hidden>📷</span>
          <span>
            <span className="block text-[0.875rem] font-bold">{busy === 'photo' ? '사진 확인하는 중…' : '사진으로 인증'}</span>
            <span className="block text-xs text-(--c-muted)">GPS가 안 잡힐 때: 그 자리에서 찍은 사진의 촬영 위치 · 시각으로</span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/*" className="hidden" onChange={(e) => byPhoto(e.target.files?.[0])} />

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">
            {error}
          </p>
        )}
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-(--c-muted)">위치와 사진은 저장하지 않아요. 장소까지의 거리만 도착 기록에 남아요.</p>
      </div>
    </div>,
    document.body,
  )
}
