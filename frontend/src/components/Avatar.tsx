const COLORS = ['#f97316', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#eab308']

function colorOf(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/** 동그란 프로필: 사진(src)이 있으면 사진, 없으면 닉네임 첫 글자 */
export function Avatar({ id, nickname, src, size = 32, ring = false }: { id: string; nickname: string; src?: string | null; size?: number; ring?: boolean }) {
  const ringClass = ring ? 'ring-2 ring-(--c-surface)' : ''
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL · 스토리지 URL 이라 next/image 최적화 대상이 아님
      <img src={src} alt={nickname} title={nickname} width={size} height={size} className={`inline-block shrink-0 rounded-full object-cover ${ringClass}`} style={{ width: size, height: size }} />
    )
  }
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${ringClass}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: colorOf(id) }}
      title={nickname}
      aria-label={nickname}
    >
      {nickname.trim().charAt(0) || '?'}
    </span>
  )
}
