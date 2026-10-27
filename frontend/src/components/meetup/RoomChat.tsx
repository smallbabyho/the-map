'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { addMeetupComment, deleteMeetupComment, uploadPinPhoto } from '../../db/api'
import type { MeetupComment, MeetupCommentKind, MeetupSummary, User } from '../../types'
import { Avatar } from '../Avatar'
import { CloseIcon, ImageIcon, TrashIcon } from '../icons'
import { ReportButton } from '../report/ReportDialog'

const QUICK = ['조금 늦어요 🙏', '도착했어요 📍', '출구 앞이에요 🚇', '먼저 들어가 있을게요 ☕']
const MAX = 500

const timeOf = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
}
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

interface Props {
  meetup: MeetupSummary
  me: User
  /** 순례방 메시지 (공지 먼저 · 나머지 오래된 순, getMeetupComments 그대로) */
  list: MeetupComment[] | null
  /** 보내거나 지운 뒤 다시 불러오기 */
  onChange: () => void
}

/**
 * 순례방 채팅: 말풍선 · 날짜 구분 · 주최자 공지(맨 위 고정) · 사진 · 빠른 답장.
 * 모임 시간이 지나면 보내는 글은 '후기'로 남는다.
 */
export function RoomChat({ meetup, me, list, onChange }: Props) {
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [asNotice, setAsNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showAllNotices, setShowAllNotices] = useState(false)
  // 모임 시간이 지났으면 후기 모드 (처음 볼 때 한 번 정한다)
  const [ended] = useState(() => Date.parse(meetup.meetAt) <= Date.now())
  const file = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const isHost = me.id === meetup.hostId

  const notices = list?.filter((c) => c.kind === 'notice') ?? []
  const messages = list?.filter((c) => c.kind !== 'notice') ?? []
  const kind: MeetupCommentKind = isHost && asNotice ? 'notice' : ended ? 'review' : 'chat'

  // 맨 아래를 보고 있었으면 새 메시지가 올 때 따라 내려간다
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages.length])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => (stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const send = async (text = body) => {
    if (busy || (!text.trim() && !photo)) return
    setBusy(true)
    setError('')
    try {
      await addMeetupComment(meetup.id, { kind, body: text, photoUrl: photo })
      stickToBottom.current = true
      setBody('')
      setPhoto(null)
      setAsNotice(false)
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : '메시지를 보내지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: MeetupComment) => {
    if (!window.confirm(c.kind === 'notice' ? '이 공지를 내릴까요?' : '이 메시지를 지울까요?')) return
    try {
      await deleteMeetupComment(c.id)
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : '지우지 못했어요.')
    }
  }

  const onPhoto = async (f: File | undefined) => {
    if (!f) return
    try {
      setPhoto(await uploadPinPhoto(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 올리지 못했어요.')
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  const canDelete = (c: MeetupComment) => c.author.id === me.id || isHost

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 공지: 맨 위 고정 (최신 1개, 눌러서 전부) */}
      {notices.length > 0 && (
        <div className="shrink-0 border-b border-(--c-border) bg-(--c-accent)/5 px-4 py-2.5">
          {(showAllNotices ? notices : notices.slice(0, 1)).map((n) => (
            <div key={n.id} className="flex items-start gap-2 py-1 text-sm">
              <span aria-hidden>📢</span>
              <p className="min-w-0 flex-1 whitespace-pre-line break-words">
                {n.body}
                <span className="ml-1.5 text-[0.6875rem] text-(--c-muted)">{dayOf(n.createdAt)}</span>
              </p>
              {canDelete(n) && (
                <button type="button" onClick={() => remove(n)} className="shrink-0 text-[0.6875rem] text-(--c-muted) hover:text-red-500">
                  내리기
                </button>
              )}
            </div>
          ))}
          {notices.length > 1 && (
            <button type="button" onClick={() => setShowAllNotices((v) => !v)} className="mt-0.5 text-xs font-semibold text-(--c-accent)">
              {showAllNotices ? '접기' : `공지 ${notices.length}개 모두 보기`}
            </button>
          )}
        </div>
      )}

      {/* 메시지 */}
      <div ref={scroller} className="tm-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {list === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-10 w-2/3 animate-pulse rounded-2xl bg-black/5 ${i % 2 ? 'ml-auto' : ''}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-(--c-muted)">
            <div>
              <div className="text-4xl" aria-hidden>👋</div>
              <p className="mt-3">순례방에 오신 걸 환영해요.</p>
              <p>첫 인사를 남겨 보세요!</p>
            </div>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {messages.map((c, i) => {
              const prev = messages[i - 1]
              const mine = c.author.id === me.id
              const newDay = !prev || dayOf(prev.createdAt) !== dayOf(c.createdAt)
              const sameAuthor = !newDay && prev?.author.id === c.author.id
              return (
                <li key={c.id}>
                  {newDay && (
                    <p className="my-3 text-center">
                      <span className="rounded-full bg-black/5 px-3 py-1 text-[0.6875rem] text-(--c-muted)">{dayOf(c.createdAt)}</span>
                    </p>
                  )}
                  <div className={`group flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${sameAuthor ? '' : 'mt-3'}`}>
                    {!mine && (
                      <span className="w-8 shrink-0">
                        {!sameAuthor && (
                          <Link href={`/u/${c.author.id}`}>
                            <Avatar id={c.author.id} nickname={c.author.nickname} src={c.author.avatarUrl} size={32} />
                          </Link>
                        )}
                      </span>
                    )}
                    <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {!mine && !sameAuthor && (
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold">
                          {c.author.nickname}
                          {c.author.id === meetup.hostId && <span className="rounded bg-black/5 px-1 text-[0.625rem] font-bold text-(--c-muted)">주최자</span>}
                        </p>
                      )}
                      <div
                        className={`rounded-2xl px-3 py-2 text-[0.9375rem] leading-relaxed ${
                          mine ? 'rounded-br-md bg-(--c-accent) text-(--c-accent-text)' : 'rounded-bl-md border border-(--c-border) bg-(--c-surface)'
                        }`}
                      >
                        {c.kind === 'review' && <p className="mb-0.5 text-[0.6875rem] font-bold opacity-80">⭐ 후기</p>}
                        {c.body && <p className="whitespace-pre-line break-words">{c.body}</p>}
                        {c.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- data URL/스토리지 URL
                          <img src={c.photoUrl} alt="" className={`max-h-64 rounded-xl object-cover ${c.body ? 'mt-2' : ''}`} />
                        )}
                      </div>
                    </div>
                    <div className={`flex shrink-0 flex-col pb-0.5 text-[0.625rem] text-(--c-muted) ${mine ? 'items-end' : 'items-start'}`}>
                      <span className="flex gap-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        {!mine && (
                          <ReportButton
                            subject={{ target: 'comment', targetId: c.id, targetLabel: `${c.author.nickname}: ${c.body.slice(0, 40)}`, targetUserId: c.author.id }}
                            className="hover:text-red-500 hover:underline"
                          />
                        )}
                        {canDelete(c) && (
                          <button type="button" onClick={() => remove(c)} className="hover:text-red-500" aria-label="메시지 지우기">
                            <TrashIcon size={12} />
                          </button>
                        )}
                      </span>
                      {timeOf(c.createdAt)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* 보내기 */}
      <div className="shrink-0 border-t border-(--c-border) bg-(--c-surface) px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
        {!ended && !asNotice && (
          <div className="tm-scroll mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK.map((q) => (
              <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="shrink-0 rounded-full border border-(--c-border) px-3 py-1 text-xs font-semibold hover:bg-black/[0.03]">
                {q}
              </button>
            ))}
          </div>
        )}
        {photo && (
          <div className="relative mb-2 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- 미리보기 */}
            <img src={photo} alt="" className="h-20 rounded-lg object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-gray-900 text-white" aria-label="사진 빼기">
              <CloseIcon size={12} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <button type="button" onClick={() => file.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="사진 보내기">
            <ImageIcon size={20} />
          </button>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          <textarea
            value={body}
            maxLength={MAX}
            rows={1}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // 엔터로 보내기, 쉬프트+엔터는 줄바꿈 (한글 조합 중엔 무시)
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={asNotice ? '모두에게 알릴 공지' : ended ? '오늘 순례는 어땠나요? 후기를 남겨요' : '메시지 보내기'}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-black/[0.04] px-3.5 py-2.5 text-[0.9375rem] outline-none field-sizing-content"
            aria-label="메시지"
          />
          <button
            type="button"
            disabled={busy || (!body.trim() && !photo)}
            onClick={() => send()}
            className="h-10 shrink-0 rounded-full bg-(--c-accent) px-4 text-sm font-bold text-(--c-accent-text) disabled:opacity-40"
          >
            {kind === 'notice' ? '공지' : '보내기'}
          </button>
        </div>
        {isHost && (
          <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5 pl-12 text-xs font-semibold text-(--c-muted)">
            <input type="checkbox" checked={asNotice} onChange={(e) => setAsNotice(e.target.checked)} className="accent-(--c-accent)" />
            📢 공지로 올리기 (맨 위에 고정돼요)
          </label>
        )}
        {error && (
          <p role="alert" className="mt-1.5 pl-12 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
