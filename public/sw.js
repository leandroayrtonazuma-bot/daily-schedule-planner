/**
 * Service Worker。
 *
 * **HTML の応答は絶対にキャッシュしない。**
 * ページにはカレンダーの予定内容が載っており、PLAN.md 3.1 は
 * 「予定内容を保存しない」と定めている。Cache Storage に入れれば
 * それは端末への保存にほかならない。
 *
 * したがってここが扱うのは、中身が誰のものでもない静的ファイルだけ。
 * 画面を開くには常にネットワークが要る。オフラインで一日を組む機能は無い。
 */
const CACHE = 'schedule-static-v1';

// 中身が個人に紐づかないものだけ
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icon-/, /^\/apple-touch-icon\.png$/, /^\/icon\.svg$/];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 画面・API はそのままネットワークへ。キャッシュを一切挟まない
  if (!STATIC_PATTERNS.some((pattern) => pattern.test(url.pathname))) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }

          return response;
        }),
    ),
  );
});
