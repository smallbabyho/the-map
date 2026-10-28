import type { MarkerShape, Pin } from '../../types'
import { legLabel } from '../legModes'
import type { Segment } from './segments'

// 카카오 CustomOverlay 에 넣을 DOM 요소. 모양은 app/globals.css 의 .tm-marker 참고.
// 이름 등 사용자 입력은 textContent 로만 넣는다 (HTML 주입 방지).

export function createMarkerElement(pin: Pin, index: number, selected: boolean, onClick: () => void, shape: MarkerShape = 'pin', visited = false): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'tm-marker tm-overlay'
  el.dataset.selected = String(selected)
  el.dataset.shape = shape
  if (visited) el.dataset.visited = 'true'
  el.style.setProperty('--pin', pin.color)
  el.setAttribute('aria-label', `${index + 1}번 ${pin.place.name}`)

  const head = document.createElement('span')
  head.className = 'tm-marker-head'
  const emoji = document.createElement('span')
  emoji.className = 'tm-marker-emoji'
  emoji.textContent = pin.icon
  const no = document.createElement('span')
  no.className = 'tm-marker-no'
  no.textContent = visited ? '✓' : String(index + 1)
  const label = document.createElement('span')
  label.className = 'tm-marker-label'
  label.textContent = pin.place.name

  el.append(head, emoji, no, label)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

export function createLegLabelElement(leg: Pick<Segment, 'mode' | 'durationMin' | 'icon'>, routeColor: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tm-leg-label tm-overlay'
  el.style.setProperty('--route', routeColor)
  el.textContent = legLabel(leg.mode, leg.durationMin, leg.icon)
  return el
}

/** 내 위치 파란 점 (.tm-me, app/globals.css) */
export function createMyLocationElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tm-me tm-overlay'
  el.setAttribute('aria-label', '내 위치')
  return el
}
