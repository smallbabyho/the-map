'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlaceSearchResult } from '../map'
import { CloseIcon } from '../icons'
import { findPlacesFromLink, linkImportHasAi, type FoundPlace } from './linkImport'

type SiteRow = { ok: 'yes' | 'some' | 'no'; label: string; note?: string }
/** AI 가 있을 때: 본문에서도 장소를 찾는다 */
const SITES_AI: SiteRow[] = [
  { ok: 'yes', label: '네이버 블로그 · 티스토리 · 브런치' },
  { ok: 'yes', label: '뉴스 기사 · 일반 웹페이지' },
  { ok: 'some', label: '유튜브', note: '설명란에 장소가 적혀 있을 때만' },
  { ok: 'no', label: '인스타그램 · 스레드 · 페이스북 · X', note: '로그인이 필요해서 링크로는 못 읽어요. 글을 복사해 붙여 넣어 주세요' },
]
/** AI 가 없을 때: 글에 첨부된 장소(지도 카드)만 */
const SITES_CARD: SiteRow[] = [
  { ok: 'yes', label: '네이버 블로그', note: "글에 '장소' 를 첨부한 경우 (지도 그림 + 가게 이름 · 주소가 보이는 칸)" },
  { ok: 'no', label: '장소를 첨부하지 않은 블로그 글', note: '본문에 글로만 적힌 장소는 아직 못 찾아요' },
  { ok: 'no', label: '티스토리 · 유튜브 · 인스타그램 · 스레드 등', note: '곧 지원할 예정이에요' },
]

interface Props {
  onAdd: (items: { place: PlaceSearchResult; memo: string }[]) => void
  onClose: () => void
}

/** 🔗 링크로 한 번에 채우기: 링크(또는 글) → AI 가 장소를 뽑고 → 확인해서 고른 곳만 핀으로 */
export function LinkImportDialog({ onAdd, onClose }: Props) {
  const [mode, setMode] = useState<'link' | 'text'>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<(FoundPlace & { checked: boolean })[] | null>(null)
  const [title, setTitle] = useState('')
  /** AI 를 쓸 수 있으면 '글 붙여 넣기' 와 더 많은 사이트 */
  const [ai, setAi] = useState(false)
  useEffect(() => {
    let cancelled = false
    linkImportHasAi().then((v) => !cancelled && setAi(v))
    return () => {
      cancelled = true
    }
  }, [])
  const sites = ai ? SITES_AI : SITES_CARD

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const run = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await findPlacesFromLink(mode === 'link' ? { url: url.trim() } : { text: text.trim() })
      if (res.places.length === 0) throw new Error('이 글에서는 찾아갈 수 있는 장소를 찾지 못했어요.')
      setTitle(res.title)
      setFound(res.places.map((p) => ({ ...p, checked: !!p.match })))
    } catch (e) {
      setError(e instanceof Error ? e.message : '장소를 찾지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const picked = found?.filter((p) => p.checked && p.match) ?? []
  const add = () => {
    onAdd(picked.map((p) => ({ place: p.match!, memo: p.memo })))
    onClose()
  }

  const canRun = mode === 'link' ? /^https?:\/\/\S+/.test(url.trim()) : text.trim().length >= 20

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal aria-label="링크로 한 번에 채우기">
      <div className="tm-scroll flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-3xl bg-(--c-surface) p-5 text-(--c-text) shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🔗 링크로 한 번에 채우기</h2>
          <button type="button" onClick={onClose} disabled={busy} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40" aria-label="닫기">
            <CloseIcon size={18} />
          </button>
        </div>

        {found === null ? (
          <>
            <p className="mt-1 text-sm text-(--c-muted)">{ai ? '글에 나온 장소를 AI 가 찾아서, 고른 곳만 순서대로 핀을 꽂아요.' : '블로그 글에 첨부된 장소를 읽어서, 고른 곳만 순서대로 핀을 꽂아요.'}</p>

            <div className={`mt-4 grid-cols-2 rounded-xl bg-black/[0.05] p-1 text-sm font-semibold ${ai ? 'grid' : 'hidden'}`} role="tablist">
              {(
                [
                  ['link', '링크 넣기'],
                  ['text', '글 붙여 넣기'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`h-9 rounded-lg transition ${mode === id ? 'bg-(--c-surface) shadow-sm' : 'text-(--c-muted)'}`}>
                  {label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (canRun) run()
              }}
              className="mt-3"
            >
              {mode === 'link' ? (
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://blog.naver.com/…"
                  inputMode="url"
                  autoFocus
                  className="h-12 w-full rounded-xl border border-(--c-border) bg-(--c-surface) px-4 text-[0.9375rem] outline-none focus:border-(--c-accent)"
                  aria-label="링크 주소"
                />
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="인스타 · 스레드 글처럼 링크로 못 읽는 글은 내용을 복사해 붙여 넣어 주세요."
                  rows={6}
                  autoFocus
                  className="w-full resize-none rounded-xl border border-(--c-border) bg-(--c-surface) px-4 py-3 text-[0.9375rem] outline-none focus:border-(--c-accent)"
                  aria-label="글 내용"
                />
              )}
              <button type="submit" disabled={!canRun || busy} className="tm-btn mt-2 h-12 w-full rounded-xl bg-(--c-accent) text-[0.9375rem] font-bold text-(--c-accent-text) disabled:opacity-50">
                {busy ? `장소 찾는 중…${ai ? ' (10초쯤 걸려요)' : ''}` : '장소 찾기'}
              </button>
            </form>

            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-4 rounded-2xl bg-black/[0.03] p-3.5">
              <p className="text-xs font-bold text-(--c-muted)">읽을 수 있는 곳</p>
              <ul className="mt-2 space-y-1.5 text-[0.8125rem]">
                {sites.map((s) => (
                  <li key={s.label} className="flex gap-2">
                    <span className="shrink-0" aria-label={s.ok === 'yes' ? '됨' : s.ok === 'some' ? '일부' : '안 됨'}>
                      {s.ok === 'yes' ? '✅' : s.ok === 'some' ? '🔺' : '❌'}
                    </span>
                    <span>
                      <span className="font-semibold">{s.label}</span>
                      {s.note && <span className="block text-xs text-(--c-muted)">{s.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 truncate text-sm text-(--c-muted)">{title ? `‘${title}’ 에서 ` : ''}장소 {found.length}곳을 찾았어요. 추가할 곳을 골라 주세요.</p>
            <ul className="mt-3 space-y-1.5">
              {found.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  <label className={`flex items-start gap-3 rounded-xl border border-(--c-border) px-3 py-2.5 ${p.match ? 'cursor-pointer hover:bg-black/[0.02]' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={p.checked}
                      disabled={!p.match}
                      onChange={() => setFound((list) => list!.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                      className="mt-1 size-4 shrink-0 accent-(--c-accent)"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {i + 1}. {p.match?.name ?? p.name}
                      </span>
                      <span className="block truncate text-xs text-(--c-muted)">{p.match ? p.match.address || p.match.category : `‘${p.name}’ 을(를) 지도에서 찾지 못했어요`}</span>
                      {p.memo && <span className="mt-0.5 block truncate text-xs">📝 {p.memo}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={() => setFound(null)} className="h-12 rounded-xl border border-(--c-border) px-4 text-sm font-semibold">
                다시 넣기
              </button>
              <button type="button" onClick={add} disabled={!picked.length} className="tm-btn h-12 rounded-xl bg-(--c-accent) text-[0.9375rem] font-bold text-(--c-accent-text) disabled:opacity-50">
                {picked.length}곳 핀으로 추가
              </button>
            </div>
            <p className="mt-2 text-center text-[0.6875rem] text-(--c-muted)">자동으로 찾은 결과라 틀릴 수 있어요. 추가한 뒤 핀을 눌러 고칠 수 있어요.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
