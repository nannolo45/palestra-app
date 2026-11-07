// Offline support, as in Ricette. Each app version is cached as a whole; a new version is downloaded in the
// background and takes over when the user taps "Aggiorna" (or the next time the app starts with no workout open).
const VERSION = 'palestra-v27'; // keep in step with APP_VERSION in js/views/settings.js
// Exercise drawings from free-exercise-db are kept in a cache of their own that survives app updates.
const PICTURES = 'palestra-pictures';
const PICTURE_HOST = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/sync.js', 'js/i18n.js', 'js/shell.js', 'js/sortable.js', 'js/model.js', 'js/workout.js', 'js/data.js', 'js/theme.js', 'js/importer.js', 'js/plans.js', 'js/pictures.js', 'js/photos.js', 'lib/exercise-pictures.json',
  'js/ui/format.js', 'js/ui/dialogs.js', 'js/ui/icons.js', 'js/ui/parts.js', 'js/ui/listkit.js', 'js/body.js', 'js/gyms.js', 'js/stats.js', 'js/sound.js', 'js/catalog.js', 'js/catalog-it.js', 'js/ui/dropdrag.js',
  'js/views/routines.js', 'js/views/exercises.js', 'js/views/gym.js', 'js/views/history.js', 'js/views/settings.js', 'js/views/workout.js', 'js/views/plans.js', 'js/views/import.js', 'js/views/today.js', 'js/views/pictures.js', 'guide-it.html', 'guide-en.html',
  'fonts/Barlow-Regular.woff', 'fonts/Barlow-Medium.woff', 'fonts/Barlow-SemiBold.woff', 'fonts/Barlow-Bold.woff', 'fonts/BarlowCondensed-SemiBold.woff', 'fonts/BarlowCondensed-Bold.woff',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'SKIP_IF_ALONE') {
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => (wins.length <= 1 ? self.skipWaiting() : null)));
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== PICTURES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'GET' && req.url.startsWith(PICTURE_HOST)) {
    event.respondWith((async () => {
      const cache = await caches.open(PICTURES);
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // GitHub API goes straight to the network
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // opening the app (any address) serves index.html; the guide pages are pages of their own
    const guide = /\/guide-(it|en)\.html$/.test(url.pathname);
    const key = req.mode === 'navigate' ? (guide ? url.pathname.split('/').pop() : 'index.html') : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    if (cached) return cached;
    try {
      const res = await fetch(req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' }));
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  })());
});
