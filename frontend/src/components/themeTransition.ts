// 라이트 · 다크 · 색 테마를 바꿀 때 화면 전체가 이전 색에서 새 색으로 천천히 겹쳐 바뀌게 (View Transitions).
// 브라우저가 지원하지 않거나 '동작 줄이기' 설정이면 그냥 바로 바뀐다. 속도는 app/globals.css 의 ::view-transition-*(root).

export function withThemeTransition(change: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduce) return change()
  doc.startViewTransition(change)
}
