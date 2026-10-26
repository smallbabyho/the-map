'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createMapInvite, removeMapEditor } from '../../db/api'
import { siteOrigin } from '../../lib/site'
import type { MapCollab } from '../../types'
import { Avatar } from '../Avatar'

/**
 * 함께 꾸미기: 같이 꾸미는 사람 얼굴 + 초대 링크 복사 · 내보내기(주인) · 나가기(편집자).
 * 초대 링크: /maps/{mapId}/join?code=…  (받은 사람이 '참여하기'를 누르면 공동 편집자가 된다)
 */
export function CollabButton({ mapId, myId, collab, onChange, variant = 'float' }: { mapId: string; myId: string; collab: MapCollab; onChange: () => void; variant?: 'float' | 'inline' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isOwner = collab.myRole === 'owner'
  const people = [collab.owner, ...collab.editors]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const flash = (msg: string) => {
    setNote(msg)
    setTimeout(() => setNote(''), 2200)
  }

  const copyInvite = async (reset = false) => {
    setBusy(true)
    try {
      const code = isOwner ? await createMapInvite(mapId, reset) : collab.inviteCode
      if (!code) return flash('지도 주인에게 초대 링크를 부탁해 주세요.')
      await navigator.clipboard.writeText(`${siteOrigin()}/maps/${mapId}/join?code=${code}`)
      flash(reset ? '새 링크를 복사했어요. 예전 링크는 이제 안 돼요.' : '초대 링크를 복사했어요. 친구에게 보내 주세요!')
      onChange()
    } catch (e) {
      flash(e instanceof Error ? e.message : '링크를 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string, nickname: string, self: boolean) => {
    if (!window.confirm(self ? '이 지도에서 나갈까요? 다시 들어오려면 초대 링크가 필요해요.' : `${nickname}님을 함께 꾸미기에서 뺄까요?`)) return
    try {
      await removeMapEditor(mapId, userId)
      if (self) router.push('/')
      else onChange()
    } catch (e) {
      flash(e instanceof Error ? e.message : '처리하지 못했어요.')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          variant === 'float'
            ? 'tm-float flex h-10 items-center gap-2 rounded-full bg-(--c-surface) pl-1.5 pr-4 text-[13px] font-semibold'
            : 'flex h-9 items-center gap-2 rounded-full border border-(--c-border) pl-1 pr-3 text-[13px] font-semibold'
        }
      >
        <span className="flex -space-x-2">
          {people.slice(0, 3).map((p) => (
            <Avatar key={p.id} id={p.id} nickname={p.nickname} src={p.avatarUrl} size={26} ring />
          ))}
        </span>
        함께 꾸미기{collab.editors.length > 0 && <span className="font-mono text-xs text-(--c-muted)">{people.length}</span>}
      </button>

      {open && (
        <div className={`tm-float absolute z-40 mt-2 w-80 rounded-2xl bg-(--c-surface) p-4 text-(--c-text) ${variant === 'float' ? 'right-0' : 'left-0'}`} role="dialog" aria-label="함께 꾸미기">
          <p className="tm-label dot">co-edit</p>
          <p className="mt-2 text-sm text-(--c-muted)">초대 링크를 받은 친구가 이 지도의 핀 · 경로 · 꾸미기를 같이 고칠 수 있어요.</p>

          <ul className="mt-3 space-y-1">
            {people.map((p, i) => {
              const owner = i === 0
              return (
                <li key={p.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                  <Avatar id={p.id} nickname={p.nickname} src={p.avatarUrl} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {p.nickname}
                    {p.id === myId && <span className="ml-1 font-normal text-(--c-muted)">(나)</span>}
                  </span>
                  <span className="tm-label">{owner ? 'owner' : 'editor'}</span>
                  {!owner && isOwner && (
                    <button type="button" onClick={() => remove(p.id, p.nickname, false)} className="text-xs font-semibold text-red-500 hover:underline">
                      빼기
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={() => copyInvite(false)}
            disabled={busy}
            className="tm-btn mt-3 h-11 w-full rounded-xl bg-(--c-accent) text-sm font-bold text-(--c-accent-text) disabled:opacity-60"
          >
            🔗 초대 링크 복사
          </button>
          {note && <p className="mt-2 text-center text-xs font-semibold text-(--c-accent)">{note}</p>}

          <div className="mt-3 flex justify-between text-xs">
            {isOwner ? (
              <button type="button" onClick={() => copyInvite(true)} disabled={busy} className="font-semibold text-(--c-muted) hover:text-(--c-text) hover:underline">
                링크 새로 만들기 (예전 링크 막기)
              </button>
            ) : (
              <span className="text-(--c-muted)">공개 여부 · 삭제는 주인만 바꿀 수 있어요</span>
            )}
            {collab.myRole === 'editor' && (
              <button type="button" onClick={() => remove(myId, '', true)} className="font-semibold text-red-500 hover:underline">
                나가기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
