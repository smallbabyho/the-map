'use client'

import { formatMinutes } from './legModes'
import { STEP_ICON, type TransitInfo, type TransitStep } from './map'

const isRide = (s: TransitStep) => s.kind !== 'walk' && s.kind !== 'access'
const isIntercity = (s: TransitStep) => s.kind === 'train' || s.kind === 'intercityBus' || s.kind === 'air'

/**
 * 대중교통 구간 요약: [🚶 4분] › [2호선] › [🚌 2412] › [🚶 3분] + 승하차 · 환승 · 요금.
 * 장거리면 [🚶 3분] › [2호선] › [🚄 KTX] › [🚌 1003] 처럼 역·공항까지 시내 대중교통이 붙는다 (못 찾으면 [🚕 약 20분] 예상).
 * '자세히'를 누르면 단계별(어디서 타고 어디서 내리는지)로 펼친다.
 */
export function TransitSteps({ info, className = '' }: { info: TransitInfo; className?: string }) {
  const rides = info.steps.filter(isRide)
  // 장거리면 역·공항까지 시내 구간 말고 기차·버스·비행기 구간 기준으로 "서울 → 부산"
  const main = info.intercity ? rides.filter(isIntercity) : rides
  const first = main[0]
  const last = main[main.length - 1]
  // 1분 미만 걷기는 요약에서 뺀다
  const shown = info.steps.filter((s) => s.kind !== 'walk' || s.minutes > 0)
  const hasEstimate = info.steps.some((s) => s.estimated)

  return (
    <div className={`text-xs ${className}`}>
      <ol className="flex flex-wrap items-center gap-1" aria-label="대중교통 경로">
        {shown.map((s, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-(--c-muted)" aria-hidden>›</span>}
            <StepChip step={s} />
          </li>
        ))}
      </ol>
      <p className="mt-1 text-(--c-muted)">
        {first && last && (info.intercity ? `${first.from ?? ''} → ${last.to ?? ''}` : `${first.from ?? ''} 승차 → ${last.to ?? ''} 하차`)}
        {info.transfers > 0 ? ` · 환승 ${info.transfers}회` : rides.length > 0 ? ' · 환승 없음' : ''}
        {info.fare != null && ` · ${info.fare.toLocaleString('ko-KR')}원`}
      </p>
      {hasEstimate && <p className="mt-0.5 text-(--c-muted)">역·공항까지 이동 시간 일부는 예상치예요.</p>}
      {rides.length > 0 && (
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-(--c-muted) hover:text-(--c-text) [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">자세히 ▾</span>
            <span className="hidden group-open:inline">접기 ▴</span>
          </summary>
          <ol className="mt-1.5 space-y-1.5 border-l-2 border-(--c-border) pl-3">
            {info.steps.map((s, i) => (
              <li key={i} className="leading-snug">
                <StepDetail step={s} index={i} total={info.steps.length} next={info.steps[i + 1]} prev={info.steps[i - 1]} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function StepDetail({ step: s, index, total, next, prev }: { step: TransitStep; index: number; total: number; next?: TransitStep; prev?: TransitStep }) {
  if (s.kind === 'walk') {
    return (
      <span className="text-(--c-muted)">
        {STEP_ICON.walk} {s.minutes}분 {index > 0 && index < total - 1 ? '환승 이동' : '걷기'}
        {s.distanceM > 0 && ` (${s.distanceM}m)`}
      </span>
    )
  }
  if (s.kind === 'access') {
    const where = next && isRide(next) ? `${next.from ?? '역'}까지` : `${prev?.to ?? '역'}에서 목적지까지`
    return (
      <span className="text-(--c-muted)">
        {STEP_ICON.access} {where} 대중교통 약 {formatMinutes(s.minutes)}{s.estimated && ' (예상)'}
      </span>
    )
  }
  const verb = s.kind === 'air' ? ['출발', '도착'] : ['승차', '하차']
  return (
    <>
      <span className="font-semibold" style={{ color: s.color }}>
        {STEP_ICON[s.kind]} {s.name}
      </span>{' '}
      {s.from} {verb[0]} → {s.to} {verb[1]}
      <span className="text-(--c-muted)">
        {' '}
        ({s.stops != null && `${s.stops}정거장, `}
        {formatMinutes(s.minutes)})
      </span>
    </>
  )
}

function StepChip({ step }: { step: TransitStep }) {
  if (step.kind === 'walk') return <span className="text-(--c-muted)">{STEP_ICON.walk} {step.minutes}분</span>
  if (step.kind === 'access') return <span className="text-(--c-muted)">{STEP_ICON.access} 약 {formatMinutes(step.minutes)}</span>
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold text-white" style={{ background: step.color }}>
      <span aria-hidden>{STEP_ICON[step.kind]}</span>
      {step.name}
    </span>
  )
}
