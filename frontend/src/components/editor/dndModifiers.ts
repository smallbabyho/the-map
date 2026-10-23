import type { Modifier } from '@dnd-kit/core'

/** 세로로만 끌리게 (@dnd-kit/modifiers 패키지를 따로 깔지 않으려고 직접 작성) */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })
