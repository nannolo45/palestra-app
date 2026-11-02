// Offline support, as in Ricette. Each app version is cached as a whole; a new version is downloaded in the
// background and takes over when the user taps "Aggiorna" (or the next time the app starts with no workout open).
const VERSION = 'palestra-v13'; // keep in step with APP_VERSION in js/views/settings.js
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/sync.js', 'js/i18n.js', 'js/shell.js', 'js/sortable.js', 'js/model.js', 'js/workout.js', 'js/data.js', 'js/importer.js', 'js/plans.js',
  'js/ui/format.js', 'js/ui/dialogs.js', 'js/ui/icons.js', 'js/ui/parts.js',
  'js/views/routines.js', 'js/views/exercises.js', 'js/views/gym.js', 'js/views/history.js', 'js/views/settings.js', 'js/views/workout.js', 'js/views/plans.js', 'js/views/import.js', 'js/views/today.js', 'guide-it.html', 'guide-en.html',
  'fonts/Barlow-Regular.woff', 'fonts/Barlow-Medium.woff', 'fonts/Barlow-SemiBold.woff', 'fonts/Barlow-Bold.woff', 'fonts/BarlowCondensed-SemiBold.woff', 'fonts/BarlowCondensed-Bold.woff',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
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
