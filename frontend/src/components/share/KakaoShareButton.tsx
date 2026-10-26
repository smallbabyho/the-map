'use client'

import { useState } from 'react'
import type { ThemeId } from '../../types'
import { encodeCourse, type LatLng } from './course'
import { hasKakaoShare, shareToKakao } from './kakaoShare'

interface Props {
  title: string
  description: string
  /** 공유할 페이지 경로 ('/meetups/123') */
  path: string
  theme: ThemeId
  /** 썸네일에 그릴 코스 (핀 순서대로) */
  course: LatLng[]
  buttonTitle: string
  className?: string
  onError?: (msg: string) => void
}

/** 카카오 공유 카드 썸네일 주소 (/api/og/map) */
export function shareImageUrl(origin: string, title: string, sub: string, theme: ThemeId, course: LatLng[]) {
  const q = new URLSearchParams({ t: title, s: sub, th: theme, p: encodeCourse(course) })
  return `${origin}/api/og/map?${q}`
}

/**
 * 카카오톡으로 공유하기 버튼. 카드에 실제 코스 모양 썸네일이 붙는다.
 * 카카오 키가 없거나 SDK 를 못 불러오면 휴대폰 공유 창 → 그것도 없으면 링크 복사로 대신한다.
 */
export function KakaoShareButton({ title, description, path, theme, course, buttonTitle, className = '', onError }: Props) {
  const [note, setNote] = useState('')

  const share = async () => {
    const url = `${window.location.origin}${path}`
    try {
      if (!hasKakaoShare) throw new Error('no key')
      await shareToKakao({ title, description, url, buttonTitle, imageUrl: shareImageUrl(window.location.origin, title, description, theme, course) })
    } catch {
      try {
        if (navigator.share) return await navigator.share({ title, text: description, url })
        await navigator.clipboard.writeText(url)
        setNote('카카오톡을 열 수 없어서 링크를 복사했어요')
        setTimeout(() => setNote(''), 2200)
      } catch (e) {
        // 공유 창을 사용자가 닫은 경우(AbortError)는 조용히 넘어간다
        if (e instanceof Error && e.name !== 'AbortError') onError?.('공유하지 못했어요. 주소창의 주소를 복사해 주세요.')
      }
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#FEE500] text-sm font-bold text-[#191919] transition hover:brightness-95 ${className}`}
    >
      <KakaoBubble />
      {note || '카카오톡으로 공유'}
    </button>
  )
}

/** 카카오톡 말풍선 모양 */
function KakaoBubble() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.32 4.66 6.74l-.95 3.48c-.08.3.26.54.52.37l4.15-2.75c.53.07 1.07.11 1.62.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  )
}
