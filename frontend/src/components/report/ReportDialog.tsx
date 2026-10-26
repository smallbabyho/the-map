'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { submitReport } from '../../db/api'
import type { AbuseReason, BugReason, ReportInput, ReportReason, ReportTarget } from '../../types'
import { CloseIcon } from '../icons'

export const ABUSE_REASONS: { id: AbuseReason; label: string }[] = [
  { id: 'spam', label: '스팸 · 광고' },
  { id: 'abuse', label: '욕설 · 괴롭힘' },
  { id: 'inappropriate', label: '음란하거나 불쾌한 내용' },
  { id: 'scam', label: '사기 · 금전 요구' },
  { id: 'privacy', label: '개인정보 노출' },
  { id: 'other', label: '기타' },
]
export const BUG_REASONS: { id: BugReason; label: string }[] = [
  { id: 'broken', label: '기능이 안 돼요' },
  { id: 'map', label: '지도 · 길찾기가 이상해요' },
  { id: 'display', label: '화면이 깨져요' },
  { id: 'suggestion', label: '이런 기능이 있으면 좋겠어요' },
  { id: 'other', label: '기타' },
]
export const REASON_LABEL: Record<ReportReason, string> = Object.fromEntries([...ABUSE_REASONS, ...BUG_REASONS].map((r) => [r.id, r.label])) as Record<ReportReason, string>

const TITLE: Record<ReportTarget, string> = {
  user: '사용자 신고',
  meetup: '모임 신고',
  map: '지도 신고',
  comment: '댓글 신고',
  review: '리뷰 신고',
  bug: '문제 제보 · 제안',
}

export type ReportSubject = Pick<ReportInput, 'target' | 'targetId' | 'targetLabel' | 'targetUserId'>

/** 신고 · 문제 제보 창. 보낸 화면 주소는 자동으로 같이 간다 (문제 제보면 브라우저 정보도). */
export function ReportDialog({ subject, onClose }: { subject: ReportSubject; onClose: () => void }) {
  const isBug = subject.target === 'bug'
  const reasons = isBug ? BUG_REASONS : ABUSE_REASONS
  const [reason, setReason] = useState<ReportReason>(reasons[0].id)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await submitReport({ ...subject, reason, detail, pageUrl: window.location.href })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '보내지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  // 팝업은 항상 맨 위: 페이지 안 다른 요소(지도 등)의 겹침 순서에 갇히지 않게 body 에 바로 그린다
  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose} role="dialog" aria-modal aria-label={TITLE[subject.target]}>
      <div className="w-full max-w-md rounded-t-3xl bg-(--c-surface) p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-(--c-text) sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{TITLE[subject.target]}</h2>
            {subject.targetLabel && !isBug && <p className="mt-0.5 truncate text-sm text-(--c-muted)">{subject.targetLabel}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div className="text-4xl" aria-hidden>{isBug ? '🛠️' : '🛡️'}</div>
            <p className="mt-3 font-semibold">{isBug ? '알려 주셔서 고마워요!' : '신고가 접수됐어요'}</p>
            <p className="mt-1 text-sm text-(--c-muted)">{isBug ? '확인하고 고칠게요.' : '관리자가 확인한 뒤 조치할게요. 신고한 사실은 상대에게 알리지 않아요.'}</p>
            <button type="button" onClick={onClose} className="mt-6 h-11 w-full rounded-xl bg-(--c-text) text-sm font-bold text-(--c-surface)">
              닫기
            </button>
          </div>
        ) : (
          <>
            <fieldset className="mt-4 space-y-1.5">
              <legend className="mb-2 text-xs font-semibold text-(--c-muted)">{isBug ? '어떤 문제인가요?' : '신고 사유'}</legend>
              {reasons.map((r) => (
                <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium ${reason === r.id ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border)'}`}>
                  <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-(--c-accent)" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={isBug ? '무엇을 하다가 어떤 일이 생겼는지 적어 주세요 (필수)' : '자세한 내용 (선택)'}
              className="mt-3 w-full resize-none rounded-xl border border-(--c-border) bg-transparent px-3 py-2.5 text-sm outline-none focus:border-(--c-accent)"
            />
            {isBug && <p className="mt-1 text-xs text-(--c-muted)">지금 보고 있는 화면 주소와 브라우저 정보가 같이 전달돼요.</p>}
            {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
            <button
              type="button"
              onClick={send}
              disabled={busy || (isBug && !detail.trim())}
              className="mt-4 h-12 w-full rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text) disabled:opacity-50"
            >
              {busy ? '보내는 중…' : isBug ? '보내기' : '신고하기'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** 작은 '신고' 글자 버튼 + 창 */
export function ReportButton({ subject, label = '신고', className = '' }: { subject: ReportSubject; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || 'text-xs font-semibold text-(--c-muted) hover:text-red-500 hover:underline'}>
        {label}
      </button>
      {open && <ReportDialog subject={subject} onClose={() => setOpen(false)} />}
    </>
  )
}

/** 문제 제보 (어디서든) */
export const BUG_SUBJECT: ReportSubject = { target: 'bug', targetId: null, targetLabel: '', targetUserId: null }
