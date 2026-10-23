import type { MeetupSummary } from '../../types'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** '10월 26일 (토) 오전 11:00' */
export function formatMeetAt(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) ${ampm} ${hh}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 'D-3' / '오늘' / '내일' / '끝남' */
export function dday(iso: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  if (target.getTime() < Date.now()) return '끝남'
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - start.getTime()) / 864e5)
  return days === 0 ? '오늘' : days === 1 ? '내일' : `D-${days}`
}

export type MeetupState = 'open' | 'almost' | 'full' | 'closed' | 'canceled' | 'past'

/** 화면에 보여줄 모집 상태 */
export function meetupState(m: MeetupSummary): MeetupState {
  if (m.status === 'canceled') return 'canceled'
  if (Date.parse(m.meetAt) < Date.now()) return 'past'
  if (m.status === 'closed') return 'closed'
  const left = m.capacity - m.members.length
  if (left <= 0) return 'full'
  if (left <= 1) return 'almost'
  return 'open'
}

export const STATE_BADGE: Record<MeetupState, { label: string; className: string }> = {
  open: { label: '모집 중', className: 'bg-emerald-500 text-white' },
  almost: { label: '마감 임박', className: 'bg-orange-500 text-white' },
  full: { label: '정원 마감', className: 'bg-gray-700 text-white' },
  closed: { label: '모집 마감', className: 'bg-gray-700 text-white' },
  canceled: { label: '취소됨', className: 'bg-red-500 text-white' },
  past: { label: '끝난 모임', className: 'bg-gray-400 text-white' },
}

/** <input type="datetime-local"> 값 ('YYYY-MM-DDTHH:mm', 로컬 시간) */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
