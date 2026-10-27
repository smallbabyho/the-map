'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { AppRail, MobileTabBar } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { MapThumb } from '../components/MapThumb'
import { StarInput, Stars } from '../components/place/PlaceStats'
import { ReportButton } from '../components/report/ReportDialog'
import { deletePlaceReview, getPlaceDetail, savePlaceReview } from '../db/api'
import type { PlaceDetail, PlaceReview } from '../types'

const REVIEW_MAX = 100
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
/** 카카오 장소 ID(숫자)일 때만 카카오맵 장소 페이지가 있다 (샘플 · 직접 지정 장소는 없음) */
const kakaoPlaceUrl = (externalId: string) => (/^\d+$/.test(externalId) ? `https://place.map.kakao.com/${externalId}` : null)

/** 장소 상세: 담긴 지도 수 · 별점 · 리뷰 · 이 장소를 담은 공개 지도 */
export function PlaceDetailPage() {
  const { externalId: raw } = useParams<{ externalId: string }>()
  const externalId = decodeURIComponent(raw ?? '')
  const me = useCurrentUser()
  const [detail, setDetail] = useState<PlaceDetail | null | undefined>(undefined)
  const [error, setError] = useState('')

  const reload = useCallback(
    () =>
      getPlaceDetail(externalId)
        .then(setDetail)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : '장소를 불러오지 못했어요.')),
    [externalId],
  )
  // 로그인 상태가 바뀌면 '리뷰를 쓸 수 있나'도 바뀐다
  useEffect(() => {
    reload()
  }, [reload, me?.id])

  const myReview = me ? detail?.reviews.find((r) => r.author.id === me.id) : undefined
  const kakaoUrl = kakaoPlaceUrl(externalId)

  return (
    <div className="relative min-h-dvh pb-16 md:pb-0 pt-14">
      <AppRail active="explore" />
      <MobileTabBar active="explore" />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-10 md:pt-12">
        <p className="tm-label dot">place · 장소 리뷰</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

        {detail === undefined ? (
          <div className="mt-4 space-y-3">
            <div className="h-12 w-2/3 animate-pulse rounded-xl bg-black/5" />
            <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
          </div>
        ) : detail === null ? (
          <div className="mt-8 flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-(--c-ink)/25 px-6 py-16 text-center">
            <div className="text-5xl" aria-hidden>📍</div>
            <h1 className="mt-4 text-lg font-semibold">아직 아무도 지도에 담지 않은 장소예요</h1>
            <p className="mt-1.5 text-sm text-(--c-muted)">내 지도에 처음으로 담아 보세요.</p>
          </div>
        ) : (
          <>
            <h1 className="tm-headline mt-2 text-4xl md:text-6xl">{detail.place.name}</h1>
            {kakaoUrl && (
              <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-(--c-muted) hover:text-(--c-text) hover:underline">
                카카오맵에서 장소 정보 보기 ↗
              </a>
            )}

            <dl className="mt-6 grid grid-cols-3 gap-2">
              <StatTile label="담긴 지도">
                {detail.stats.mapCount >= 5 && <span aria-hidden>🔥 </span>}
                {detail.stats.mapCount}
                <span className="ml-0.5 text-sm font-semibold text-(--c-muted)">개</span>
              </StatTile>
              <StatTile label="평균 별점">
                {detail.stats.avgRating != null ? (
                  <>
                    <span className="text-amber-400">★</span> {detail.stats.avgRating.toFixed(1)}
                  </>
                ) : (
                  <span className="text-base font-semibold text-(--c-muted)">아직 없음</span>
                )}
              </StatTile>
              <StatTile label="리뷰">
                {detail.stats.reviewCount}
                <span className="ml-0.5 text-sm font-semibold text-(--c-muted)">개</span>
              </StatTile>
            </dl>
            <p className="mt-2 text-xs text-(--c-muted)">담긴 지도 수에는 비공개 지도도 들어가요. 어떤 지도인지는 공개 지도만 보여요.</p>

            {/* 리뷰 쓰기 */}
            <section className="mt-10">
              <h2 className="text-lg font-bold">리뷰</h2>
              {!me ? (
                <p className="mt-3 rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-(--c-muted)">
                  <Link href="/login" className="font-semibold text-(--c-accent) hover:underline">로그인</Link>하고 내 지도에 이 장소를 담으면 리뷰를 남길 수 있어요.
                </p>
              ) : detail.canReview ? (
                <ReviewForm key={myReview?.id ?? 'new'} placeId={detail.place.id} mine={myReview} onSaved={reload} />
              ) : (
                <p className="mt-3 rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-(--c-muted)">내 지도에 이 장소를 담으면 리뷰를 남길 수 있어요.</p>
              )}

              {detail.reviews.length === 0 ? (
                <p className="mt-6 text-center text-sm text-(--c-muted)">아직 리뷰가 없어요.</p>
              ) : (
                <ul className="mt-4 divide-y divide-(--c-border)">
                  {detail.reviews.map((r) => (
                    <ReviewItem
                      key={r.id}
                      review={r}
                      canDelete={!!me && (me.id === r.author.id || me.role === 'admin')}
                      canReport={!!me && me.id !== r.author.id}
                      onDeleted={reload}
                      onError={setError}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* 이 장소를 담은 공개 지도 */}
            <section className="mt-10">
              <h2 className="text-lg font-bold">이 장소를 담은 지도</h2>
              {detail.maps.length === 0 ? (
                <p className="mt-3 text-sm text-(--c-muted)">공개된 지도가 아직 없어요.</p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {detail.maps.map((s) => (
                    <li key={s.map.id}>
                      <Link href={`/maps/${s.map.id}`} className="tm-card block overflow-hidden rounded-2xl">
                        <MapThumb id={s.map.id} theme={s.map.theme} cover={s.map.coverUrl} dots={s.pinCount} className="h-28" />
                        <div className="p-4">
                          <h3 className="truncate text-[0.9375rem] font-bold">{s.map.title || '제목 없는 지도'}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-(--c-muted)">
                            <Avatar id={s.owner.id} nickname={s.owner.nickname} src={s.owner.avatarUrl} size={18} />
                            {s.owner.nickname} · 장소 {s.pinCount}곳
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-(--c-border) bg-(--c-surface) px-4 py-3">
      <dt className="text-xs font-semibold text-(--c-muted)">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tracking-tight">{children}</dd>
    </div>
  )
}

/** 내 리뷰 쓰기 · 고치기 (장소 하나에 1개) */
function ReviewForm({ placeId, mine, onSaved }: { placeId: string; mine: PlaceReview | undefined; onSaved: () => void }) {
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [body, setBody] = useState(mine?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return setError('별점을 골라 주세요.')
    setSaving(true)
    setError('')
    try {
      await savePlaceReview(placeId, { rating, body })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '리뷰를 저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl border border-(--c-border) bg-(--c-surface) p-4">
      <div className="flex items-center justify-between gap-3">
        <StarInput value={rating} onChange={setRating} />
        {mine && <span className="text-xs text-(--c-muted)">내 리뷰 고치기</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={REVIEW_MAX}
          placeholder="한 줄 후기 (선택)"
          className="h-11 min-w-0 flex-1 rounded-xl border border-(--c-border) bg-transparent px-3 text-[0.9375rem] outline-none focus:border-(--c-accent)"
          aria-label="한 줄 후기"
        />
        <button type="submit" disabled={saving || !rating} className="h-11 shrink-0 rounded-xl bg-(--c-accent) px-4 text-sm font-semibold text-(--c-accent-text) transition disabled:opacity-40">
          {saving ? '저장 중' : mine ? '고치기' : '남기기'}
        </button>
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-(--c-muted)">
        <span role="alert" className="text-red-500">{error}</span>
        <span>
          {body.length}/{REVIEW_MAX}
        </span>
      </div>
    </form>
  )
}

function ReviewItem({ review: r, canDelete, canReport, onDeleted, onError }: { review: PlaceReview; canDelete: boolean; canReport: boolean; onDeleted: () => void; onError: (msg: string) => void }) {
  const remove = async () => {
    if (!window.confirm('이 리뷰를 지울까요?')) return
    try {
      await deletePlaceReview(r.id)
      onDeleted()
    } catch (e) {
      onError(e instanceof Error ? e.message : '리뷰를 지우지 못했어요.')
    }
  }
  return (
    <li className="flex gap-3 py-4">
      <Link href={`/u/${r.author.id}`} className="shrink-0">
        <Avatar id={r.author.id} nickname={r.author.nickname} src={r.author.avatarUrl} size={36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={`/u/${r.author.id}`} className="text-sm font-semibold hover:underline">{r.author.nickname}</Link>
          <Stars value={r.rating} size={13} />
          <span className="text-xs text-(--c-muted)">{dateLabel(r.updatedAt)}</span>
          <span className="ml-auto flex items-center gap-3">
            {canReport && (
              <ReportButton
                subject={{ target: 'review', targetId: r.id, targetLabel: `${'★'.repeat(r.rating)} ${r.body}`.trim().slice(0, 60), targetUserId: r.author.id }}
              />
            )}
            {canDelete && (
              <button type="button" onClick={remove} className="text-xs text-(--c-muted) hover:text-red-500">
                지우기
              </button>
            )}
          </span>
        </div>
        {r.body && <p className="mt-1 break-words text-[0.9375rem]">{r.body}</p>}
        {r.hidden && <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">신고가 여러 번 들어와서 다른 사람에게는 숨겨졌어요. 관리자가 확인한 뒤 다시 보일 수 있어요.</p>}
      </div>
    </li>
  )
}
