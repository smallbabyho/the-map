'use client'

import { useMemo, useState } from 'react'

// 이모지 고르기 (핀 아이콘 · 다이어리 스티커): 분류 탭 + 한글 검색 + 최근 쓴 것 + 직접 넣기(이모지 키보드).
// 한 줄 = '이모지 검색어 검색어 …'. 검색은 분류 이름과 검색어에 맞춰 본다.

const GROUPS: { name: string; items: string }[] = [
  {
    name: '장소·여행',
    items: `📍 핀 위치 장소|🗺️ 지도|🧭 나침반 길|🚩 깃발 출발|🏁 도착 끝|🏠 집|🏡 집 마당|🏢 건물 회사|🏬 백화점 쇼핑|🏪 편의점|🏨 호텔 숙소|🏩 숙소|🏫 학교|🏛️ 박물관 궁 역사|⛪ 성당 교회|🕌 사원|⛩️ 신사 일본|🏯 성 궁|🏰 성|🗼 타워|🗽 자유의여신상|🎡 관람차 놀이공원|🎢 롤러코스터 놀이공원|🎠 회전목마|⛲ 분수 공원|⛺ 캠핑 텐트|🏕️ 캠핑|🏖️ 해변 바다|🏝️ 섬 휴양|🏔️ 산 설산|⛰️ 산 등산|🌋 화산 제주|🗻 후지산|🏙️ 도시 야경|🌃 밤 야경|🌉 다리 야경|🌁 안개|🚉 역 기차역|🚇 지하철|🚌 버스|🚕 택시|🚗 자동차 드라이브|🚲 자전거|🛴 킥보드|🚄 KTX 기차|✈️ 비행기 공항|🚢 배 크루즈|⛴️ 페리 배|🛳️ 여객선|🚠 케이블카|🎫 티켓 입장권|🧳 캐리어 여행|🛂 여권 출국`,
  },
  {
    name: '음식',
    items: `🍜 라면 국수 맛집|🍲 찌개 전골|🍛 카레|🍚 밥 한식|🍙 주먹밥 김밥|🍱 도시락|🍣 초밥 스시|🍤 튀김 새우|🥟 만두|🥘 빠에야 냄비|🍝 파스타|🍕 피자|🍔 햄버거|🌭 핫도그|🌮 타코|🌯 부리또|🥗 샐러드|🥪 샌드위치|🍗 치킨 닭|🍖 고기|🥩 스테이크 소고기|🥓 베이컨|🍳 계란 브런치|🥞 팬케이크|🧇 와플|🍟 감자튀김|🌶️ 매운 떡볶이 고추|🧀 치즈|🥐 크루아상 빵|🍞 식빵 빵|🥖 바게트 빵|🥯 베이글|🥨 프레첼|🍢 어묵 꼬치|🍡 경단 떡|🦪 굴 해산물|🦀 게 해산물|🦞 랍스터|🐙 문어|🍺 맥주 술집|🍻 건배 맥주|🍷 와인|🍶 사케 소주|🥂 샴페인 축하|🍸 칵테일 바|🥃 위스키`,
  },
  {
    name: '카페·디저트',
    items: `☕ 커피 카페|🍵 녹차 차|🧋 버블티 밀크티|🥤 음료 주스|🧃 주스|🥛 우유 라떼|🍰 케이크 조각|🎂 생일 케이크|🧁 컵케이크|🍮 푸딩|🍩 도넛|🍪 쿠키|🍫 초콜릿|🍬 사탕|🍭 막대사탕|🍦 아이스크림 소프트|🍨 아이스크림|🍧 빙수|🥧 파이|🍯 꿀|🍓 딸기|🍑 복숭아|🍒 체리|🍋 레몬|🍊 귤|🍎 사과|🍇 포도|🍉 수박|🍌 바나나|🥝 키위|🍍 파인애플|🥭 망고`,
  },
  {
    name: '자연·날씨',
    items: `🌳 나무 공원|🌲 소나무 숲|🌴 야자수 휴양|🌵 선인장|🌿 풀 식물|🍀 클로버 행운|🍁 단풍 가을|🍂 낙엽 가을|🌸 벚꽃 봄|🌷 튤립 꽃|🌹 장미 꽃|🌻 해바라기|🌼 꽃|💐 꽃다발|🌾 억새 들판|🍄 버섯|🌊 바다 파도|💧 물방울|☀️ 해 맑음|🌤️ 구름 조금|⛅ 흐림|🌧️ 비|⛈️ 천둥|🌈 무지개|❄️ 눈 겨울|☃️ 눈사람|🌙 달 밤|⭐ 별|🌟 반짝 별|🌅 일출 해돋이|🌄 산 일출|🌇 노을 일몰|🔥 불 캠프파이어`,
  },
  {
    name: '동물',
    items: `🐶 강아지 개|🐱 고양이|🐰 토끼|🐻 곰|🐼 판다|🐨 코알라|🦊 여우|🐯 호랑이|🦁 사자|🐮 소|🐷 돼지|🐸 개구리|🐵 원숭이|🐥 병아리|🐧 펭귄|🦆 오리|🦉 부엉이|🐴 말|🦄 유니콘|🐝 벌|🦋 나비|🐞 무당벌레|🐢 거북이|🐬 돌고래|🐳 고래|🐠 물고기 아쿠아리움|🦭 물범|🐾 발자국 반려`,
  },
  {
    name: '활동·취미',
    items: `📸 사진 카메라 포토|📷 카메라|🎬 영화 촬영지|🎥 영상|🎞️ 필름|🎤 노래 노래방|🎧 음악 헤드폰|🎵 음악|🎸 기타 공연|🎹 피아노|🎨 그림 미술 전시|🖼️ 액자 전시|🎭 연극 공연|🎪 서커스 축제|🎟️ 티켓 공연|🎮 게임|🎳 볼링|🎯 다트|🧩 퍼즐 방탈출|⚽ 축구|⚾ 야구|🏀 농구|🎾 테니스|🏓 탁구|⛳ 골프|🏊 수영|🏄 서핑|🚴 자전거 라이딩|🥾 등산 하이킹|🧗 클라이밍|⛸️ 스케이트|🎿 스키|🛍️ 쇼핑|📚 책 책방 도서관|✍️ 글쓰기 기록|🧘 요가 힐링|💆 마사지 스파|♨️ 온천 찜질`,
  },
  {
    name: '사물',
    items: `🎁 선물|🎈 풍선|🎉 축하 파티|🎊 축하|🎀 리본|🏷️ 태그|📌 압정 고정|📎 클립|✏️ 연필|🖍️ 크레용|📒 노트 다이어리|📖 책 펼침|💌 편지 러브레터|✉️ 편지|📮 우체통|🔑 열쇠|🛏️ 침대 숙소|🪑 의자|🕯️ 초 분위기|💡 전구 아이디어|🔭 망원경 전망대|⌚ 시계|⏰ 알람|📱 휴대폰|💻 노트북|🎒 가방|👜 핸드백|👟 운동화|👒 모자|🕶️ 선글라스|☂️ 우산 비|💰 돈|💳 카드 결제`,
  },
  {
    name: '표정',
    items: `😀 웃음 행복|😄 신남|😆 깔깔|😊 미소|🥰 사랑 행복|😍 반함 하트눈|😘 뽀뽀|😋 맛있음 냠냠|😎 멋짐 선글라스|🤩 감탄 별눈|🥳 축하 파티|😴 졸림 잠|😪 피곤|🤤 침 맛있는|😮 놀람|😭 감동 울음|🥹 감동|😤 뿌듯|🤔 고민|🙃 장난|😇 천사|🤗 포옹|👍 좋아 최고|👏 박수|🙌 만세|✌️ 브이|🤞 행운 기도|👋 안녕|🙏 감사 부탁|💪 힘 파이팅`,
  },
  {
    name: '하트·기호',
    items: `❤️ 하트 빨강|🧡 하트 주황|💛 하트 노랑|💚 하트 초록|💙 하트 파랑|💜 하트 보라|🤍 하트 하양|🖤 하트 검정|💖 반짝 하트|💕 하트 두개|💘 화살 하트|✨ 반짝|💫 반짝 어지러움|💥 쾅|💯 백점 최고|❗ 느낌표 중요|❓ 물음표|✔️ 체크 완료|✅ 체크 완료|⭕ 동그라미 정답|❌ 엑스|🆕 새로운|🔥 불 핫플|⚡ 번개|💤 잠|🎶 음표|♻️ 재활용|🚫 금지|⚠️ 주의`,
  },
]

const ALL = GROUPS.map((g) => ({
  name: g.name,
  items: g.items.split('|').map((line) => {
    const [emoji, ...words] = line.trim().split(' ')
    return { emoji, words: words.join(' ') }
  }),
}))

const RECENT_KEY = 'the-map:recent-emojis'
const RECENT_MAX = 16
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}
function pushRecent(e: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...readRecent().filter((x) => x !== e)].slice(0, RECENT_MAX)))
  } catch {
    // 못 남겨도 고르기는 된다
  }
}

/** 글에서 첫 이모지 하나 (없으면 null) — 직접 넣기용 */
function firstEmoji(text: string): string | null {
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment) : [...text]
  return seg.find((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g)) ?? null
}

interface Props {
  value?: string
  onPick: (emoji: string) => void
  /** 한 줄 칸 수 */
  cols?: number
}

/**
 * @example
 * <EmojiPicker value={pin.icon} onPick={(e) => onChange({ icon: e })} />
 */
export function EmojiPicker({ value, onPick, cols = 8 }: Props) {
  const [recent, setRecent] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readRecent()))
  const [group, setGroup] = useState(recent.length ? -1 : 0) // -1 = 자주 쓴 것
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState('')

  const pick = (e: string) => {
    pushRecent(e)
    setRecent(readRecent())
    onPick(e)
  }

  const shown = useMemo(() => {
    const k = q.trim()
    if (k) return ALL.flatMap((g) => g.items.filter((it) => it.words.includes(k) || g.name.includes(k)).map((it) => it.emoji))
    if (group === -1) return recent
    return ALL[group].items.map((it) => it.emoji)
  }, [q, group, recent])

  const tab = (on: boolean) => `shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-(--c-text) text-(--c-surface)' : 'bg-black/5 text-(--c-muted)'}`

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="찾기 (예: 커피, 바다, 고양이)"
        className="h-9 w-full rounded-xl border border-(--c-border) bg-transparent px-3 text-sm outline-none focus:border-(--c-accent)"
        aria-label="이모지 찾기"
      />
      {!q.trim() && (
        <div className="tm-scroll flex gap-1 overflow-x-auto" role="tablist" aria-label="이모지 분류">
          {recent.length > 0 && (
            <button type="button" role="tab" aria-selected={group === -1} onClick={() => setGroup(-1)} className={tab(group === -1)}>
              🕘 자주 쓴 것
            </button>
          )}
          {ALL.map((g, i) => (
            <button key={g.name} type="button" role="tab" aria-selected={group === i} onClick={() => setGroup(i)} className={tab(group === i)}>
              {g.name}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="py-4 text-center text-xs text-(--c-muted)">맞는 이모지가 없어요. 아래 ‘직접 넣기’로 넣어 보세요.</p>
      ) : (
        <div className="tm-scroll grid max-h-52 gap-1 overflow-y-auto" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {shown.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pick(e)}
              className={`grid aspect-square place-items-center rounded-lg text-xl transition hover:scale-110 ${value === e ? 'bg-(--c-accent)/15 ring-2 ring-(--c-accent)' : 'hover:bg-black/5'}`}
              aria-label={`${e} 고르기`}
              aria-pressed={value === e}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      {/* 직접 넣기: 휴대폰 이모지 키보드 · 맥 Ctrl+Cmd+Space · 윈도우 Win+. */}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(ev) => {
          ev.preventDefault()
          const e = firstEmoji(custom)
          if (e) pick(e)
          setCustom('')
        }}
      >
        <input
          value={custom}
          onChange={(ev) => setCustom(ev.target.value)}
          placeholder="직접 넣기: 이모지 키보드로 아무거나"
          className="h-9 min-w-0 flex-1 rounded-xl border border-(--c-border) bg-transparent px-3 text-sm outline-none focus:border-(--c-accent)"
          aria-label="이모지 직접 넣기"
        />
        <button type="submit" disabled={!firstEmoji(custom)} className="h-9 shrink-0 rounded-xl bg-(--c-text) px-3 text-xs font-bold text-(--c-surface) disabled:opacity-40">
          넣기
        </button>
      </form>
    </div>
  )
}
