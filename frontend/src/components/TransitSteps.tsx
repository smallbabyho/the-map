'use client'

import type { TransitInfo, TransitStep } from './map'

/**
 * 대중교통 구간 요약: [🚶 4분] › [2호선] › [🚌 2412] › [🚶 3분] + 승하차 · 환승 · 요금.
 * '자세히'를 누르면 단계별(어디서 타고 어디서 내리는지)로 펼친다.
 */
export function TransitSteps({ info, className = '' }: { info: TransitInfo; className?: string }) {
  const rides = info.steps.filter((s) => s.kind !== 'walk')
  const first = rides[0]
  const last = rides[rides.length - 1]
  // 1분 미만 걷기는 요약에서 뺀다
  const shown = info.steps.filter((s) => s.kind !== 'walk' || s.minutes > 0)

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
        {first && last && `${first.from ?? ''} 승차 → ${last.to ?? ''} 하차`}
        {info.transfers > 0 ? ` · 환승 ${info.transfers}회` : rides.length > 0 ? ' · 환승 없음' : ''}
        {info.fare != null && ` · ${info.fare.toLocaleString('ko-KR')}원`}
      </p>
      {rides.length > 0 && (
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-(--c-muted) hover:text-(--c-text) [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">자세히 ▾</span>
            <span className="hidden group-open:inline">접기 ▴</span>
          </summary>
          <ol className="mt-1.5 space-y-1.5 border-l-2 border-(--c-border) pl-3">
            {info.steps.map((s, i) => (
              <li key={i} className="leading-snug">
                {s.kind === 'walk' ? (
                  <span className="text-(--c-muted)">
                    🚶 {s.minutes}분 {i > 0 && i < info.steps.length - 1 ? '환승 이동' : '걷기'}
                    {s.distanceM > 0 && ` (${s.distanceM}m)`}
                  </span>
                ) : (
                  <>
                    <span className="font-semibold" style={{ color: s.color }}>
                      {s.kind === 'bus' ? '🚌' : '🚇'} {s.name}
                    </span>{' '}
                    {s.from} 승차 → {s.to} 하차
                    <span className="text-(--c-muted)">
                      {' '}
                      ({s.stops != null && `${s.stops}정거장, `}
                      {s.minutes}분)
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function StepChip({ step }: { step: TransitStep }) {
  if (step.kind === 'walk') return <span className="text-(--c-muted)">🚶 {step.minutes}분</span>
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold text-white" style={{ background: step.color }}>
      <span aria-hidden>{step.kind === 'bus' ? '🚌' : '🚇'}</span>
      {step.name}
    </span>
  )
}
