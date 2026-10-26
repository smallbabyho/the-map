'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { onAuthChange, signIn, signOut, signUp, useCurrentUser } from '../auth'
import { ChevronLeftIcon, CopyIcon } from '../components/icons'
import * as api from '../db/api'

// 데이터·로그인 함수를 화면에서 직접 호출해 보는 개발용 콘솔.
// 지금은 mock(localStorage)을 부르고, src/db/api.ts · src/auth/index.ts 가 Supabase 로 바뀌면 그대로 진짜 백엔드를 테스트한다.

type ParamType = 'string' | 'number' | 'json' | 'file'
interface Param {
  name: string
  type: ParamType
  placeholder?: string
  initial?: string
  optional?: boolean
}
interface Endpoint {
  group: string
  name: string
  desc: string
  params: Param[]
  /** 'login' 로그인 필요 · 'admin' 관리자만 */
  auth?: 'login' | 'admin'
  method: 'GET' | 'POST' | 'DELETE'
  run: (a: Record<string, unknown>) => Promise<unknown>
}

const s = (v: unknown) => String(v ?? '')
const ID = (name: string, placeholder = '아래 참고 ID 를 눌러 채우기'): Param => ({ name, type: 'string', placeholder })

const ENDPOINTS: Endpoint[] = [
  // 로그인
  { group: '로그인', name: 'getCurrentUser', method: 'GET', desc: '로그인한 사용자 { id, nickname, role } 또는 null', params: [], run: () => api.getCurrentUser() },
  {
    group: '로그인', name: 'signIn', method: 'POST', desc: '로그인 (캡차 토큰 필요, mock 은 아무 문자열)',
    params: [{ name: 'email', type: 'string', initial: 'test@example.com' }, { name: 'password', type: 'string', initial: 'test1234' }, { name: 'captchaToken', type: 'string', initial: 'mock-captcha-token' }],
    run: (a) => signIn(s(a.email), s(a.password), s(a.captchaToken)),
  },
  {
    group: '로그인', name: 'signUp', method: 'POST', desc: '회원가입 → 바로 로그인',
    params: [{ name: 'email', type: 'string', placeholder: 'new@example.com' }, { name: 'password', type: 'string', initial: 'secret12' }, { name: 'nickname', type: 'string', initial: '테스트계정' }, { name: 'captchaToken', type: 'string', initial: 'mock-captcha-token' }],
    run: (a) => signUp(s(a.email), s(a.password), s(a.nickname), s(a.captchaToken)),
  },
  { group: '로그인', name: 'signOut', method: 'POST', desc: '로그아웃', params: [], run: () => signOut() },

  // 지도
  { group: '지도', name: 'getMyMaps', method: 'GET', auth: 'login', desc: '내 지도 목록 (최근 수정 순)', params: [], run: () => api.getMyMaps() },
  { group: '지도', name: 'getMap', method: 'GET', desc: '지도 1개 + 핀 + 이동구간 (없거나 권한 없으면 null)', params: [ID('mapId')], run: (a) => api.getMap(s(a.mapId)) },
  {
    group: '지도', name: 'saveMap', method: 'POST', auth: 'login', desc: '지도 생성(id 없음) / 수정(id 있음)',
    params: [{ name: 'mapData', type: 'json', initial: JSON.stringify({ title: 'API 로 만든 지도', theme: 'pastel', isPublic: false }, null, 2) }],
    run: (a) => api.saveMap(a.mapData as Parameters<typeof api.saveMap>[0]),
  },
  { group: '지도', name: 'deleteMap', method: 'DELETE', auth: 'login', desc: '지도 삭제 (핀·구간 함께)', params: [ID('mapId')], run: (a) => api.deleteMap(s(a.mapId)) },
  { group: '지도', name: 'copyMap', method: 'POST', auth: 'login', desc: '공개 지도를 내 지도로 가져오기 (순위 반영)', params: [ID('mapId')], run: (a) => api.copyMap(s(a.mapId)) },
  { group: '지도', name: 'getUser', method: 'GET', desc: '사용자 { id, nickname }', params: [ID('userId', '예: u-bread')], run: (a) => api.getUser(s(a.userId)) },

  // 핀 · 구간
  {
    group: '핀·구간', name: 'savePin', method: 'POST', auth: 'login', desc: '핀 생성/수정. place 는 externalId 로 찾고 없으면 생성',
    params: [
      ID('mapId'),
      { name: 'pinData', type: 'json', initial: JSON.stringify({ place: { externalId: 'sample-2', name: '서울숲', lat: 37.5444, lng: 127.0374 }, order: 0, icon: '🌳', color: '#22c55e', memo: '', photoUrl: null, visitedAt: null }, null, 2) },
    ],
    run: (a) => api.savePin(s(a.mapId), a.pinData as Parameters<typeof api.savePin>[1]),
  },
  { group: '핀·구간', name: 'deletePin', method: 'DELETE', auth: 'login', desc: '핀 삭제 (연결된 구간 함께)', params: [ID('pinId')], run: (a) => api.deletePin(s(a.pinId)) },
  {
    group: '핀·구간', name: 'saveLeg', method: 'POST', auth: 'login', desc: '이동구간 생성/수정 (같은 from→to 면 덮어씀)',
    params: [ID('mapId'), { name: 'legData', type: 'json', initial: JSON.stringify({ fromPinId: '', toPinId: '', mode: 'transit', durationMin: 15, isManual: true }, null, 2) }],
    run: (a) => api.saveLeg(s(a.mapId), a.legData as Parameters<typeof api.saveLeg>[1]),
  },
  { group: '핀·구간', name: 'deleteLeg', method: 'DELETE', auth: 'login', desc: '이동구간 삭제', params: [ID('legId')], run: (a) => api.deleteLeg(s(a.legId)) },
  { group: '핀·구간', name: 'uploadPinPhoto', method: 'POST', desc: '사진 업로드 → URL (mock 은 data URL)', params: [{ name: 'file', type: 'file' }], run: (a) => api.uploadPinPhoto(a.file as File) },

  // 성지순례
  { group: '성지순례', name: 'getMeetups', method: 'GET', desc: "모임 목록. filter: 'all' | 'joined' | 'hosting'", params: [{ name: 'filter', type: 'string', initial: 'all' }], run: (a) => api.getMeetups((s(a.filter) || 'all') as 'all') },
  { group: '성지순례', name: 'getMeetup', method: 'GET', desc: '모임 1개 + 순례 지도', params: [ID('meetupId')], run: (a) => api.getMeetup(s(a.meetupId)) },
  {
    group: '성지순례', name: 'saveMeetup', method: 'POST', auth: 'login', desc: '모임 만들기/고치기 (주최자 자동 참여)',
    params: [{ name: 'input', type: 'json', initial: JSON.stringify({ mapId: '', title: 'API 테스트 모임', description: '', meetAt: '2030-01-01T11:00', meetPoint: '성수역 3번 출구', capacity: 4 }, null, 2) }],
    run: (a) => api.saveMeetup(a.input as Parameters<typeof api.saveMeetup>[0]),
  },
  { group: '성지순례', name: 'joinMeetup', method: 'POST', auth: 'login', desc: '모임 참여', params: [ID('meetupId')], run: (a) => api.joinMeetup(s(a.meetupId)) },
  { group: '성지순례', name: 'leaveMeetup', method: 'POST', auth: 'login', desc: '참여 취소 (주최자는 불가)', params: [ID('meetupId')], run: (a) => api.leaveMeetup(s(a.meetupId)) },
  {
    group: '성지순례', name: 'setMeetupStatus', method: 'POST', auth: 'login', desc: "모집 상태 (주최자): 'open' | 'closed' | 'canceled'",
    params: [ID('meetupId'), { name: 'status', type: 'string', initial: 'closed' }],
    run: (a) => api.setMeetupStatus(s(a.meetupId), s(a.status) as 'closed'),
  },

  // 순위
  {
    group: '순위', name: 'getMonthlyRanking', method: 'GET', desc: "월간 지도 순위. month: 'YYYY-MM' (비우면 이번 달)",
    params: [{ name: 'month', type: 'string', placeholder: '예: 2026-10', optional: true }, { name: 'limit', type: 'number', initial: '30' }],
    run: (a) => api.getMonthlyRanking(s(a.month) || undefined, Number(a.limit) || 30),
  },

  // 관리자
  { group: '관리자', name: 'adminGetStats', method: 'GET', auth: 'admin', desc: '서비스 현황 숫자', params: [], run: () => api.adminGetStats() },
  { group: '관리자', name: 'adminListUsers', method: 'GET', auth: 'admin', desc: '회원 목록 + 활동 수', params: [], run: () => api.adminListUsers() },
  {
    group: '관리자', name: 'adminUpdateUser', method: 'POST', auth: 'admin', desc: '닉네임 · role · suspended 수정',
    params: [ID('userId', '예: u-bread'), { name: 'patch', type: 'json', initial: JSON.stringify({ suspended: true }, null, 2) }],
    run: (a) => api.adminUpdateUser(s(a.userId), a.patch as Parameters<typeof api.adminUpdateUser>[1]),
  },
  { group: '관리자', name: 'adminDeleteUser', method: 'DELETE', auth: 'admin', desc: '회원 탈퇴 처리 (지도·모임 함께 삭제)', params: [ID('userId')], run: (a) => api.adminDeleteUser(s(a.userId)) },
]

interface CallLog {
  id: number
  name: string
  ok: boolean
  ms: number
  at: string
  result: string
}

/** data URL 같은 긴 문자열은 줄여서 보여준다 */
function pretty(value: unknown) {
  if (value === undefined) return '(반환값 없음 · 성공)'
  return JSON.stringify(value, (_k, v) => (typeof v === 'string' && v.length > 200 ? `${v.slice(0, 80)}… (${v.length}자)` : v), 2)
}

// 시간 측정 (이벤트 핸들러에서만 부른다)
const clock = () => performance.now()
const stamp = () => Date.now()

const METHOD_COLOR = { GET: 'bg-emerald-500/15 text-emerald-700', POST: 'bg-blue-500/15 text-blue-700', DELETE: 'bg-red-500/15 text-red-700' }

export function ApiTestPage() {
  const me = useCurrentUser()
  const [selected, setSelected] = useState(ENDPOINTS[0].name)
  const ep = ENDPOINTS.find((e) => e.name === selected)!
  const [values, setValues] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [last, setLast] = useState<CallLog | null>(null)
  const [history, setHistory] = useState<CallLog[]>([])
  const [refs, setRefs] = useState<{ label: string; id: string; kind: string }[]>([])
  const [copied, setCopied] = useState(false)

  const groups = useMemo(() => [...new Set(ENDPOINTS.map((e) => e.group))], [])

  // 함수를 바꾸면 기본값으로 채우기
  const pick = (name: string) => {
    const next = ENDPOINTS.find((e) => e.name === name)!
    setSelected(name)
    setValues(Object.fromEntries(next.params.map((p) => [p.name, p.initial ?? ''])))
    setFile(null)
    setLast(null)
  }

  // 참고 ID (내 지도 · 공개 지도 · 모임 · 회원)
  useEffect(() => {
    const load = async () => {
      const out: { label: string; id: string; kind: string }[] = []
      try {
        const mine = await api.getMyMaps()
        mine.slice(0, 4).forEach((m) => out.push({ kind: 'mapId', label: `내 지도 · ${m.title || '제목 없음'}`, id: m.id }))
      } catch {
        // 로그인 안 함
      }
      const rank = await api.getMonthlyRanking(undefined, 4)
      rank.forEach((r) => out.push({ kind: 'mapId', label: `공개 지도 · ${r.map.title}`, id: r.map.id }))
      const meetups = await api.getMeetups('all')
      meetups.slice(0, 4).forEach((m) => out.push({ kind: 'meetupId', label: `모임 · ${m.title}`, id: m.id }))
      ;['u-bread', 'u-drama', 'u-cafe', 'mock-user'].forEach((id) => out.push({ kind: 'userId', label: `회원 · ${id}`, id }))
      setRefs(out)
    }
    load()
    return onAuthChange(() => load())
  }, [history.length])

  const fillRef = (id: string, kind: string) => {
    const target = ep.params.find((p) => p.name === kind) ?? ep.params.find((p) => p.type === 'string' && !(values[p.name] ?? p.initial))
    if (target) {
      setValues((v) => ({ ...v, [target.name]: id }))
      return
    }
    // JSON 안의 같은 이름 필드에 넣기 (예: saveMeetup 의 mapId)
    const json = ep.params.find((p) => p.type === 'json')
    if (!json) return
    try {
      const obj = JSON.parse(values[json.name] ?? json.initial ?? '{}')
      if (kind in obj) {
        obj[kind] = id
        setValues((v) => ({ ...v, [json.name]: JSON.stringify(obj, null, 2) }))
      }
    } catch {
      // JSON 이 깨져 있으면 무시
    }
  }

  const run = async () => {
    setRunning(true)
    const t0 = clock()
    let ok = true
    let result: string
    try {
      const args: Record<string, unknown> = {}
      for (const p of ep.params) {
        const raw = values[p.name] ?? p.initial ?? ''
        if (p.type === 'json') {
          try {
            args[p.name] = JSON.parse(raw || '{}')
          } catch {
            throw new Error(`${p.name}: JSON 형식이 올바르지 않아요.`)
          }
        } else if (p.type === 'file') {
          if (!file) throw new Error('파일을 골라 주세요.')
          args[p.name] = file
        } else if (p.type === 'number') {
          args[p.name] = Number(raw)
        } else {
          if (!raw && !p.optional && p.name !== 'filter') throw new Error(`${p.name} 을(를) 입력해 주세요.`)
          args[p.name] = raw
        }
      }
      result = pretty(await ep.run(args))
    } catch (e) {
      ok = false
      result = e instanceof Error ? e.message : String(e)
    }
    const log: CallLog = { id: stamp(), name: ep.name, ok, ms: Math.round(clock() - t0), at: new Date().toLocaleTimeString('ko-KR'), result }
    setLast(log)
    setHistory((h) => [log, ...h].slice(0, 15))
    setRunning(false)
  }

  const resetData = () => {
    if (!window.confirm('브라우저에 저장된 mock 데이터(지도·모임·회원)를 모두 지우고 처음 상태로 돌릴까요?')) return
    try {
      localStorage.removeItem('the-map:mock-db:v1')
      localStorage.removeItem('the-map:mock-auth:v1')
    } catch {
      // 무시
    }
    window.location.reload()
  }

  const signature = `${ep.name}(${ep.params.map((p) => p.name + (p.optional ? '?' : '')).join(', ')})`

  return (
    <div className="min-h-dvh bg-[#0b1020] text-gray-100">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0b1020]/95 px-4 py-3 backdrop-blur md:px-6">
        <Link href="/" className="flex items-center gap-0.5 text-sm text-gray-400 hover:text-white">
          <ChevronLeftIcon size={16} />
          My Concept Map
        </Link>
        <h1 className="text-base font-bold">API 테스트</h1>
        <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300">연결: MOCK (브라우저 localStorage)</span>
        <span className="ml-auto text-xs text-gray-400">
          {me === undefined ? '…' : me ? (
            <>
              로그인: <b className="text-gray-100">{me.nickname}</b> ({me.role === 'admin' ? 'admin' : 'user'})
            </>
          ) : (
            '로그인 안 함'
          )}
        </span>
        <button type="button" onClick={resetData} className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-400/10">
          데이터 초기화
        </button>
      </header>

      <div className="grid md:grid-cols-[260px_1fr]">
        {/* 함수 목록 */}
        <nav className="border-b border-white/10 p-3 md:sticky md:top-[53px] md:h-[calc(100dvh-53px)] md:overflow-y-auto md:border-b-0 md:border-r">
          <select value={selected} onChange={(e) => pick(e.target.value)} className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm md:hidden" aria-label="함수 선택">
            {ENDPOINTS.map((e) => (
              <option key={e.name} value={e.name} className="text-black">
                {e.group} · {e.name}
              </option>
            ))}
          </select>
          <div className="hidden md:block">
            {groups.map((g) => (
              <div key={g} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{g}</p>
                {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                  <button
                    key={e.name}
                    type="button"
                    onClick={() => pick(e.name)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-[13px] ${selected === e.name ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    <span className={`w-12 shrink-0 rounded px-1 text-center text-[10px] font-bold ${METHOD_COLOR[e.method]}`}>{e.method}</span>
                    <span className="truncate">{e.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <main className="min-w-0 p-4 md:p-6">
          {/* 호출 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${METHOD_COLOR[ep.method]}`}>{ep.method}</span>
              <code className="font-mono text-[15px] font-semibold text-white">{signature}</code>
              {ep.auth && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ep.auth === 'admin' ? 'bg-indigo-400/15 text-indigo-300' : 'bg-white/10 text-gray-300'}`}>
                  {ep.auth === 'admin' ? '관리자 전용' : '로그인 필요'}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-400">{ep.desc}</p>

            <div className="mt-4 space-y-3">
              {ep.params.length === 0 && <p className="text-sm text-gray-500">입력값 없음</p>}
              {ep.params.map((p) => (
                <label key={p.name} className="block">
                  <span className="mb-1 block font-mono text-xs text-gray-400">
                    {p.name}
                    <span className="text-gray-600">: {p.type}{p.optional && ' (선택)'}</span>
                  </span>
                  {p.type === 'json' ? (
                    <textarea
                      value={values[p.name] ?? p.initial ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                      rows={Math.min(12, (values[p.name] ?? p.initial ?? '').split('\n').length + 1)}
                      spellCheck={false}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-amber-300/60"
                    />
                  ) : p.type === 'file' ? (
                    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-gray-100" />
                  ) : (
                    <input
                      value={values[p.name] ?? p.initial ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                      placeholder={p.placeholder}
                      inputMode={p.type === 'number' ? 'numeric' : undefined}
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-[13px] outline-none placeholder:text-gray-600 focus:border-amber-300/60"
                    />
                  )}
                </label>
              ))}
            </div>

            <button type="button" onClick={run} disabled={running} className="mt-4 h-10 rounded-lg bg-amber-400 px-5 text-sm font-bold text-gray-900 transition hover:bg-amber-300 disabled:opacity-60">
              {running ? '실행 중…' : '▶ 실행'}
            </button>
          </section>

          {/* 참고 ID */}
          {refs.length > 0 && (
            <section className="mt-4">
              <p className="mb-2 text-xs font-semibold text-gray-500">참고 ID · 누르면 입력칸에 채워져요</p>
              <div className="flex flex-wrap gap-1.5">
                {refs.map((r) => (
                  <button key={r.kind + r.id} type="button" onClick={() => fillRef(r.id, r.kind)} className="max-w-[260px] truncate rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:border-amber-300/60 hover:text-white" title={r.id}>
                    {r.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 결과 */}
          {last && (
            <section className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${last.ok ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <b className={last.ok ? 'text-emerald-300' : 'text-red-300'}>{last.ok ? '성공' : '에러'}</b>
                <span className="text-gray-400">{last.ms}ms</span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(last.result).catch(() => {})
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                >
                  <CopyIcon size={13} />
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <pre className="max-h-[50vh] overflow-auto bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed text-gray-200" data-testid="api-result">
                {last.result}
              </pre>
            </section>
          )}

          {/* 기록 */}
          {history.length > 0 && (
            <section className="mt-6">
              <p className="mb-2 text-xs font-semibold text-gray-500">최근 호출</p>
              <ul className="divide-y divide-white/5 rounded-xl border border-white/10 text-[13px]">
                {history.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => setLast(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5">
                      <span className={`size-2 rounded-full ${h.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="font-mono">{h.name}</span>
                      <span className="truncate text-gray-500">{h.ok ? '' : h.result}</span>
                      <span className="ml-auto shrink-0 text-gray-500">
                        {h.ms}ms · {h.at}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
