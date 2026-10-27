'use client'

import { useState } from 'react'
import type { BadgeStats } from '../../types'
import { computeBadges, type Badge } from '../badges'

export const earnedBadgeCount = (stats: BadgeStats) => computeBadges(stats).filter((b) => b.level > 0).length

/** 🏆 업적 탭: 받은 업적(Lv · 다음 단계까지) + 도전 중인 업적. 공개 지도로 자동 계산 */
export function Achievements({ stats, isMe }: { stats: BadgeStats | null; isMe: boolean }) {
  const [more, setMore] = useState(false)
  if (!stats) return <div className="mt-6 h-64 animate-pulse rounded-3xl bg-black/5" />

  const badges = computeBadges(stats)
  const earned = badges.filter((b) => b.level > 0)
  const locked = badges.filter((b) => b.level === 0)
  const basic = locked.filter((b) => !b.hiddenUntilEarned)
  const extra = locked.filter((b) => b.hiddenUntilEarned)
  const levels = earned.reduce((n, b) => n + b.level, 0)

  return (
    <div className="mt-6">
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['🏆', '받은 업적', `${earned.length}/${badges.length}`],
            ['⭐', '총 레벨', levels],
            ['👣', '누빈 장소', stats.places],
          ] as const
        ).map(([e, label, v]) => (
          <div key={label} className="tm-card rounded-2xl px-2 py-4">
            <p className="text-2xl font-extrabold tracking-tight">{v}</p>
            <p className="mt-0.5 text-xs text-(--c-muted)">
              {e} {label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-(--c-muted)">공개한 지도와 성지순례 기록으로 자동으로 계산돼요.{isMe && ' 비공개 지도는 세지 않아요.'}</p>

      {earned.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold">받은 업적</h2>
          <BadgeGrid badges={earned} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-base font-bold">{earned.length ? '도전 중' : '첫 업적에 도전해 보세요'}</h2>
        <BadgeGrid badges={more ? [...basic, ...extra] : basic} />
        {extra.length > 0 && (
          <button type="button" onClick={() => setMore((v) => !v)} className="mt-3 text-sm font-semibold text-(--c-muted) hover:text-(--c-text)">
            {more ? '접기' : `카테고리 · 지역 업적 ${extra.length}개 더 보기`}
          </button>
        )}
      </section>
    </div>
  )
}

function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((b) => {
        const got = b.level > 0
        const prev = b.tiers[b.level - 1] ?? 0
        const pct = b.next == null ? 100 : Math.round(((b.value - prev) / (b.next - prev)) * 100)
        return (
          <li key={b.id} className={`tm-card flex items-center gap-3 rounded-2xl px-4 py-3 ${got ? '' : 'opacity-60'}`}>
            <span className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl ${got ? 'bg-(--c-lime) shadow-sm' : 'bg-black/5 grayscale'}`} aria-hidden>
              {b.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="truncate text-[0.9375rem] font-bold">{b.name}</span>
                {got && (
                  <span className="shrink-0 font-mono text-[0.6875rem] font-bold text-(--c-accent)">
                    Lv.{b.level}
                    <span className="text-(--c-muted)">/{b.tiers.length}</span>
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-xs text-(--c-muted)">{b.next == null ? '최고 단계 달성 🎉' : `${got ? '다음: ' : ''}${b.hint} · ${b.value}/${b.next}`}</span>
              {b.next != null && (
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden>
                  <span className="block h-full rounded-full bg-(--c-accent)" style={{ width: `${Math.max(3, pct)}%` }} />
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
