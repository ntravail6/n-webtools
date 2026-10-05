// Your Travels — オフラインでも開けるようにする仕組み（Service Worker）
//   ・初めて開いたときに、アプリのファイルを端末に取っておく
//   ・次からは、取っておいたものをすぐ出す（電波がなくても開ける）
//   ・新しい版を出したら、下の CACHE_NAME の数字を1つ増やす
const CACHE_NAME = 'yourtravels-v37';

// 取っておくファイル
const FILES = [
  './',
  './index.html',
  './dest-data.js',
  './japan-map.js',
  './japan-rail-geo.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png'
];

// ① 入れておく
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // 1つ取れなくても止まらないようにする
      .then(cache => Promise.all(FILES.map(f => cache.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ② 古い版の取り置きを片づける
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ③ 取りに行く
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 天気や為替など、外の通信はそのまま

  // 画面そのもの：まずネットを試し、だめなら取り置きを出す
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // そのほか：取り置きがあればすぐ出し、裏で新しいものを取っておく
  event.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
