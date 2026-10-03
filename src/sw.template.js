// Service worker for offline play. Built by scripts/build.js, which sets VERSION to a hash of the files below.
// A new version gets a new cache; the old one is deleted when the new worker takes over.
//
// The page is one self-contained file (shell, games and levels inlined), so it can always be swapped as a whole:
// - Navigation races the network against NAV_TIMEOUT. Online, a new release shows on this very load; offline, or on a
//   network that hangs, the cached page answers. Whatever the network returns is cached for next time.
// - Everything else (icons, fonts, manifest) is precached and served cache first. It is versioned with the page.
const VERSION = '__VERSION__';
const CACHE = 'puzzles-' + VERSION;
const FILES = __FILES__;
const NAV_TIMEOUT = 2000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('puzzles-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function navigate(req) {
  const cache = await caches.open(CACHE);
  const cached = () => cache.match('./');
  // The browser knows it is offline: do not wait for a request that cannot succeed.
  if (self.navigator.onLine === false) return (await cached()) || fetch(req);
  try {
    // A navigate-mode request cannot be passed on with options, so fetch by URL. no-cache skips the HTTP cache
    // (GitHub Pages sends max-age=600) but still revalidates, so an unchanged page costs a 304.
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    const res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), NAV_TIMEOUT))]);
    if (res.ok) { cache.put('./', res.clone()); return res; }
    return (await cached()) || res;
  } catch (err) {
    return (await cached()) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(navigate(req)); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
