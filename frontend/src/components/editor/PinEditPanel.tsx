'use client'

import { useRef, useState } from 'react'
import { uploadPinPhoto } from '../../db/api'
import type { Pin } from '../../types'
import { CheckIcon, CloseIcon, ImageIcon, TrashIcon } from '../icons'
import { isCustomPlace } from '../map'
import { placeHref } from '../place/PlaceStats'
import { EmojiPicker } from '../EmojiPicker'
import { similarColors, type Theme } from '../themes'

interface Props {
  pin: Pin
  index: number
  theme: Theme
  onChange: (patch: Partial<Pick<Pin, 'icon' | 'color' | 'memo' | 'photoUrl' | 'visitedAt'>>) => void
  onRename: (name: string) => void
  onDelete: () => void
  onClose: () => void
}

/** 핀 꾸미기: 아이콘 · 색상 · 방문일 · 메모 · 사진 */
export function PinEditPanel({ pin, index, theme, onChange, onRename, onDelete, onClose }: Props) {
  const custom = isCustomPlace(pin.place.externalId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  // 색 후보: 지도 대표색과 비슷한 계열. 지금 핀 색이 후보에 없으면 맨 앞에
  const similar = similarColors(theme.accent)
  const colors = similar.includes(pin.color.toLowerCase()) ? similar : [pin.color, ...similar]

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setPhotoError('')
    try {
      onChange({ photoUrl: await uploadPinPhoto(file) })
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : '사진을 올리지 못했어요.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const label = 'mb-2 block text-[13px] font-semibold text-(--c-muted)'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 머리 */}
      <div className="flex items-start gap-3 border-b border-(--c-border) px-5 pb-4 pt-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full text-2xl shadow-sm ring-2 ring-(--c-surface)" style={{ background: pin.color }}>
          {pin.icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold text-(--c-accent)">
            {index + 1}번째 장소{custom && <span className="ml-1.5 font-medium text-(--c-muted)">· 직접 지정</span>}
          </p>
          {custom ? (
            <input
              value={pin.place.name}
              onChange={(e) => onRename(e.target.value)}
              maxLength={40}
              placeholder="장소 이름"
              className="-ml-1 w-full rounded-md bg-transparent px-1 text-lg font-bold outline-none hover:bg-black/[0.04] focus:bg-black/[0.04]"
              aria-label="장소 이름"
            />
          ) : (
            <>
              <h2 className="truncate text-lg font-bold">{pin.place.name}</h2>
              <a href={placeHref(pin.place.externalId)} target="_blank" rel="noopener" className="text-xs font-semibold text-(--c-accent) hover:underline">
                ★ 장소 리뷰 · 담긴 횟수 보기 ↗
              </a>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="닫기">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="tm-scroll flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* 사진 */}
        <section>
          <span className={label}>사진</span>
          {pin.photoUrl ? (
            <div className="group relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL/외부 URL 미리보기 */}
              <img src={pin.photoUrl} alt={`${pin.place.name} 사진`} className="aspect-[4/3] w-full object-cover" />
              <div className="absolute right-2 top-2 flex gap-1.5">
                <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                  바꾸기
                </button>
                <button type="button" onClick={() => onChange({ photoUrl: null })} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--c-border) text-sm text-(--c-muted) transition hover:border-(--c-accent) hover:text-(--c-accent) disabled:opacity-60"
            >
              <ImageIcon size={26} />
              {uploading ? '사진 준비 중…' : '사진 추가'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {photoError && <p className="mt-2 text-xs text-red-500">{photoError}</p>}
        </section>

        {/* 아이콘 */}
        <section>
          <span className={label}>아이콘</span>
          <EmojiPicker value={pin.icon} onPick={(e) => onChange({ icon: e })} />
        </section>

        {/* 색상 */}
        <section>
          <span className={label}>색상</span>
          <div className="flex flex-wrap items-center gap-2.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ color: c })}
                className="grid size-8 place-items-center rounded-full shadow-sm ring-offset-2 ring-offset-(--c-surface) transition hover:scale-110"
                style={{ background: c, boxShadow: pin.color === c ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${c}` : undefined }}
                aria-label={`색상 ${c}`}
                aria-pressed={pin.color === c}
              >
                {pin.color === c && <CheckIcon size={16} className="text-white drop-shadow" />}
              </button>
            ))}
            <label className="relative flex h-8 cursor-pointer items-center gap-1 overflow-hidden rounded-full border border-(--c-border) px-2.5 text-xs font-semibold text-(--c-muted)" title="다른 색 고르기">
              <span className="size-3.5 rounded-full" style={{ background: 'conic-gradient(#d98c8c, #d9c38c, #9cc49a, #8cb8d9, #b39cd9, #d98cb8, #d98c8c)' }} aria-hidden />
              다른 색
              <input type="color" value={pin.color} onChange={(e) => onChange({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="색상 직접 고르기" />
            </label>
          </div>
        </section>

        {/* 방문일 */}
        <section>
          <label htmlFor="pin-visited" className={label}>방문일</label>
          <input
            id="pin-visited"
            type="date"
            value={pin.visitedAt ?? ''}
            onChange={(e) => onChange({ visitedAt: e.target.value || null })}
            className="h-11 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-3 text-[15px] outline-none focus:border-(--c-accent)"
          />
        </section>

        {/* 메모 */}
        <section>
          <label htmlFor="pin-memo" className={label}>메모</label>
          <textarea
            id="pin-memo"
            value={pin.memo}
            onChange={(e) => onChange({ memo: e.target.value })}
            rows={4}
            maxLength={500}
            placeholder="이 장소에 대한 기억을 남겨 보세요"
            className="w-full resize-none rounded-xl border border-(--c-border) bg-(--c-surface) px-3 py-2.5 text-[15px] outline-none placeholder:text-(--c-muted)/70 focus:border-(--c-accent)"
          />
          <p className="mt-1 text-right text-xs text-(--c-muted)">{pin.memo.length}/500</p>
        </section>

        <button
          type="button"
          onClick={() => window.confirm(`'${pin.place.name}' 핀을 지울까요?`) && onDelete()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500/10"
        >
          <TrashIcon size={16} />핀 삭제
        </button>
      </div>
    </div>
  )
}
