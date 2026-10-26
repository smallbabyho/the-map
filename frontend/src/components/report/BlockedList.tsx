'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getBlockedUsers, setBlocked } from '../../db/api'
import type { User } from '../../types'
import { Avatar } from '../Avatar'
import { BUG_SUBJECT, ReportDialog } from './ReportDialog'

/** 내 계정 화면: 차단한 사람 목록(풀기) + 문제 제보 */
export function SafetySection() {
  const [list, setList] = useState<User[] | null>(null)
  const [bug, setBug] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBlockedUsers().then((l) => !cancelled && setList(l))
    return () => {
      cancelled = true
    }
  }, [])

  const unblock = async (u: User) => {
    await setBlocked(u.id, false)
    setList((l) => l?.filter((x) => x.id !== u.id) ?? l)
  }

  return (
    <section className="mt-4 rounded-2xl border border-(--c-border) bg-(--c-surface) p-1.5">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold text-(--c-muted)">차단한 사람</p>
      {list === null ? (
        <div className="mx-3 my-2 h-8 animate-pulse rounded-lg bg-black/5" />
      ) : list.length === 0 ? (
        <p className="px-3 pb-2 text-sm text-(--c-muted)">없어요</p>
      ) : (
        <ul>
          {list.map((u) => (
            <li key={u.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2">
              <Link href={`/u/${u.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar id={u.id} nickname={u.nickname} src={u.avatarUrl} size={28} />
                <span className="truncate text-sm font-semibold">{u.nickname}</span>
              </Link>
              <button type="button" onClick={() => unblock(u)} className="shrink-0 rounded-full border border-(--c-border) px-3 py-1 text-xs font-semibold hover:bg-black/[0.03]">
                차단 풀기
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setBug(true)} className="mt-1 w-full rounded-lg border-t border-(--c-border) px-3 py-2.5 text-left text-sm font-semibold hover:bg-black/[0.03]">
        🛠️ 문제 제보 · 기능 제안
      </button>
      {bug && <ReportDialog subject={BUG_SUBJECT} onClose={() => setBug(false)} />}
    </section>
  )
}
