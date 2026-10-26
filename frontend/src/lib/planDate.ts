// 지도 일정(가는 날, 'YYYY-MM-DD') 보여 주기. 날짜만 있어서 이 기기 시간대의 그날 자정으로 본다.

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** '11월 2일 (일)' */
export function formatPlanDate(ymd: string) {
  const d = toDate(ymd)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`
}

/** 오늘부터 며칠 남았는지 (지났으면 음수) */
export function daysUntil(ymd: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((toDate(ymd).getTime() - today.getTime()) / 864e5)
}

/** 'D-3' / '오늘' / '내일' / '다녀옴' */
export function planDday(ymd: string) {
  const days = daysUntil(ymd)
  return days < 0 ? '다녀옴' : days === 0 ? '오늘' : days === 1 ? '내일' : `D-${days}`
}
