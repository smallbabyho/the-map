// My Concept Map 서비스 워커 (홈 화면 앱 · PWA)
// - 페이지: 항상 인터넷에서 먼저 받는다. 끊겼을 때만 오프라인 안내(/offline.html)
// - /_next/static (빌드마다 이름이 바뀌는 파일) · 아이콘: 한 번 받으면 저장해 두고 바로 쓴다
// - 데이터(API · Supabase · 지도)는 건드리지 않는다 (예전 데이터가 보이면 안 되니까)
const VERSION = 'v1'
const STATIC = `static-${VERSION}`
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
    return
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
