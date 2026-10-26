// 리뷰 후기 금지어. DB(backend/supabase/migrations/20261026001200_review_moderation.sql 의 has_banned_word)와 같은 목록으로 유지한다.
// 화면에서 먼저 알려주려는 용도이고, 실제로 막는 건 DB 다.
// 흔한 낱말과 겹치는 말(새끼 고양이, 시바견, 걸레 등)은 일부러 뺐다.

const BANNED = [
  '시발', '씨발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', '개새끼', '개새', '미친놈', '미친년',
  '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '엿먹', '썅', '염병', '등신', '창녀', '니애미', '느금마', '애미뒤', '애비뒤',
  'fuck', 'shit', 'bitch',
]

/** 띄어쓰기 · 기호를 빼고 금지어가 들어 있는지 */
export function hasBannedWord(text: string): boolean {
  const plain = text.toLowerCase().replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/g, '')
  return BANNED.some((w) => plain.includes(w))
}

export const BANNED_WORD_MESSAGE = '후기에 쓸 수 없는 말이 들어 있어요. 바르고 고운 말로 써 주세요.'
