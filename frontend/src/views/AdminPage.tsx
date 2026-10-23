'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { SearchIcon } from '../components/icons'
import { adminDeleteUser, adminGetStats, adminListUsers, adminUpdateUser } from '../db/api'
import type { AdminStats, AdminUser } from '../types'

type Filter = 'all' | 'admin' | 'suspended'

/** 관리자 모드: 서비스 현황 + 회원 관리 */
export function AdminPage() {
  const me = useCurrentUser()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const isAdmin = me?.role === 'admin'

  const reload = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([adminGetStats(), adminListUsers()])
      setStats(s)
      setUsers(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요.')
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    Promise.all([adminGetStats(), adminListUsers()])
      .then(([s, u]) => {
        if (cancelled) return
        setStats(s)
        setUsers(u)
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '불러오지 못했어요.'))
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  const act = async (user: AdminUser, fn: () => Promise<unknown>, done: string) => {
    setBusyId(user.id)
    setError('')
    try {
      await fn()
      await reload()
      setNotice(done)
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.')
    } finally {
      setBusyId(null)
    }
  }

  if (me === undefined) return <div className="h-dvh" />
  if (!isAdmin) {
    return (
      <div className="relative min-h-dvh md:pl-[72px]">
        <AppRail active="admin" />
        <div className="grid min-h-dvh place-items-center px-6 text-center">
          <div>
            <div className="text-5xl" aria-hidden>🔒</div>
            <h1 className="mt-4 text-lg font-bold">관리자만 볼 수 있어요</h1>
            <p className="mt-1 text-sm text-(--c-muted)">관리자 계정으로 로그인해 주세요. (체험: admin@example.com / test1234)</p>
            <Link href="/login?next=/admin" className="mt-6 inline-block rounded-full bg-(--c-text) px-5 py-2.5 text-sm font-semibold text-(--c-surface)">
              {me ? '다른 계정으로 로그인' : '로그인'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const shown = (users ?? [])
    .filter((u) => (filter === 'admin' ? u.role === 'admin' : filter === 'suspended' ? u.suspended : true))
    .filter((u) => !q || u.nickname.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))

  return (
    <div className="relative min-h-dvh pb-16 md:pb-0 md:pl-[72px]">
      <AppRail active="admin" />
      <MobileTabBar active="admin" />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-(--c-muted)">관리자 모드</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">회원 관리</h1>
          </div>
          <Link href="/dev/api" className="rounded-full border border-(--c-border) bg-(--c-surface) px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]">
            API 테스트 →
          </Link>
        </div>

        {/* 현황 */}
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            { label: '전체 회원', value: stats?.users },
            { label: '정지 회원', value: stats?.suspended, warn: true },
            { label: '전체 지도', value: stats?.maps },
            { label: '공개 지도', value: stats?.publicMaps },
            { label: '모집 중 모임', value: stats?.meetupsOpen },
            { label: '이번 달 지도 사용', value: stats?.usesThisMonth },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-(--c-border) bg-(--c-surface) px-4 py-3">
              <p className="text-xs font-medium text-(--c-muted)">{s.label}</p>
              <p className={`mt-1 text-2xl font-extrabold tracking-tight ${s.warn && s.value ? 'text-red-500' : ''}`}>{s.value ?? '–'}</p>
            </div>
          ))}
        </section>

        {/* 검색 · 필터 */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--c-border) bg-(--c-surface) px-3 focus-within:border-(--c-accent) sm:max-w-xs">
            <SearchIcon size={16} className="text-(--c-muted)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="닉네임·이메일 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="회원 검색" />
          </label>
          <div className="flex gap-1 rounded-full bg-black/[0.04] p-1" role="tablist">
            {(
              [
                ['all', '전체'],
                ['admin', '관리자'],
                ['suspended', '정지'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`h-8 rounded-full px-3.5 text-sm font-semibold ${filter === id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="tm-float fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-(--c-text) px-4 py-2 text-sm font-medium text-(--c-surface) md:bottom-8">{notice}</p>}

        {/* 회원 목록 */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface)">
          <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_0.7fr_1.6fr] gap-3 border-b border-(--c-border) bg-black/[0.02] px-4 py-2.5 text-xs font-semibold text-(--c-muted) md:grid">
            <span>회원</span>
            <span>가입일</span>
            <span>지도</span>
            <span>연 모임</span>
            <span className="text-right">관리</span>
          </div>
          {users === null ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-(--c-muted)">조건에 맞는 회원이 없어요.</p>
          ) : (
            <ul className="divide-y divide-(--c-border)">
              {shown.map((u) => {
                const self = u.id === me?.id
                const busy = busyId === u.id
                return (
                  <li key={u.id} className={`grid gap-3 px-4 py-3 md:grid-cols-[1.6fr_1fr_0.7fr_0.7fr_1.6fr] md:items-center ${u.suspended ? 'bg-red-500/[0.04]' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar id={u.id} nickname={u.nickname} size={36} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                          <span className="truncate">{u.nickname}</span>
                          {self && <span className="text-xs text-(--c-muted)">(나)</span>}
                          {u.role === 'admin' && <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-bold text-indigo-600">관리자</span>}
                          {u.suspended && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600">정지</span>}
                        </p>
                        <p className="truncate text-xs text-(--c-muted)">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-(--c-muted) md:text-sm">
                      <span className="md:hidden">가입 </span>
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                      <span className="md:hidden"> · 지도 {u.mapCount} · 연 모임 {u.meetupCount}</span>
                    </span>
                    <span className="hidden text-sm md:block">{u.mapCount}</span>
                    <span className="hidden text-sm md:block">{u.meetupCount}</span>
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      <SmallBtn
                        disabled={busy}
                        onClick={() => {
                          const name = window.prompt('새 닉네임', u.nickname)
                          if (name && name.trim() !== u.nickname) act(u, () => adminUpdateUser(u.id, { nickname: name }), '닉네임을 바꿨어요')
                        }}
                      >
                        닉네임
                      </SmallBtn>
                      <SmallBtn
                        disabled={busy || self}
                        onClick={() =>
                          window.confirm(u.role === 'admin' ? `${u.nickname}님의 관리자 권한을 뺄까요?` : `${u.nickname}님을 관리자로 지정할까요?`) &&
                          act(u, () => adminUpdateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }), '권한을 바꿨어요')
                        }
                      >
                        {u.role === 'admin' ? '관리자 해제' : '관리자 지정'}
                      </SmallBtn>
                      <SmallBtn
                        tone={u.suspended ? 'default' : 'warn'}
                        disabled={busy || self}
                        onClick={() =>
                          window.confirm(u.suspended ? `${u.nickname}님의 정지를 풀까요?` : `${u.nickname}님을 정지할까요? 로그인할 수 없게 돼요.`) &&
                          act(u, () => adminUpdateUser(u.id, { suspended: !u.suspended }), u.suspended ? '정지를 풀었어요' : '정지했어요')
                        }
                      >
                        {u.suspended ? '정지 해제' : '정지'}
                      </SmallBtn>
                      <SmallBtn
                        tone="danger"
                        disabled={busy || self}
                        onClick={() =>
                          window.confirm(`${u.nickname}님을 탈퇴 처리할까요?\n지도 ${u.mapCount}개와 연 모임 ${u.meetupCount}개가 함께 삭제되고 되돌릴 수 없어요.`) &&
                          act(u, () => adminDeleteUser(u.id), '탈퇴 처리했어요')
                        }
                      >
                        탈퇴
                      </SmallBtn>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function SmallBtn({ children, onClick, disabled, tone = 'default' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'default' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-600 hover:bg-red-500/10' : tone === 'warn' ? 'text-orange-600 hover:bg-orange-500/10' : 'hover:bg-black/[0.04]'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`h-8 rounded-lg border border-(--c-border) px-2.5 text-xs font-semibold transition disabled:opacity-35 ${color}`}>
      {children}
    </button>
  )
}
