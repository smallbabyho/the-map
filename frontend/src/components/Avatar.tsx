const COLORS = ['#f97316', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#eab308']

function colorOf(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/** 닉네임 첫 글자로 만든 동그란 프로필 */
export function Avatar({ id, nickname, size = 32, ring = false }: { id: string; nickname: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${ring ? 'ring-2 ring-(--c-surface)' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: colorOf(id) }}
      title={nickname}
      aria-label={nickname}
    >
      {nickname.trim().charAt(0) || '?'}
    </span>
  )
}
