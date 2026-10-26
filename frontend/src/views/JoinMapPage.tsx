'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { getMapInvitePreview, joinMapByInvite } from '../db/api'
import type { MapInvitePreview } from '../types'

/** 함께 꾸미기 초대 링크 (/maps/{mapId}/join?code=…): 미리보기 → [참여하기] → 편집 화면 */
export function JoinMapPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const code = useSearchParams().get('code') ?? ''
  const router = useRouter()
  const user = useCurrentUser()
  const [preview, setPreview] = useState<MapInvitePreview | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  // 성공하면 다음 화면으로 넘어가며 busy 를 안 푼다. 뒤로 오면 Next 가 이 화면을 상태째 다시 보여 주므로, 떠날 때 푼다
  useLayoutEffect(() => () => setBusy(false), [])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getMapInvitePreview(mapId, code)
      .then((p) => !cancelled && setPreview(p))
      .catch(() => !cancelled && setPreview(null))
    return () => {
      cancelled = true
    }
  }, [mapId, code])

  const here = `/maps/${mapId}/join?code=${encodeURIComponent(code)}`
  const join = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(here)}`)
    setBusy(true)
    setError('')
    try {
      await joinMapByInvite(mapId, code)
      router.push(`/maps/${mapId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '참여하지 못했어요.')
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh pt-14">
      <AppRail active="maps" />
      <main className="mx-auto grid min-h-[calc(100dvh-56px)] max-w-md place-items-center px-5 py-10">
        {preview === undefined ? (
          <div className="h-72 w-full animate-pulse rounded-3xl bg-black/5" />
        ) : preview === null ? (
          <div className="text-center">
            <div className="text-5xl" aria-hidden>🔗</div>
            <h1 className="tm-headline mt-5 text-3xl">초대 링크가 바뀌었어요</h1>
            <p className="mt-2 text-sm text-(--c-muted)">지도 주인이 링크를 새로 만들었거나 지도가 없어졌어요. 새 링크를 받아 주세요.</p>
            <Link href="/" className="tm-btn mt-8 inline-block rounded-full bg-(--c-surface) px-6 py-3 text-sm font-bold">
              내 지도로
            </Link>
          </div>
        ) : (
          <div className="w-full rounded-3xl border-[1.5px] border-(--c-ink) bg-(--c-surface) p-7 text-center shadow-[8px_8px_0_var(--c-ink)]">
            <p className="tm-label dot">co-edit invitation</p>
            <div className="mt-6 flex justify-center">
              <Avatar id={preview.owner.id} nickname={preview.owner.nickname} src={preview.owner.avatarUrl} size={64} />
            </div>
            <p className="mt-4 text-sm text-(--c-muted)">
              <b className="font-bold text-(--c-text)">{preview.owner.nickname}</b>님이 지도를 함께 꾸미자고 초대했어요
            </p>
            <h1 className="tm-headline mt-3 text-4xl">{preview.title}</h1>
            <p className="tm-label mt-3">
              places {preview.pinCount} · editors {preview.editorCount + 1}
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={join} disabled={busy} className="tm-btn mt-7 h-12 w-full rounded-xl bg-(--c-accent) text-[15px] font-bold text-(--c-accent-text) disabled:opacity-60">
              {busy ? '참여하는 중…' : user ? '👥 같이 꾸미기' : '로그인하고 같이 꾸미기'}
            </button>
            <p className="mt-3 text-xs text-(--c-muted)">참여하면 핀 · 경로 · 꾸미기를 같이 고칠 수 있어요.</p>
          </div>
        )}
      </main>
    </div>
  )
}
