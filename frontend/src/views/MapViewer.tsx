'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useCurrentUser } from '../auth'
import { HeaderActions } from '../components/AppRail'
import { Avatar } from '../components/Avatar'
import { ChevronLeftIcon, CopyIcon, UsersIcon } from '../components/icons'
import { formatMinutes } from '../components/legModes'
import { mapPurpose } from '../components/mapPurpose'
import { isCustomPlace, MapView, type MapInsets } from '../components/map'
import { LegModeSwitch, useViewCourse, ViewModePicker, type ViewMode } from '../components/map/ViewModePicker'
import { getTheme, themeVars } from '../components/themes'
import { KakaoDirectionsLink } from '../components/map/KakaoDirections'
import { placeHref } from '../components/place/PlaceStats'
import { KakaoShareButton } from '../components/share/KakaoShareButton'
import { StoryCardButton } from '../components/share/StoryCardButton'
import { ExportMapButton } from '../components/share/ExportMapButton'
import { ReportButton } from '../components/report/ReportDialog'
import { MapMeetupList } from '../components/meetup/MapMeetupList'
import { TransitSteps } from '../components/TransitSteps'
import { copyMap, getUser } from '../db/api'
import type { MapDetail, User } from '../types'

/** 왼쪽 세로 메뉴를 없앴다 (오른쪽 위 HeaderActions 로) */
const RAIL_W = 0
const PANEL_W = 380

/** 남의 공개 지도 (읽기 전용): 코스 보기 · 내 지도로 가져오기 · 성지순례 모집 */
export function MapViewer({ detail }: { detail: MapDetail }) {
  const router = useRouter()
  const me = useCurrentUser()
  const { map, pins, legs } = detail
  const theme = getTheme(map.theme)
  const [owner, setOwner] = useState<User | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 성공하면 다음 화면으로 넘어가며 busy 를 안 푼다. 뒤로 오면 Next 가 이 화면을 상태째 다시 보여 주므로, 떠날 때 푼다
  useLayoutEffect(() => () => setBusy(false), [])
  const [error, setError] = useState('')
  const [desktop, setDesktop] = useState(false)
  // 이동수단을 바꿔서 코스 보기 (화면에서만, 지도는 그대로)
  const [viewMode, setViewMode] = useState<ViewMode>('course')
  const view = useViewCourse(pins, legs, viewMode)

  useEffect(() => {
    getUser(map.ownerId).then(setOwner)
  }, [map.ownerId])
  useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const here = `/maps/${map.id}`
  const takeIt = async () => {
    if (!me) return router.push(`/login?next=${encodeURIComponent(here)}`)
    setBusy(true)
    setError('')
    try {
      const mine = await copyMap(map.id)
      router.push(`/maps/${mine.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오지 못했어요.')
      setBusy(false)
    }
  }
  // 카톡 · 공유 링크로 바로 들어오면 돌아갈 페이지가 없다 → 그때는 둘러보기로
  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/explore'))
  const meetupHref = me ? `/meetups/new?mapId=${map.id}` : `/login?next=${encodeURIComponent(`/meetups/new?mapId=${map.id}`)}`
  const insets: MapInsets = desktop ? { top: 0, right: 0, bottom: 0, left: RAIL_W + PANEL_W } : { top: 0, right: 0, bottom: 0, left: 0 }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-(--c-bg) text-(--c-text) md:block" style={themeVars(theme)}>
      <div className="fixed right-3 top-3 z-40 md:right-4 md:top-4">
        <HeaderActions floating />
      </div>

      {/* 지도: 모바일은 위쪽, 데스크톱은 전체 */}
      <div className="relative h-[42dvh] shrink-0 md:absolute md:inset-0 md:h-auto">
        <MapView pins={pins} legs={view.legs} theme={theme} look={map} selectedPinId={selectedId} onSelectPin={(id) => setSelectedId((c) => (c === id ? null : id))} insets={insets} />
        <button type="button" onClick={goBack} className="tm-float absolute left-3 top-3 z-20 grid size-10 place-items-center rounded-full bg-(--c-surface) text-(--c-text) md:hidden" aria-label="뒤로">
          <ChevronLeftIcon size={20} />
        </button>
      </div>

      {/* 정보 패널 */}
      <section
        className="tm-scroll relative z-20 min-h-0 flex-1 overflow-y-auto bg-(--c-surface) md:absolute md:inset-y-0 md:border-r md:border-(--c-border) md:shadow-[4px_0_24px_rgb(15_23_42/0.06)]"
        style={desktop ? { left: RAIL_W, width: PANEL_W } : undefined}
      >
        {map.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL/스토리지 URL
          <img src={map.coverUrl} alt="" className="h-40 w-full object-cover" />
        )}
        <div className="px-5 pb-6 pt-5">
          <button type="button" onClick={goBack} className="-ml-1.5 hidden items-center gap-0.5 rounded-lg py-1 pl-1 pr-2 text-sm text-(--c-muted) hover:bg-black/5 md:flex">
            <ChevronLeftIcon size={16} />
            뒤로
          </button>
          <p className="tm-label dot mt-3">
            {mapPurpose(map) === 'record' ? '📖 다녀온 기록' : '🗓️ 계획 중인 코스'} · {theme.name} theme
          </p>
          <h1 className="tm-headline mt-2 text-4xl">{map.title || '제목 없는 지도'}</h1>
          {owner && (
            <Link href={`/u/${owner.id}`} className="mt-2 flex w-fit items-center gap-2 text-sm text-(--c-muted) hover:underline">
              <Avatar id={owner.id} nickname={owner.nickname} src={owner.avatarUrl} size={22} />
              <b className="font-semibold text-(--c-text)">{owner.nickname}</b> 님의 지도
            </Link>
          )}
          <p className="mt-3 text-sm text-(--c-muted)">
            장소 {pins.length}곳{view.totalMin > 0 && ` · 이동 ${view.loading ? '계산 중…' : `약 ${formatMinutes(view.totalMin)}`}`}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={takeIt} disabled={busy} className="tm-btn flex h-12 items-center justify-center gap-1.5 rounded-xl bg-(--c-accent) text-sm font-bold text-(--c-accent-text) disabled:opacity-60">
              <CopyIcon size={16} />
              {busy ? '가져오는 중…' : '내 지도로 가져오기'}
            </button>
            <Link href={meetupHref} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-(--c-border) text-sm font-bold transition hover:bg-black/[0.03]">
              <UsersIcon size={16} />
              성지순례 모집
            </Link>
          </div>
          <KakaoShareButton
            className="mt-2"
            title={map.title || '제목 없는 지도'}
            description={`${owner ? `${owner.nickname} 님의 지도 · ` : ''}장소 ${pins.length}곳`}
            path={`/maps/${map.id}`}
            theme={map.theme}
            course={pins.map((p) => p.place)}
            buttonTitle="지도 보러 가기"
            onError={setError}
          />
          <StoryCardButton className="mt-2" data={{ map, pins, legs, theme, ownerName: owner?.nickname }} />
          <ExportMapButton className="mt-2" data={{ map, pins, legs }} />
          <p className="mt-2 text-xs text-(--c-muted)">가져오거나 이 지도로 순례하면 이번 달 지도 순위에 반영돼요.</p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">{error}</p>}
          {me && me.id !== map.ownerId && (
            <div className="mt-2">
              <ReportButton subject={{ target: 'map', targetId: map.id, targetLabel: map.title || '제목 없는 지도', targetUserId: map.ownerId }} label="이 지도 신고하기" />
            </div>
          )}
        </div>

        {/* 이동수단을 바꿔서 코스 보기 (화면에서만, 지도는 그대로) */}
        {pins.length > 1 && <ViewModePicker value={viewMode} onChange={setViewMode} className="border-t border-(--c-border) px-5 pt-3" />}
        <ol className={`${pins.length > 1 ? '' : 'border-t border-(--c-border) '}px-3 py-3`}>
          {pins.map((p, i) => {
            const next = pins[i + 1]
            const legMode = next && view.modeOf(p.id, next.id)
            const transit = next && view.transitOf(p.id, next.id)
            return (
              <li key={p.id}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition ${selectedId === p.id ? 'bg-(--c-accent)/10' : 'hover:bg-black/[0.03]'}`}
                  >
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-full text-lg shadow-sm ring-2 ring-(--c-surface)" style={{ background: p.color }}>
                      {p.icon}
                      <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gray-900 px-1 text-[0.625rem] font-bold text-white ring-2 ring-(--c-surface)">{i + 1}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-semibold">{p.place.name}</span>
                      {p.memo && <span className="block truncate text-[0.8125rem] text-(--c-muted)">{p.memo}</span>}
                    </span>
                    {p.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL/외부 URL 미리보기
                      <img src={p.photoUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                    )}
                  </button>
                  {!isCustomPlace(p.place.externalId) && (
                    <Link
                      href={placeHref(p.place.externalId)}
                      title={`${p.place.name} 리뷰 · 담긴 횟수`}
                      className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[0.6875rem] font-semibold text-(--c-muted) transition hover:bg-amber-400/20 hover:text-(--c-text)"
                    >
                      <span className="text-[1.0625rem] leading-[18px] text-amber-400" aria-hidden>★</span>
                      리뷰
                    </Link>
                  )}
                  <KakaoDirectionsLink to={p.place} from={pins[i - 1]?.place} mode={i > 0 ? view.modeOf(pins[i - 1].id, p.id) : undefined} />
                </div>
                {legMode && (
                  <div className="ml-[27px] border-l-2 border-dotted border-(--c-border) py-1.5 pl-6 text-xs text-(--c-muted)">
                    <LegModeSwitch mode={legMode} durationMin={view.durationOf(p.id, next.id)} note={view.noteOf(p.id, next.id)} onChange={(m) => view.setLegMode(p.id, next.id, m)} />
                    {transit && <TransitSteps info={transit} className="mt-1.5 text-(--c-text)" />}
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        <MapMeetupList mapId={map.id} newHref={meetupHref} />
      </section>
    </div>
  )
}
