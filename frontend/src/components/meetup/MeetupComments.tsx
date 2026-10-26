'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { addMeetupComment, deleteMeetupComment, getMeetupComments, uploadPinPhoto } from '../../db/api'
import type { MeetupComment, MeetupCommentKind, MeetupSummary, User } from '../../types'
import { Avatar } from '../Avatar'
import { ReportButton } from '../report/ReportDialog'
import { CloseIcon, ImageIcon, TrashIcon } from '../icons'

const QUICK = ['조금 늦어요 🙏', '도착했어요 📍', '출구 앞이에요 🚇', '먼저 들어가 있을게요 ☕']
const MAX = 500

const timeOf = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours()
  return `${d.getMonth() + 1}/${d.getDate()} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 모임 댓글: 대화 · 공지(주최자, 맨 위 고정) · 후기(모임이 끝난 뒤, 사진 가능).
 * 읽기는 누구나, 쓰기는 참여자만.
 */
export function MeetupComments({ meetup, me, joined }: { meetup: MeetupSummary; me: User | null | undefined; joined: boolean }) {
  const [list, setList] = useState<MeetupComment[] | null>(null)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [asNotice, setAsNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 모임 시간이 지났으면 후기 모드 (처음 볼 때 한 번 정한다)
  const [ended] = useState(() => Date.parse(meetup.meetAt) <= Date.now())
  const file = useRef<HTMLInputElement>(null)
  const isHost = me?.id === meetup.hostId

  useEffect(() => {
    let cancelled = false
    getMeetupComments(meetup.id)
      .then((l) => !cancelled && setList(l))
      .catch(() => !cancelled && setList([]))
    return () => {
      cancelled = true
    }
  }, [meetup.id])

  const kind: MeetupCommentKind = isHost && asNotice ? 'notice' : ended ? 'review' : 'chat'

  const send = async (text = body) => {
    if (busy || (!text.trim() && !photo)) return
    setBusy(true)
    setError('')
    try {
      await addMeetupComment(meetup.id, { kind, body: text, photoUrl: photo })
      setList(await getMeetupComments(meetup.id))
      setBody('')
      setPhoto(null)
      setAsNotice(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글을 남기지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: MeetupComment) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    try {
      await deleteMeetupComment(c.id)
      setList((l) => l?.filter((x) => x.id !== c.id) ?? l)
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

  const reviews = list?.filter((c) => c.kind === 'review') ?? []
  const reviewPhotos = reviews.filter((c) => c.photoUrl)

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">
        {ended ? '후기 · 대화' : '대화'} {list && list.length > 0 && <span className="text-(--c-accent)">{list.length}</span>}
      </h2>
      <p className="mt-1 text-sm text-(--c-muted)">
        {ended ? '모임은 어땠나요? 사진과 함께 후기를 남겨 보세요.' : '“늦어요”, “출구 앞이에요” 같은 연락을 남겨요.'}
      </p>

      {/* 후기 사진 모아 보기 */}
      {reviewPhotos.length > 0 && (
        <div className="tm-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
          {reviewPhotos.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element -- data URL/스토리지 URL
            <img key={c.id} src={c.photoUrl!} alt={`${c.author.nickname}의 후기 사진`} className="h-28 w-28 shrink-0 rounded-xl object-cover" />
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {list === null ? (
          <li className="h-16 animate-pulse rounded-xl bg-black/5" />
        ) : list.length === 0 ? (
          <li className="rounded-xl border border-dashed border-(--c-border) px-4 py-6 text-center text-sm text-(--c-muted)">아직 댓글이 없어요.</li>
        ) : (
          list.map((c) => (
            <li
              key={c.id}
              className={`flex gap-3 rounded-xl px-3 py-2.5 ${c.kind === 'notice' ? 'border border-(--c-accent)/40 bg-(--c-accent)/5' : c.kind === 'review' ? 'border border-(--c-border) bg-(--c-surface)' : ''}`}
            >
              <Link href={`/u/${c.author.id}`} className="shrink-0">
                <Avatar id={c.author.id} nickname={c.author.nickname} src={c.author.avatarUrl} size={32} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-1.5 text-[13px]">
                  <b className="font-semibold">{c.author.nickname}</b>
                  {c.author.id === meetup.hostId && <span className="rounded bg-black/5 px-1 text-[10px] font-bold text-(--c-muted)">주최자</span>}
                  {c.kind === 'notice' && <span className="rounded bg-(--c-accent) px-1.5 text-[10px] font-bold text-(--c-accent-text)">📢 공지</span>}
                  {c.kind === 'review' && <span className="rounded bg-amber-400/20 px-1.5 text-[10px] font-bold text-amber-700">⭐ 후기</span>}
                  <span className="text-[11px] text-(--c-muted)">{timeOf(c.createdAt)}</span>
                  {me && me.id !== c.author.id && (
                    <ReportButton
                      subject={{ target: 'comment', targetId: c.id, targetLabel: `${c.author.nickname}: ${c.body.slice(0, 40)}`, targetUserId: c.author.id }}
                      className="text-[11px] text-(--c-muted) hover:text-red-500 hover:underline"
                    />
                  )}
                </p>
                {c.body && <p className="mt-0.5 whitespace-pre-line break-words text-[15px] leading-relaxed">{c.body}</p>}
                {c.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL/스토리지 URL
                  <img src={c.photoUrl} alt="" className="mt-2 max-h-72 rounded-xl object-cover" />
                )}
              </div>
              {(me?.id === c.author.id || isHost) && (
                <button type="button" onClick={() => remove(c)} className="grid size-8 shrink-0 place-items-center rounded-full text-(--c-muted) hover:bg-red-500/10 hover:text-red-500" aria-label="댓글 지우기">
                  <TrashIcon size={15} />
                </button>
              )}
            </li>
          ))
        )}
      </ul>

      {/* 쓰기 */}
      {!me ? (
        <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-(--c-muted)">
          <Link href={`/login?next=${encodeURIComponent(`/meetups/${meetup.id}`)}`} className="font-semibold text-(--c-accent)">로그인</Link>하고 모임에 참여하면 댓글을 쓸 수 있어요.
        </p>
      ) : !joined ? (
        <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-(--c-muted)">모임에 참여하면 댓글을 쓸 수 있어요.</p>
      ) : (
        <div className="mt-4 rounded-2xl border border-(--c-border) bg-(--c-surface) p-3">
          {!ended && !asNotice && (
            <div className="tm-scroll mb-2 flex gap-1.5 overflow-x-auto">
              {QUICK.map((q) => (
                <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="shrink-0 rounded-full border border-(--c-border) px-3 py-1 text-xs font-semibold hover:bg-black/[0.03]">
                  {q}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={body}
            maxLength={MAX}
            rows={2}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // 엔터로 보내기, 쉬프트+엔터는 줄바꿈 (한글 조합 중엔 무시)
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={asNotice ? '참여자 모두에게 알릴 공지를 써요' : ended ? '후기를 남겨 주세요' : '메시지를 입력하세요'}
            className="w-full resize-none bg-transparent text-[15px] outline-none"
          />
          {photo && (
            <div className="relative mt-2 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- 미리보기 */}
              <img src={photo} alt="" className="h-20 rounded-lg object-cover" />
              <button type="button" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-gray-900 text-white" aria-label="사진 빼기">
                <CloseIcon size={12} />
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => file.current?.click()} className="grid size-9 place-items-center rounded-full text-(--c-muted) hover:bg-black/5" aria-label="사진 붙이기">
              <ImageIcon size={18} />
            </button>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            {isHost && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-(--c-muted)">
                <input type="checkbox" checked={asNotice} onChange={(e) => setAsNotice(e.target.checked)} className="accent-(--c-accent)" />
                공지로 올리기
              </label>
            )}
            <span className="ml-auto text-[11px] text-(--c-muted)">{body.length}/{MAX}</span>
            <button
              type="button"
              disabled={busy || (!body.trim() && !photo)}
              onClick={() => send()}
              className="h-9 rounded-full bg-(--c-accent) px-4 text-sm font-bold text-(--c-accent-text) disabled:opacity-40"
            >
              {busy ? '보내는 중…' : kind === 'review' ? '후기 남기기' : kind === 'notice' ? '공지 올리기' : '보내기'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      )}
    </section>
  )
}
