'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ImageIcon, MinusIcon, PlusIcon, TrashIcon } from '../components/icons'
import { MapThumb } from '../components/MapThumb'
import {
  BIO_MAX,
  FONTS,
  MOOD_MAX,
  PAPER_COLORS,
  PAPERS,
  PINNED_MAX,
  PROFILE_FONTS_HREF,
  STICKER_MAX,
  STICKER_SET,
  TAPE_COLORS,
  fontFamily,
  fontScale,
  isDarkPaper,
  paperDefaultColor,
  paperStyle,
  seeded,
} from '../components/profile/deco'
import { ReportButton } from '../components/report/ReportDialog'
import { getBlockedUsers, getProfile, saveProfileDeco, setBlocked, updateMyProfile, uploadAvatar, uploadPinPhoto } from '../db/api'
import type { MapCardStyle, ProfileDecoInput, ProfilePage as ProfileData, ProfileSections, PublicMapSummary, Sticker, User } from '../types'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`)

const toInput = (d: ProfileData['deco']): ProfileDecoInput => ({
  paper: d.paper,
  color: d.color,
  font: d.font,
  bio: d.bio,
  mood: d.mood,
  stickers: d.stickers,
  pinnedMapIds: d.pinnedMapIds,
  mapStyle: d.mapStyle,
  sections: d.sections,
  bannerUrl: d.bannerUrl,
})

/** 새 스티커: 판 위쪽 가운데 근처에 살짝 기울여서 */
function newSticker(emoji: string): Sticker {
  return { id: newId(), emoji, x: 30 + Math.random() * 40, y: 12 + Math.random() * 30, size: 48, rotate: Math.round(Math.random() * 30 - 15) }
}

/** 공개 프로필 (/u/[userId]). 내 프로필이면 '꾸미기'로 다이어리처럼 꾸민다. */
export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const me = useCurrentUser()
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState('')
  /** 꾸미는 중이면 고치는 중인 값, 아니면 null */
  const [draft, setDraft] = useState<ProfileDecoInput | null>(null)
  const [nickname, setNickname] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'maps' | 'diary'>('maps')

  const isMe = !!me && me.id === userId
  const [blocked, setBlockedState] = useState(false)

  useEffect(() => {
    if (!me || me.id === userId) return
    let cancelled = false
    getBlockedUsers().then((l) => !cancelled && setBlockedState(l.some((u) => u.id === userId)))
    return () => {
      cancelled = true
    }
  }, [me, userId])

  const toggleBlock = async () => {
    if (!blocked && !window.confirm('차단하면 이 사람의 댓글이 안 보여요. 차단할까요?')) return
    try {
      await setBlocked(userId, !blocked)
      setBlockedState(!blocked)
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.')
    }
  }

  useEffect(() => {
    let cancelled = false
    getProfile(userId)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '프로필을 불러오지 못했어요.'))
    return () => {
      cancelled = true
    }
  }, [userId])

  const startEdit = () => {
    if (!data) return
    setDraft(toInput(data.deco))
    setNickname((isMe && me ? me : data.user).nickname)
    setError('')
  }

  const save = async () => {
    if (!draft || !data) return
    setSaving(true)
    setError('')
    try {
      if (me && nickname.trim() !== me.nickname) await updateMyProfile({ nickname })
      await saveProfileDeco(draft)
      setData(await getProfile(userId))
      setDraft(null)
      setSelected(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  const deco = draft ?? data?.deco
  // 내 프로필이면 로그인 정보(사진 · 닉네임을 바꾸면 바로 갱신)를 쓴다
  const person = isMe && me ? me : data?.user
  const user = person ? { ...person, nickname: draft ? nickname || person.nickname : person.nickname } : null

  const pinnedFirst = data ? [...data.maps].sort((a, b) => Number(data.deco.pinnedMapIds.includes(b.map.id)) - Number(data.deco.pinnedMapIds.includes(a.map.id))) : []
  const placeCount = data?.maps.reduce((sum, m) => sum + m.pinCount, 0) ?? 0
  const showTab = draft ? 'diary' : tab

  return (
    <div className="relative min-h-dvh pb-16 pt-14 md:pb-0">
      {/* 손글씨 글꼴 (프로필 화면에서만) */}
      <link rel="stylesheet" href={PROFILE_FONTS_HREF} precedence="default" />
      <AppRail active={isMe ? 'profile' : 'maps'} />
      <MobileTabBar active={isMe ? 'profile' : 'maps'} />

      {!data || !deco || !user ? (
        <div className="mx-auto max-w-5xl md:px-10 md:pt-6">
          <div className="h-48 animate-pulse bg-black/5 md:h-60 md:rounded-3xl" />
        </div>
      ) : (
        <>
          {/* 배너 */}
          <div className="mx-auto max-w-5xl md:px-10 md:pt-6">
            <ProfileBanner deco={deco} editing={!!draft} onBanner={(bannerUrl) => setDraft((d) => (d ? { ...d, bannerUrl } : d))} onError={setError} />
          </div>

          <main className={`mx-auto px-4 pb-16 md:px-10 ${draft ? 'max-w-6xl' : 'max-w-5xl'}`}>
            {/* 프로필 사진 (배너에 걸쳐서) + 버튼 */}
            <div className="flex items-end justify-between gap-3">
              <div className="relative z-10 -mt-14 rounded-full bg-(--c-bg) p-1.5 md:-mt-[72px] md:ml-6">
                <span className="block md:hidden">
                  <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={100} />
                </span>
                <span className="hidden md:block">
                  <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={136} />
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-3">
                {isMe ? (
                  draft ? (
                    <>
                      <button type="button" onClick={() => (setDraft(null), setSelected(null))} className="tm-btn h-10 rounded-full bg-(--c-surface) px-4 text-sm font-bold">
                        취소
                      </button>
                      <button type="button" onClick={save} disabled={saving} className="tm-btn h-10 rounded-full bg-(--c-accent) px-5 text-sm font-bold text-(--c-accent-text) disabled:opacity-60">
                        {saving ? '저장 중…' : '저장'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="grid h-10 place-items-center rounded-full border border-(--c-border) px-4 text-sm font-semibold hover:bg-black/5">
                        ⚙️ 설정
                      </Link>
                      <button type="button" onClick={startEdit} className="tm-btn h-10 rounded-full bg-(--c-surface) px-5 text-sm font-bold">
                        ✏️ 프로필 꾸미기
                      </button>
                    </>
                  )
                ) : (
                  me && (
                    <>
                      <ReportButton
                        subject={{ target: 'user', targetId: userId, targetLabel: data.user.nickname, targetUserId: userId }}
                        label="신고"
                        className="h-10 rounded-full border border-(--c-border) px-4 text-sm font-semibold text-(--c-muted) hover:text-red-500"
                      />
                      <button type="button" onClick={toggleBlock} className={`h-10 rounded-full px-4 text-sm font-bold ${blocked ? 'border border-red-500 text-red-500' : 'tm-btn bg-(--c-surface)'}`}>
                        {blocked ? '차단됨 · 풀기' : '차단'}
                      </button>
                    </>
                  )
                )}
              </div>
            </div>

            {/* 이름 · 한마디 · 소개 */}
            <div className="mt-4 md:ml-6">
              <h1 className="tm-headline text-4xl md:text-6xl">{user.nickname}</h1>
              <p className="tm-label mt-3">
                {isMe ? 'my profile' : 'profile'} · public maps {String(data.maps.length).padStart(2, '0')} · places {placeCount}
              </p>
              {deco.sections.intro && deco.mood && (
                <p className="mt-4 inline-block -rotate-1 rounded-full bg-(--c-lime) px-3.5 py-1.5 text-sm font-bold text-gray-900">💭 {deco.mood}</p>
              )}
              {deco.sections.intro && deco.bio && <p className="mt-3 max-w-xl whitespace-pre-line text-[15px] leading-relaxed">{deco.bio}</p>}
              {!deco.bio && !deco.mood && isMe && !draft && (
                <button type="button" onClick={startEdit} className="mt-3 text-sm font-semibold text-(--c-accent) hover:underline">
                  + 소개글과 오늘의 한마디를 남겨 보세요
                </button>
              )}
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

            {/* 탭 */}
            <div className="mt-8 flex gap-6 border-b border-(--c-border)" role="tablist">
              {(
                [
                  ['maps', '지도', data.maps.length],
                  ['diary', '다이어리', null],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={showTab === id}
                  disabled={!!draft}
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 pb-3 text-[15px] font-bold transition ${showTab === id ? 'border-(--c-accent) text-(--c-text)' : 'border-transparent text-(--c-muted) hover:text-(--c-text)'}`}
                >
                  {label}
                  {count != null && <span className="ml-1.5 font-mono text-xs text-(--c-muted)">{count}</span>}
                </button>
              ))}
            </div>

            {showTab === 'maps' ? (
              pinnedFirst.length === 0 ? (
                <p className="mt-10 rounded-3xl border-[1.5px] border-dashed border-(--c-ink)/25 px-6 py-16 text-center text-sm text-(--c-muted)">아직 공개한 지도가 없어요.</p>
              ) : (
                <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {pinnedFirst.map((m) => (
                    <li key={m.map.id}>
                      <Link href={`/maps/${m.map.id}`} className="tm-card block overflow-hidden rounded-2xl">
                        <MapThumb id={m.map.id} theme={m.map.theme} cover={m.map.coverUrl} dots={m.pinCount} className="h-40">
                          {data.deco.pinnedMapIds.includes(m.map.id) && (
                            <span className="absolute left-3 top-3 rounded-full bg-(--c-ink) px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-(--c-bg)">📌 pinned</span>
                          )}
                        </MapThumb>
                        <div className="border-t border-(--c-border) px-4 py-3">
                          <p className="truncate text-lg font-bold tracking-tight">{m.map.title || '제목 없는 지도'}</p>
                          <p className="tm-label mt-1">places {m.pinCount}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className={`mt-6 ${draft ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start' : ''}`}>
                <DiaryBoard
                  deco={deco}
                  maps={data.maps}
                  editing={!!draft}
                  selected={selected}
                  onSelect={setSelected}
                  onStickers={(stickers) => setDraft((d) => (d ? { ...d, stickers } : d))}
                />
                {draft && (
                  <DecoPanel
                    draft={draft}
                    setDraft={setDraft}
                    user={user}
                    nickname={nickname}
                    setNickname={setNickname}
                    maps={data.maps}
                    selected={selected}
                    onSelect={setSelected}
                    onError={setError}
                  />
                )}
              </div>
            )}
          </main>
        </>
      )}
    </div>
  )
}

/** 트위터처럼 프로필 맨 위 배너. 사진이 없으면 속지 무늬 + 큰 글자 */
function ProfileBanner({ deco, editing, onBanner, onError }: { deco: ProfileDecoInput; editing: boolean; onBanner: (url: string | null) => void; onError: (msg: string) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setUploading(true)
    try {
      onBanner(await uploadPinPhoto(f))
    } catch (e) {
      onError(e instanceof Error ? e.message : '사진을 올리지 못했어요.')
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }
  return (
    <div className="relative h-44 overflow-hidden border-b border-(--c-border) md:h-64 md:rounded-3xl md:border" style={deco.bannerUrl ? undefined : paperStyle(deco.paper, deco.color)}>
      {deco.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL/스토리지 URL
        <img src={deco.bannerUrl} alt="" className="size-full object-cover" />
      ) : (
        <>
          <div className="absolute -right-10 -top-16 size-64 rounded-full bg-(--c-accent) opacity-80 mix-blend-multiply" aria-hidden />
          <div className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-(--c-sky) opacity-70 mix-blend-multiply" aria-hidden />
          <div className="absolute -left-8 top-6 size-36 rotate-12 rounded-[40%] bg-(--c-lime) opacity-80 mix-blend-multiply" aria-hidden />
          <p className="absolute bottom-3 right-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">concept map ® diary</p>
        </>
      )}
      {editing && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30">
          <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="tm-btn rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900">
            {uploading ? '올리는 중…' : deco.bannerUrl ? '🖼️ 배너 바꾸기' : '🖼️ 배너 사진 올리기'}
          </button>
          {deco.bannerUrl && (
            <button type="button" onClick={() => onBanner(null)} className="rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white">
              빼기
            </button>
          )}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 다이어리 판
// ---------------------------------------------------------------------------

function DiaryBoard({
  deco,
  maps,
  editing,
  selected,
  onSelect,
  onStickers,
}: {
  deco: ProfileDecoInput
  maps: PublicMapSummary[]
  editing: boolean
  selected: string | null
  onSelect: (id: string | null) => void
  onStickers: (s: Sticker[]) => void
}) {
  const board = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const dark = isDarkPaper(deco.color)
  const scale = fontScale(deco.font)
  const pinned = maps.filter((m) => deco.pinnedMapIds.includes(m.map.id))
  // 대표 지도를 안 골랐으면 최근 공개 지도로 채운다
  const shown = pinned.length ? deco.pinnedMapIds.map((id) => pinned.find((m) => m.map.id === id)!).filter(Boolean) : maps.slice(0, PINNED_MAX)
  const others = maps.length - shown.length

  // 스티커 끌어 옮기기 (판 안에서의 % 위치)
  const toPercent = (e: ReactPointerEvent) => {
    const r = board.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }
  const onDown = (e: ReactPointerEvent, s: Sticker) => {
    if (!editing) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const p = toPercent(e)
    drag.current = { id: s.id, dx: s.x - p.x, dy: s.y - p.y }
    onSelect(s.id)
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toPercent(e)
    const x = Math.min(100, Math.max(0, p.x + d.dx))
    const y = Math.min(100, Math.max(0, p.y + d.dy))
    onStickers(deco.stickers.map((s) => (s.id === d.id ? { ...s, x, y } : s)))
  }
  const onUp = () => {
    drag.current = null
  }

  const sel = editing ? deco.stickers.find((s) => s.id === selected) : undefined
  const patchSel = (patch: Partial<Sticker>) => onStickers(deco.stickers.map((s) => (s.id === selected ? { ...s, ...patch } : s)))

  return (
    <div
      ref={board}
      onPointerDown={() => editing && onSelect(null)}
      className={`relative min-h-[520px] overflow-hidden rounded-[28px] border border-(--c-border) shadow-[0_10px_40px_rgb(15_23_42/0.10)] ${editing ? 'select-none' : ''}`}
      style={paperStyle(deco.paper, deco.color)}
    >
      {/* 다이어리 링 */}
      <div className="pointer-events-none absolute inset-y-6 left-3 flex flex-col justify-around" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={`block size-3 rounded-full ${dark ? 'bg-black/40' : 'bg-black/10'} shadow-inner`} />
        ))}
      </div>

      {/* 내용 (꾸미는 중엔 링크가 안 눌리게) */}
      <div className={`relative px-8 pb-10 pt-8 md:px-14 md:pt-12 ${editing ? 'pointer-events-none' : ''}`} style={{ fontFamily: fontFamily(deco.font) }}>

        {deco.sections.maps && (
          <section className="mt-10">
            <h2 className="font-bold" style={{ fontSize: 18 * scale }}>
              📌 {pinned.length ? '대표 지도' : '공개 지도'}
            </h2>
            {shown.length === 0 ? (
              <p className={`mt-3 text-sm ${dark ? 'text-white/60' : 'text-black/50'}`}>아직 공개한 지도가 없어요.</p>
            ) : (
              <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3">
                {shown.map((m) => (
                  <li key={m.map.id}>
                    <MapPaperCard summary={m} style={deco.mapStyle} scale={scale} />
                  </li>
                ))}
              </ul>
            )}
            {others > 0 && (
              <p className={`mt-6 text-sm ${dark ? 'text-white/60' : 'text-black/50'}`} style={{ fontFamily: 'var(--font-sans)' }}>
                그 밖에 공개 지도 {others}개
              </p>
            )}
          </section>
        )}
      </div>

      {/* 스티커 */}
      {deco.sections.stickers && (
        <div className={`absolute inset-0 ${editing ? '' : 'pointer-events-none'}`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {deco.stickers.map((s) => (
            <span
              key={s.id}
              onPointerDown={(e) => onDown(e, s)}
              className={`absolute leading-none drop-shadow-[0_2px_2px_rgb(0_0_0/0.15)] ${editing ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${s.id === selected && editing ? 'rounded-lg outline-2 outline-offset-4 outline-dashed outline-(--c-accent)' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.size, transform: `translate(-50%, -50%) rotate(${s.rotate}deg)` }}
              aria-hidden={!editing}
              aria-label={editing ? `스티커 ${s.emoji}` : undefined}
            >
              {s.emoji}
            </span>
          ))}
          {sel && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="tm-float absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-(--c-border) bg-(--c-surface) p-1 text-(--c-text)"
              style={{ left: `${Math.min(85, Math.max(15, sel.x))}%`, top: `calc(${sel.y}% + ${sel.size / 2 + 14}px)` }}
            >
              <ToolBtn label="작게" onClick={() => patchSel({ size: Math.max(20, sel.size - 8) })}><MinusIcon size={15} /></ToolBtn>
              <ToolBtn label="크게" onClick={() => patchSel({ size: Math.min(160, sel.size + 8) })}><PlusIcon size={15} /></ToolBtn>
              <ToolBtn label="왼쪽으로 돌리기" onClick={() => patchSel({ rotate: sel.rotate - 15 })}>↺</ToolBtn>
              <ToolBtn label="오른쪽으로 돌리기" onClick={() => patchSel({ rotate: sel.rotate + 15 })}>↻</ToolBtn>
              <ToolBtn
                label="떼기"
                onClick={() => {
                  onStickers(deco.stickers.filter((s) => s.id !== sel.id))
                  onSelect(null)
                }}
              >
                <TrashIcon size={15} />
              </ToolBtn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-8 place-items-center rounded-full text-sm hover:bg-black/5">
      {children}
    </button>
  )
}

/** 대표 지도 카드: 폴라로이드 또는 마스킹테이프 */
function MapPaperCard({ summary: { map, pinCount }, style, scale }: { summary: PublicMapSummary; style: MapCardStyle; scale: number }) {
  const tilt = [-3, -1.5, 1, 2.5][seeded(map.id, 4)]
  const title = map.title || '제목 없는 지도'
  if (style === 'tape') {
    return (
      <Link href={`/maps/${map.id}`} className="relative block transition hover:-translate-y-1" style={{ transform: `rotate(${tilt / 2}deg)` }}>
        <span className="absolute -top-2.5 left-1/2 z-10 h-5 w-16 -translate-x-1/2 -rotate-2 rounded-sm opacity-85" style={{ background: TAPE_COLORS[seeded(map.id, TAPE_COLORS.length)] }} aria-hidden />
        <div className="overflow-hidden rounded-md bg-white text-gray-800 shadow-md">
          <MapThumb id={map.id} theme={map.theme} cover={map.coverUrl} dots={pinCount} className="h-24 md:h-28" />
          <p className="truncate px-3 py-2 font-semibold" style={{ fontSize: 14 * scale }}>{title}</p>
        </div>
      </Link>
    )
  }
  return (
    <Link href={`/maps/${map.id}`} className="block bg-white p-2 pb-1 text-gray-800 shadow-md transition hover:-translate-y-1 hover:rotate-0" style={{ transform: `rotate(${tilt}deg)` }}>
      <MapThumb id={map.id} theme={map.theme} cover={map.coverUrl} dots={pinCount} className="h-24 md:h-28" />
      <p className="truncate px-1 pb-2 pt-2.5 text-center font-semibold" style={{ fontSize: 14 * scale }}>{title}</p>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// 꾸미기 패널
// ---------------------------------------------------------------------------

type Tab = 'paper' | 'stickers' | 'text' | 'maps' | 'me'
const TABS: { id: Tab; label: string }[] = [
  { id: 'paper', label: '🎨 속지' },
  { id: 'stickers', label: '✨ 스티커' },
  { id: 'text', label: '✏️ 글' },
  { id: 'maps', label: '📌 지도' },
  { id: 'me', label: '🙂 나' },
]

function DecoPanel({
  draft,
  setDraft,
  user,
  nickname,
  setNickname,
  maps,
  selected,
  onSelect,
  onError,
}: {
  draft: ProfileDecoInput
  setDraft: (fn: (d: ProfileDecoInput | null) => ProfileDecoInput | null) => void
  user: User
  nickname: string
  setNickname: (v: string) => void
  maps: PublicMapSummary[]
  selected: string | null
  onSelect: (id: string | null) => void
  onError: (msg: string) => void
}) {
  const [tab, setTab] = useState<Tab>('paper')
  const [sheet, setSheet] = useState(0)
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const patch = (p: Partial<ProfileDecoInput>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const toggle = (key: keyof ProfileSections) => patch({ sections: { ...draft.sections, [key]: !draft.sections[key] } })

  const addSticker = (emoji: string) => {
    if (draft.stickers.length >= STICKER_MAX) return onError(`스티커는 ${STICKER_MAX}개까지 붙일 수 있어요.`)
    const s = newSticker(emoji)
    patch({ stickers: [...draft.stickers, s], sections: { ...draft.sections, stickers: true } })
    onSelect(s.id)
  }

  const togglePin = (id: string) => {
    const on = draft.pinnedMapIds.includes(id)
    if (!on && draft.pinnedMapIds.length >= PINNED_MAX) return onError(`대표 지도는 ${PINNED_MAX}개까지 고를 수 있어요.`)
    patch({ pinnedMapIds: on ? draft.pinnedMapIds.filter((x) => x !== id) : [...draft.pinnedMapIds, id] })
  }

  const onPhoto = async (f: File | undefined) => {
    if (!f) return
    setUploading(true)
    try {
      await updateMyProfile({ avatarUrl: await uploadAvatar(f) })
    } catch (e) {
      onError(e instanceof Error ? e.message : '사진을 올리지 못했어요.')
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <aside className="tm-float overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface) lg:sticky lg:top-6">
      <div className="tm-scroll flex gap-1 overflow-x-auto border-b border-(--c-border) p-1.5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${tab === t.id ? 'bg-(--c-accent)/10 text-(--c-accent)' : 'text-(--c-muted) hover:bg-black/5'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-4">
        {tab === 'paper' && (
          <>
            <Field label="속지">
              <div className="grid grid-cols-3 gap-2">
                {PAPERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => patch({ paper: p.id, color: paperDefaultColor(p.id) ?? (['kraft', 'cream'].includes(draft.paper) ? '#ffffff' : draft.color) })}
                    className={`overflow-hidden rounded-xl border-2 text-xs font-semibold ${draft.paper === p.id ? 'border-(--c-accent)' : 'border-(--c-border)'}`}
                  >
                    <span className="block h-12" style={paperStyle(p.id, paperDefaultColor(p.id) ?? '#ffffff')} />
                    <span className="block py-1.5">{p.name}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="색">
              <div className="flex flex-wrap items-center gap-2">
                {PAPER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ color: c })}
                    aria-label={`속지 색 ${c}`}
                    className={`size-8 rounded-full border border-black/10 ${draft.color.toLowerCase() === c ? 'ring-2 ring-(--c-accent) ring-offset-2 ring-offset-(--c-surface)' : ''}`}
                    style={{ background: c }}
                  />
                ))}
                <label className="relative grid size-8 cursor-pointer place-items-center rounded-full border border-dashed border-(--c-border) text-xs" title="직접 고르기">
                  <PlusIcon size={14} />
                  <input type="color" value={draft.color} onChange={(e) => patch({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="속지 색 직접 고르기" />
                </label>
              </div>
            </Field>
          </>
        )}

        {tab === 'stickers' && (
          <>
            <Toggle on={draft.sections.stickers} onChange={() => toggle('stickers')} label="스티커 보이기" />
            <p className="text-xs text-(--c-muted)">
              누르면 붙어요. 판 위에서 끌어 옮기고, 눌러서 크기·회전을 바꿔요. ({draft.stickers.length}/{STICKER_MAX})
            </p>
            <div className="tm-scroll flex gap-1 overflow-x-auto">
              {STICKER_SET.map((g, i) => (
                <button key={g.name} type="button" onClick={() => setSheet(i)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${sheet === i ? 'bg-(--c-text) text-(--c-surface)' : 'bg-black/5 text-(--c-muted)'}`}>
                  {g.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-1">
              {STICKER_SET[sheet].items.map((e) => (
                <button key={e} type="button" onClick={() => addSticker(e)} className="grid aspect-square place-items-center rounded-xl text-2xl transition hover:scale-110 hover:bg-black/5" aria-label={`${e} 붙이기`}>
                  {e}
                </button>
              ))}
            </div>
            {draft.stickers.length > 0 && (
              <button type="button" onClick={() => (patch({ stickers: [] }), onSelect(null))} className="text-xs font-semibold text-red-500 hover:underline">
                스티커 모두 떼기
              </button>
            )}
            {selected && <p className="text-xs text-(--c-muted)">선택한 스티커 아래 도구로 크기·회전·떼기를 할 수 있어요.</p>}
          </>
        )}

        {tab === 'text' && (
          <>
            <Toggle on={draft.sections.intro} onChange={() => toggle('intro')} label="소개글 · 한마디 보이기" />
            <Field label="오늘의 한마디" count={`${draft.mood.length}/${MOOD_MAX}`}>
              <input
                value={draft.mood}
                maxLength={MOOD_MAX}
                onChange={(e) => patch({ mood: e.target.value })}
                placeholder="예) 이번 주말은 성수 빵지순례 🥐"
                className="h-11 w-full rounded-xl border border-(--c-border) bg-transparent px-3 text-sm outline-none focus:border-(--c-accent)"
              />
            </Field>
            <Field label="소개글" count={`${draft.bio.length}/${BIO_MAX}`}>
              <textarea
                value={draft.bio}
                maxLength={BIO_MAX}
                rows={4}
                onChange={(e) => patch({ bio: e.target.value })}
                placeholder="어떤 지도를 만드는지 소개해 보세요"
                className="w-full resize-none rounded-xl border border-(--c-border) bg-transparent px-3 py-2.5 text-sm outline-none focus:border-(--c-accent)"
              />
            </Field>
            <Field label="글꼴">
              <div className="grid grid-cols-2 gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => patch({ font: f.id })}
                    className={`h-11 rounded-xl border-2 ${draft.font === f.id ? 'border-(--c-accent)' : 'border-(--c-border)'}`}
                    style={{ fontFamily: f.family, fontSize: 15 * fontScale(f.id) }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {tab === 'maps' && (
          <>
            <Toggle on={draft.sections.maps} onChange={() => toggle('maps')} label="지도 보이기" />
            <Field label="카드 모양">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['polaroid', '📷 폴라로이드'],
                    ['tape', '🎞️ 마스킹테이프'],
                  ] as const
                ).map(([id, name]) => (
                  <button key={id} type="button" onClick={() => patch({ mapStyle: id })} className={`h-11 rounded-xl border-2 text-sm font-semibold ${draft.mapStyle === id ? 'border-(--c-accent)' : 'border-(--c-border)'}`}>
                    {name}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="대표 지도" count={`${draft.pinnedMapIds.length}/${PINNED_MAX}`}>
              {maps.length === 0 ? (
                <p className="text-sm text-(--c-muted)">공개한 지도가 있어야 고를 수 있어요. 지도 편집에서 ‘공개’로 바꿔 보세요.</p>
              ) : (
                <ul className="space-y-1.5">
                  {maps.map((m) => {
                    const order = draft.pinnedMapIds.indexOf(m.map.id)
                    return (
                      <li key={m.map.id}>
                        <button
                          type="button"
                          onClick={() => togglePin(m.map.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${order >= 0 ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border)'}`}
                        >
                          <MapThumb id={m.map.id} theme={m.map.theme} cover={m.map.coverUrl} dots={m.pinCount} className="h-10 w-14 shrink-0 rounded-lg" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.map.title || '제목 없는 지도'}</span>
                          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${order >= 0 ? 'bg-(--c-accent) text-(--c-accent-text)' : 'border border-(--c-border)'}`}>
                            {order >= 0 ? order + 1 : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-2 text-xs text-(--c-muted)">고른 순서대로 보여요. 안 고르면 최근 공개 지도가 보여요.</p>
            </Field>
          </>
        )}

        {tab === 'me' && (
          <>
            <Field label="프로필 사진">
              <div className="flex items-center gap-4">
                <Avatar id={user.id} nickname={user.nickname} src={user.avatarUrl} size={72} />
                <div className="flex flex-col items-start gap-1.5">
                  <button
                    type="button"
                    onClick={() => file.current?.click()}
                    disabled={uploading}
                    className="flex h-10 items-center gap-1.5 rounded-full border border-(--c-border) px-4 text-sm font-semibold hover:bg-black/[0.03] disabled:opacity-60"
                  >
                    <ImageIcon size={16} />
                    {uploading ? '올리는 중…' : user.avatarUrl ? '사진 바꾸기' : '사진 올리기'}
                  </button>
                  {user.avatarUrl && (
                    <button type="button" onClick={() => updateMyProfile({ avatarUrl: null }).catch((e: Error) => onError(e.message))} className="px-1 text-xs font-semibold text-red-500 hover:underline">
                      사진 지우기
                    </button>
                  )}
                </div>
                <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </div>
              <p className="mt-2 text-xs text-(--c-muted)">사진은 올리는 즉시 바뀌어요.</p>
            </Field>
            <Field label="닉네임" count={`${nickname.length}/30`}>
              <input
                value={nickname}
                maxLength={30}
                onChange={(e) => setNickname(e.target.value)}
                className="h-11 w-full rounded-xl border border-(--c-border) bg-transparent px-3 text-sm outline-none focus:border-(--c-accent)"
              />
            </Field>
          </>
        )}
      </div>
    </aside>
  )
}

function Field({ label, count, children }: { label: string; count?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-(--c-muted)">{label}</p>
        {count && <p className="text-[11px] text-(--c-muted)">{count}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} className="flex w-full items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2.5 text-sm font-semibold">
      {label}
      <span className={`relative h-6 w-10 rounded-full transition ${on ? 'bg-(--c-accent)' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
