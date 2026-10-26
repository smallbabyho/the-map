'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { adminListReports, adminResolveReport, adminUpdateUser } from '../../db/api'
import type { Report, ReportStatus, ReportTarget } from '../../types'
import { Avatar } from '../Avatar'
import { REASON_LABEL } from './ReportDialog'

type Filter = 'open' | 'abuse' | 'bug' | 'all'

const TARGET_LABEL: Record<ReportTarget, string> = { user: '사용자', meetup: '모임', map: '지도', comment: '댓글', bug: '문제 제보', review: '리뷰' }
const TARGET_TONE: Record<ReportTarget, string> = {
  user: 'bg-rose-500/10 text-rose-600',
  meetup: 'bg-amber-500/10 text-amber-700',
  map: 'bg-sky-500/10 text-sky-700',
  comment: 'bg-violet-500/10 text-violet-600',
  bug: 'bg-emerald-500/10 text-emerald-700',
  review: 'bg-orange-500/10 text-orange-600',
}
const STATUS_LABEL: Record<ReportStatus, string> = { open: '처리 전', resolved: '처리 완료', dismissed: '문제없음' }
/** 콘텐츠 내리기 버튼 이름 */
const REMOVE_LABEL: Partial<Record<ReportTarget, string>> = { comment: '댓글 삭제', meetup: '모임 취소', map: '지도 비공개', review: '리뷰 삭제' }

function targetHref(r: Report) {
  if (!r.targetId) return null
  if (r.target === 'user') return `/u/${r.targetId}`
  if (r.target === 'meetup') return `/meetups/${r.targetId}`
  if (r.target === 'map') return `/maps/${r.targetId}`
  // 리뷰는 신고한 장소 페이지로
  if (r.target === 'review') return r.pageUrl || null
  return null
}

/** 관리자: 신고 · 문제 제보 처리 */
export function AdminReports({ onChange }: { onChange?: () => void }) {
  const [list, setList] = useState<Report[] | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const reload = useCallback(() => adminListReports().then(setList), [])

  useEffect(() => {
    let cancelled = false
    adminListReports()
      .then((l) => !cancelled && setList(l))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '불러오지 못했어요.'))
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (r: Report, fn: () => Promise<unknown>) => {
    setBusyId(r.id)
    setError('')
    try {
      await fn()
      await reload()
      onChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.')
    } finally {
      setBusyId(null)
    }
  }
  const resolve = (r: Report, status: ReportStatus, removeContent = false) => run(r, () => adminResolveReport(r.id, status, notes[r.id] ?? r.adminNote, { removeContent }))

  const all = list ?? []
  const shown = all.filter((r) => (filter === 'open' ? r.status === 'open' : filter === 'bug' ? r.target === 'bug' : filter === 'abuse' ? r.target !== 'bug' : true))
  const count = (f: Filter) => all.filter((r) => (f === 'open' ? r.status === 'open' : f === 'bug' ? r.target === 'bug' && r.status === 'open' : f === 'abuse' ? r.target !== 'bug' && r.status === 'open' : true)).length

  return (
    <div>
      <div className="mt-6 flex w-fit gap-1 rounded-full bg-black/[0.04] p-1" role="tablist">
        {(
          [
            ['open', '처리 전'],
            ['abuse', '신고'],
            ['bug', '문제 제보'],
            ['all', '전체'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`h-8 rounded-full px-3.5 text-sm font-semibold ${filter === id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}>
            {label}
            {id !== 'all' && count(id) > 0 && <span className="ml-1 text-red-500">{count(id)}</span>}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      {list === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-(--c-border) px-4 py-12 text-center text-sm text-(--c-muted)">{filter === 'open' ? '처리할 신고가 없어요 🎉' : '신고가 없어요.'}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => {
            const busy = busyId === r.id
            const href = targetHref(r)
            return (
              <li key={r.id} className={`rounded-2xl border bg-(--c-surface) p-4 ${r.status === 'open' ? 'border-(--c-border)' : 'border-(--c-border) opacity-70'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${TARGET_TONE[r.target]}`}>{TARGET_LABEL[r.target]}</span>
                  <span className="font-semibold">{REASON_LABEL[r.reason]}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${r.status === 'open' ? 'bg-red-500/10 text-red-600' : 'bg-black/5 text-(--c-muted)'}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="ml-auto text-(--c-muted)">{new Date(r.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {r.targetLabel && (
                  <p className="mt-2 text-[15px] font-semibold">
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {r.targetLabel} ↗
                      </Link>
                    ) : (
                      r.targetLabel
                    )}
                  </p>
                )}
                {r.detail && <p className="mt-1.5 whitespace-pre-line rounded-xl bg-black/[0.03] px-3 py-2 text-sm">{r.detail}</p>}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--c-muted)">
                  <span className="flex items-center gap-1.5">
                    보낸 사람:
                    {r.reporter ? (
                      <>
                        <Avatar id={r.reporter.id} nickname={r.reporter.nickname} src={r.reporter.avatarUrl} size={16} />
                        {r.reporter.nickname}
                      </>
                    ) : (
                      '로그인 안 함'
                    )}
                  </span>
                  {r.pageUrl && (
                    <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="max-w-xs truncate hover:underline">
                      화면: {r.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                    </a>
                  )}
                </div>
                {r.userAgent && (
                  <details className="mt-1 text-xs text-(--c-muted)">
                    <summary className="cursor-pointer">브라우저 정보</summary>
                    <p className="mt-1 break-all">{r.userAgent}</p>
                  </details>
                )}

                <input
                  value={notes[r.id] ?? r.adminNote}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="처리 메모 (관리자만 봐요)"
                  maxLength={500}
                  className="mt-3 h-9 w-full rounded-lg border border-(--c-border) bg-transparent px-3 text-sm outline-none focus:border-(--c-accent)"
                />

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.status === 'open' ? (
                    <>
                      {REMOVE_LABEL[r.target] && (
                        <Btn tone="danger" disabled={busy} onClick={() => window.confirm(`${REMOVE_LABEL[r.target]}하고 처리 완료할까요?`) && resolve(r, 'resolved', true)}>
                          {REMOVE_LABEL[r.target]}
                        </Btn>
                      )}
                      {r.targetUserId && r.target !== 'bug' && (
                        <Btn
                          tone="warn"
                          disabled={busy}
                          onClick={() =>
                            window.confirm('작성자 계정을 정지하고 처리 완료할까요? 로그인할 수 없게 돼요.') &&
                            run(r, async () => {
                              await adminUpdateUser(r.targetUserId!, { suspended: true })
                              await adminResolveReport(r.id, 'resolved', notes[r.id] || '계정 정지')
                            })
                          }
                        >
                          {r.target === 'user' ? '계정 정지' : '작성자 정지'}
                        </Btn>
                      )}
                      <Btn disabled={busy} onClick={() => resolve(r, 'resolved')}>
                        {r.target === 'bug' ? '확인 · 고침' : '처리 완료'}
                      </Btn>
                      <Btn disabled={busy} onClick={() => resolve(r, 'dismissed')}>
                        문제없음
                      </Btn>
                    </>
                  ) : (
                    <Btn disabled={busy} onClick={() => resolve(r, 'open')}>
                      다시 열기
                    </Btn>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Btn({ children, onClick, disabled, tone = 'default' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'default' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-600 hover:bg-red-500/10' : tone === 'warn' ? 'text-orange-600 hover:bg-orange-500/10' : 'hover:bg-black/[0.04]'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`h-8 rounded-lg border border-(--c-border) px-2.5 text-xs font-semibold transition disabled:opacity-35 ${color}`}>
      {children}
    </button>
  )
}
