// 离线缓存 Service Worker
// __VERSION__ 由 GitHub Actions 部署时替换为提交哈希，
// 每次更新代码都会生成新 sw.js，触发浏览器后台静默更新。
const CACHE = 'learning-app-__VERSION__';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './reading.js',
  './vocab.js',
  './ielts.js',
  './library.js',
  './vendor/jszip.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/articles.json',
  './data/dict.json',
  './data/ielts.json',
];

self.addEventListener('install', (e) => {
  // no-cache：绕过浏览器 HTTP 缓存，确保预缓存的一定是最新文件
  e.waitUntil(caches.open(CACHE).then((c) =>
    c.addAll(ASSETS.map((u) => new Request(u, { cache: 'no-cache' })))
  ));
  self.skipWaiting(); // 新版本立即接管，不等待旧页面关闭
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 网络优先：有网时永远拿最新版本；断网时回退到缓存（离线可用）
// no-cache：每次都向服务器校验（未变化返回 304，很快），避免拿到过期的 HTTP 缓存
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
