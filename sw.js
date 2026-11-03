// オフライン対応のサービスワーカー
// ゲームを更新したら VERSION を上げること（古いキャッシュが入れ替わる）
const VERSION = 'sumo-club-v3';
const FONT_CACHE = 'sumo-club-fonts';
const ASSETS = [
  './',
  "./css/style.css",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-32.png",
  "./icons/icon-512.png",
  "./icons/icon-64.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./js/audio.js",
  "./js/catchui.js",
  "./js/crab.js",
  "./js/data.js",
  "./js/env.js",
  "./js/main.js",
  "./js/save.js",
  "./js/scenes/field.js",
  "./js/scenes/sumo.js",
  "./js/scenes/tank.js",
  "./js/textures.js",
  "./js/ui.js",
  "./manifest.webmanifest",
  "./vendor/three/addons/OrbitControls.js",
  "./vendor/three/addons/RoomEnvironment.js",
  "./vendor/three/addons/Sky.js",
  "./vendor/three/three.module.min.js",
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts：キャッシュを返しつつ裏で更新
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // ページ本体：ネット優先（更新を拾う）、つながらなければキャッシュ
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // それ以外：キャッシュ優先
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
